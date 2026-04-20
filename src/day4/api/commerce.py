"""Commerce endpoints for the Agentic Commerce storefront.

Keeps a cache of aggregate product metrics (refreshed every 10 s) so the
storefront never blocks on Postgres during a page load. All heavy reasoning
still flows through the crew via /commerce/ask.
"""

from __future__ import annotations

import asyncio
import contextvars
import json
import logging
import os
import re
import time
import uuid
from typing import Any

import psycopg2
import psycopg2.extras
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from src.day4.api.events import bus
from src.day4.api.instrumentation import install_trace_context


log = logging.getLogger("observatory.commerce")
router = APIRouter(prefix="/commerce", tags=["commerce"])


def _connect():
    return psycopg2.connect(
        host=os.environ.get("POSTGRES_HOST", "localhost"),
        port=int(os.environ.get("POSTGRES_PORT", 5432)),
        dbname=os.environ.get("POSTGRES_DB", "shopagent"),
        user=os.environ.get("POSTGRES_USER", "shopagent"),
        password=os.environ.get("POSTGRES_PASSWORD", "shopagent"),
    )


def _run_query(sql: str, params: tuple = ()) -> list[dict[str, Any]]:
    conn = _connect()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, params)
            rows = cur.fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


async def q(sql: str, params: tuple = ()) -> list[dict[str, Any]]:
    return await asyncio.to_thread(_run_query, sql, params)


@router.get("/categories")
async def categories() -> list[dict[str, Any]]:
    rows = await q(
        "SELECT category, COUNT(*) AS product_count FROM products GROUP BY category ORDER BY product_count DESC"
    )
    return rows


@router.get("/products")
async def list_products(
    limit: int = 24,
    offset: int = 0,
    category: str | None = None,
    search: str | None = None,
) -> dict[str, Any]:
    clauses: list[str] = []
    params: list[Any] = []
    if category:
        clauses.append("p.category = %s")
        params.append(category)
    if search:
        clauses.append("(p.name ILIKE %s OR p.brand ILIKE %s OR p.category ILIKE %s)")
        params += [f"%{search}%"] * 3
    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    sql = f"""
        SELECT
          p.product_id::text,
          p.name,
          p.category,
          p.brand,
          p.price::float,
          COALESCE(o.order_count, 0) AS order_count,
          COALESCE(o.total_revenue, 0)::float AS total_revenue
        FROM products p
        LEFT JOIN (
            SELECT product_id, COUNT(*) AS order_count, SUM(total) AS total_revenue
            FROM orders
            GROUP BY product_id
        ) o ON o.product_id = p.product_id
        {where}
        ORDER BY order_count DESC NULLS LAST, p.name
        LIMIT %s OFFSET %s
    """
    rows = await q(sql, tuple(params) + (limit, offset))
    total_rows = await q(f"SELECT COUNT(*) AS c FROM products p {where}", tuple(params))
    return {"items": rows, "total": int(total_rows[0]["c"]) if total_rows else 0}


@router.get("/products/{product_id}")
async def product_detail(product_id: str) -> dict[str, Any]:
    prod = await q(
        """
        SELECT p.product_id::text, p.name, p.category, p.brand, p.price::float,
               COALESCE(SUM(o.total), 0)::float AS total_revenue,
               COUNT(o.order_id) AS order_count,
               COALESCE(AVG(o.qty), 0)::float AS avg_qty
        FROM products p
        LEFT JOIN orders o ON o.product_id = p.product_id
        WHERE p.product_id::text = %s
        GROUP BY p.product_id, p.name, p.category, p.brand, p.price
        """,
        (product_id,),
    )
    if not prod:
        raise HTTPException(status_code=404, detail="product not found")
    row = prod[0]

    status_breakdown = await q(
        """
        SELECT status, COUNT(*) AS n
        FROM orders WHERE product_id::text = %s
        GROUP BY status
        """,
        (product_id,),
    )
    payment_breakdown = await q(
        """
        SELECT payment, COUNT(*) AS n
        FROM orders WHERE product_id::text = %s
        GROUP BY payment
        """,
        (product_id,),
    )
    row["status_breakdown"] = {r["status"]: int(r["n"]) for r in status_breakdown}
    row["payment_breakdown"] = {r["payment"]: int(r["n"]) for r in payment_breakdown}
    return row


@router.get("/featured")
async def featured() -> list[dict[str, Any]]:
    rows = await q(
        """
        SELECT p.product_id::text, p.name, p.category, p.brand, p.price::float,
               COUNT(o.order_id) AS order_count,
               COALESCE(SUM(o.total), 0)::float AS total_revenue
        FROM products p
        LEFT JOIN orders o ON o.product_id = p.product_id
        GROUP BY p.product_id, p.name, p.category, p.brand, p.price
        ORDER BY order_count DESC, total_revenue DESC
        LIMIT 6
        """
    )
    return rows


@router.get("/trending")
async def trending() -> list[dict[str, Any]]:
    rows = await q(
        """
        SELECT p.product_id::text, p.name, p.category, p.brand, p.price::float,
               COUNT(o.order_id) AS recent_orders,
               COALESCE(SUM(o.total), 0)::float AS recent_revenue
        FROM products p
        JOIN orders o ON o.product_id = p.product_id
        WHERE o.created_at > NOW() - INTERVAL '24 hours'
        GROUP BY p.product_id, p.name, p.category, p.brand, p.price
        ORDER BY recent_orders DESC
        LIMIT 8
        """
    )
    return rows


class SearchPayload(BaseModel):
    q: str
    limit: int = 5


@router.post("/search")
async def semantic_search(payload: SearchPayload) -> dict[str, Any]:
    """Semantic review search → returns top products mentioned in matching reviews."""
    if not payload.q.strip():
        raise HTTPException(status_code=400, detail="q is required")

    def _run() -> list[dict[str, Any]]:
        from fastembed import TextEmbedding
        from qdrant_client import QdrantClient
        from src.day4.tools import _unwrap_review_payload

        model = TextEmbedding(model_name="BAAI/bge-base-en-v1.5")
        vec = list(model.embed([payload.q]))[0].tolist()
        client = QdrantClient(
            url=os.environ.get("QDRANT_URL", "http://localhost:6333"),
            api_key=os.environ.get("QDRANT_API_KEY"),
        )
        hits = client.query_points(
            collection_name=os.environ.get("QDRANT_COLLECTION", "shopagent_reviews"),
            query=vec,
            limit=max(payload.limit * 4, 12),
            with_payload=True,
        ).points

        order_ids: list[str] = []
        snippets: dict[str, dict[str, Any]] = {}
        for h in hits:
            flat = _unwrap_review_payload(h.payload or {})
            oid = flat.get("order_id")
            if not oid:
                continue
            if oid not in snippets:
                snippets[oid] = {
                    "score": round(h.score, 3),
                    "rating": flat.get("rating"),
                    "sentiment": flat.get("sentiment"),
                    "comment": flat.get("comment", ""),
                }
                order_ids.append(oid)

        if not order_ids:
            return []

        conn = _connect()
        try:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT o.order_id::text,
                           p.product_id::text, p.name, p.category, p.brand, p.price::float
                    FROM orders o
                    JOIN products p ON p.product_id = o.product_id
                    WHERE o.order_id::text = ANY(%s)
                    """,
                    (order_ids,),
                )
                rows = cur.fetchall()
        finally:
            conn.close()

        out: dict[str, dict[str, Any]] = {}
        for r in rows:
            snippet = snippets.get(r["order_id"], {})
            key = r["product_id"]
            if key in out:
                out[key]["review_count"] += 1
                if snippet.get("score", 0) > out[key]["best_score"]:
                    out[key]["best_score"] = snippet.get("score", 0)
                    out[key]["excerpt"] = snippet.get("comment", "")
                    out[key]["sentiment"] = snippet.get("sentiment", "")
                    out[key]["rating"] = snippet.get("rating", "")
            else:
                out[key] = {
                    "product_id": r["product_id"],
                    "name": r["name"],
                    "category": r["category"],
                    "brand": r["brand"],
                    "price": r["price"],
                    "review_count": 1,
                    "best_score": snippet.get("score", 0),
                    "excerpt": snippet.get("comment", ""),
                    "sentiment": snippet.get("sentiment", ""),
                    "rating": snippet.get("rating", ""),
                }
        return sorted(out.values(), key=lambda x: (x["best_score"], x["review_count"]), reverse=True)[: payload.limit]

    results = await asyncio.to_thread(_run)
    return {"query": payload.q, "results": results}


class HistoryTurn(BaseModel):
    role: str  # "user" | "crew"
    content: str


class AskPayload(BaseModel):
    product_id: str | None = None
    product_name: str | None = None
    product_brand: str | None = None
    product_category: str | None = None
    product_price: float | None = None
    question: str | None = None
    history: list[HistoryTurn] | None = None


def _product_context(payload: AskPayload) -> str:
    if not payload.product_name:
        return ""
    bits = [f'"{payload.product_name}"']
    if payload.product_brand:
        bits.append(f"da marca {payload.product_brand}")
    if payload.product_category:
        bits.append(f"(categoria {payload.product_category})")
    if payload.product_price:
        bits.append(f"a R$ {payload.product_price:.2f}")
    return "Contexto do produto em tela: " + " ".join(bits) + "."


def _history_block(history: list[HistoryTurn] | None) -> str:
    if not history:
        return ""
    turns = []
    for turn in history[-6:]:
        prefix = "Cliente" if turn.role == "user" else "Crew"
        text = turn.content.strip().replace("\n", " ")
        if len(text) > 400:
            text = text[:400] + "..."
        turns.append(f"{prefix}: {text}")
    return "Conversa ate agora:\n" + "\n".join(turns)


@router.post("/ask")
async def ask_the_crew(payload: AskPayload) -> dict[str, str]:
    """Fire the 3-agent crew. Supports multi-turn via optional history + product context."""
    product_ctx = _product_context(payload)
    history_ctx = _history_block(payload.history)

    if payload.question:
        parts = []
        if product_ctx:
            parts.append(product_ctx)
        if history_ctx:
            parts.append(history_ctx)
        parts.append(f"Pergunta atual do cliente: {payload.question}")
        parts.append(
            "Responda como um concierge especializado. "
            "Use SQL para metricas e reviews para voz do cliente. "
            "Seja direto, referencie numeros reais e cite 1-2 reviews se relevante."
        )
        question = "\n\n".join(parts)
    elif payload.product_name:
        question = (
            f"Avalie o produto {product_ctx.replace('Contexto do produto em tela: ', '')} "
            "Quero saber: quantos pedidos e faturamento, "
            "distribuicao de status e forma de pagamento, "
            "e o que clientes dizem em reviews semelhantes. "
            "Termine com uma recomendacao clara em 2 frases."
        )
    else:
        raise HTTPException(status_code=400, detail="question or product_name required")

    trace_id = uuid.uuid4().hex[:12]
    bus.create_trace(trace_id)
    asyncio.create_task(_run_commerce_trace(trace_id, question))
    return {"trace_id": trace_id, "question": question}


async def _run_commerce_trace(trace_id: str, question: str) -> None:
    from src.day4.crew import run_crew_with_emitter

    started = time.time()
    emit = lambda ev: bus.publish(trace_id, ev)

    def setup_and_run() -> str:
        install_trace_context(trace_id, emit)
        return run_crew_with_emitter(question, trace_id, emit)

    bus.publish(
        trace_id,
        {"type": "trace_start", "trace_id": trace_id, "question": question, "ts": started},
    )
    try:
        ctx = contextvars.copy_context()
        final = await asyncio.to_thread(ctx.run, setup_and_run)
    except Exception as exc:
        log.exception("commerce trace %s failed", trace_id)
        bus.publish(
            trace_id,
            {"type": "trace_error", "trace_id": trace_id, "error": str(exc), "ts": time.time()},
        )
        bus.close_trace(trace_id)
        return

    bus.publish(
        trace_id,
        {
            "type": "trace_complete",
            "trace_id": trace_id,
            "final_report": final,
            "duration_ms": int((time.time() - started) * 1000),
            "ts": time.time(),
        },
    )
    bus.close_trace(trace_id)
