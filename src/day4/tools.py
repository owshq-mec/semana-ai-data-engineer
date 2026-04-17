"""ShopAgent Day 4 — CrewAI tools for The Ledger (SQL) and The Memory (semantic)."""

import os
from pathlib import Path

import psycopg2
from crewai.tools import tool
from dotenv import load_dotenv
from fastembed import TextEmbedding
from qdrant_client import QdrantClient

PROJECT_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(PROJECT_ROOT / ".env")

_embedding_model = None


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


@tool("supabase_execute_sql")
def supabase_execute_sql(query: str) -> str:
    """Execute a SQL query against the ShopAgent Postgres database (The Ledger).
    Use for exact metrics: revenue, order counts, averages, customer segments.
    Available tables: customers, products, orders.
    Always write SELECT queries. Never mutate data."""
    conn = _get_postgres_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(query)
            columns = [desc[0] for desc in cur.description]
            rows = cur.fetchall()
        lines = [" | ".join(columns)]
        for row in rows:
            lines.append(" | ".join(str(v) for v in row))
        return "\n".join(lines)
    except Exception as e:
        return f"SQL Error: {e}"
    finally:
        conn.close()


@tool("qdrant_semantic_search")
def qdrant_semantic_search(question: str) -> str:
    """Search customer reviews by meaning using Qdrant vector database (The Memory).
    Use for opinions, complaints, sentiment themes, and customer feedback.
    The collection contains 203 Portuguese reviews with rating, comment, sentiment."""
    qdrant_url = os.environ.get("QDRANT_URL", "http://localhost:6333")
    qdrant_api_key = os.environ.get("QDRANT_API_KEY", None)
    collection = os.environ.get("QDRANT_COLLECTION", "shopagent_reviews")

    model = _get_embedding_model()
    embeddings = list(model.embed([question]))
    query_vector = embeddings[0].tolist()

    client = QdrantClient(url=qdrant_url, api_key=qdrant_api_key)
    results = client.query_points(
        collection_name=collection,
        query=query_vector,
        limit=5,
        with_payload=True,
    )

    if not results.points:
        return "Nenhum review encontrado para esta consulta."

    lines: list[str] = []
    for point in results.points:
        payload = point.payload or {}
        rating = payload.get("rating", "?")
        sentiment = payload.get("sentiment", "unknown")
        comment = payload.get("comment", "")[:200]
        score = round(point.score, 3)
        lines.append(f"[score={score} | rating={rating} | {sentiment}] {comment}")

    return "\n".join(lines)
