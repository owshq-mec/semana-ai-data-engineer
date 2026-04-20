"""ShopAgent Day 4 — CrewAI tools for The Ledger (SQL) and The Memory (semantic).

Tools silently emit structured events when run inside the Observatory FastAPI
server (via contextvars installed by api.instrumentation). When run from the
Chainlit app or CLI the emit calls no-op — behavior is identical.
"""

from __future__ import annotations

import json
import os
import re
import time
from pathlib import Path
from typing import Any

import psycopg2
from crewai.tools import tool
from dotenv import load_dotenv
from fastembed import TextEmbedding
from qdrant_client import QdrantClient

from src.day4.api.instrumentation import emit, tool_agent

PROJECT_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(PROJECT_ROOT / ".env")

_embedding_model: TextEmbedding | None = None
_PREVIEW_CAP = 1200


def _get_postgres_connection():
    return psycopg2.connect(
        host=os.environ.get("POSTGRES_HOST", "localhost"),
        port=int(os.environ.get("POSTGRES_PORT", 5432)),
        dbname=os.environ.get("POSTGRES_DB", "shopagent"),
        user=os.environ.get("POSTGRES_USER", "shopagent"),
        password=os.environ.get("POSTGRES_PASSWORD", "shopagent"),
    )


def _get_embedding_model() -> TextEmbedding:
    global _embedding_model
    if _embedding_model is None:
        _embedding_model = TextEmbedding(model_name="BAAI/bge-base-en-v1.5")
    return _embedding_model


_REVIEW_FIELD_RE = re.compile(r'"(review_id|order_id|rating|comment|sentiment)":\s*"?([^",}]+)"?')


def _unwrap_review_payload(payload: dict[str, Any]) -> dict[str, Any]:
    """Return flat review fields, handling both raw-payload and LlamaIndex-wrapped formats."""
    if payload.get("comment") or payload.get("rating"):
        return payload
    node_content = payload.get("_node_content")
    if not node_content:
        return payload
    try:
        node = json.loads(node_content)
        text = node.get("text", "")
    except (json.JSONDecodeError, TypeError):
        return payload
    fields: dict[str, Any] = {}
    for match in _REVIEW_FIELD_RE.finditer(text):
        key, value = match.group(1), match.group(2).strip()
        if key == "rating":
            try:
                fields[key] = int(value)
            except ValueError:
                fields[key] = value
        else:
            fields[key] = value
    return fields or payload


@tool("supabase_execute_sql")
def supabase_execute_sql(query: str) -> str:
    """Execute a SQL query against the ShopAgent Postgres database (The Ledger).
    Use for exact metrics: revenue, order counts, averages, customer segments.
    Available tables: customers, products, orders.
    Always write SELECT queries. Never mutate data."""
    tool_name = "supabase_execute_sql"
    agent = tool_agent(tool_name)
    emit({"type": "tool_start", "agent": agent, "tool": tool_name, "input": query[:_PREVIEW_CAP]})

    t0 = time.perf_counter()
    conn = _get_postgres_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(query)
            columns = [desc[0] for desc in cur.description]
            rows = cur.fetchall()
        lines = [" | ".join(columns)]
        for row in rows:
            lines.append(" | ".join(str(v) for v in row))
        preview = "\n".join(lines)
        latency_ms = int((time.perf_counter() - t0) * 1000)
        emit({
            "type": "tool_result",
            "agent": agent,
            "tool": tool_name,
            "preview": preview[:_PREVIEW_CAP],
            "columns": columns,
            "rows": len(rows),
            "latency_ms": latency_ms,
        })
        return preview
    except Exception as exc:
        latency_ms = int((time.perf_counter() - t0) * 1000)
        emit({
            "type": "tool_error",
            "agent": agent,
            "tool": tool_name,
            "error": str(exc),
            "latency_ms": latency_ms,
        })
        return f"SQL Error: {exc}"
    finally:
        conn.close()


@tool("qdrant_semantic_search")
def qdrant_semantic_search(question: str) -> str:
    """Search customer reviews by meaning using Qdrant vector database (The Memory).
    Use for opinions, complaints, sentiment themes, and customer feedback.
    The collection contains 203 Portuguese reviews with rating, comment, sentiment."""
    tool_name = "qdrant_semantic_search"
    agent = tool_agent(tool_name)
    emit({"type": "tool_start", "agent": agent, "tool": tool_name, "input": question[:_PREVIEW_CAP]})

    qdrant_url = os.environ.get("QDRANT_URL", "http://localhost:6333")
    qdrant_api_key = os.environ.get("QDRANT_API_KEY", None)
    collection = os.environ.get("QDRANT_COLLECTION", "shopagent_reviews")

    t0 = time.perf_counter()
    model = _get_embedding_model()
    embeddings = list(model.embed([question]))
    query_vector = embeddings[0].tolist()
    embed_ms = int((time.perf_counter() - t0) * 1000)

    t1 = time.perf_counter()
    client = QdrantClient(url=qdrant_url, api_key=qdrant_api_key)
    results = client.query_points(
        collection_name=collection,
        query=query_vector,
        limit=5,
        with_payload=True,
    )
    search_ms = int((time.perf_counter() - t1) * 1000)

    if not results.points:
        emit({
            "type": "tool_result",
            "agent": agent,
            "tool": tool_name,
            "preview": "Nenhum review encontrado.",
            "rows": 0,
            "top_scores": [],
            "embed_ms": embed_ms,
            "search_ms": search_ms,
            "latency_ms": embed_ms + search_ms,
        })
        return "Nenhum review encontrado para esta consulta."

    lines: list[str] = []
    hits: list[dict] = []
    for point in results.points:
        raw = point.payload or {}
        payload = _unwrap_review_payload(raw)
        rating = payload.get("rating", "?")
        sentiment = payload.get("sentiment", "unknown")
        comment = str(payload.get("comment", ""))[:220]
        order_id = payload.get("order_id", "")
        score = round(point.score, 3)
        lines.append(f"[score={score} | rating={rating} | {sentiment}] {comment}")
        hits.append({
            "score": score,
            "rating": rating,
            "sentiment": sentiment,
            "comment": comment,
            "order_id": order_id,
        })

    preview = "\n".join(lines)
    emit({
        "type": "tool_result",
        "agent": agent,
        "tool": tool_name,
        "preview": preview[:_PREVIEW_CAP],
        "rows": len(hits),
        "top_scores": [h["score"] for h in hits],
        "hits": hits,
        "embed_ms": embed_ms,
        "search_ms": search_ms,
        "latency_ms": embed_ms + search_ms,
    })
    return preview
