"""Platform telemetry poller — broadcasts Postgres + Qdrant stats every 2 s."""

from __future__ import annotations

import asyncio
import logging
import os
import time
from collections import deque
from typing import Any

import httpx

from src.day4.api.events import bus


log = logging.getLogger("observatory.telemetry")


POSTGRES_DSN = (
    f"host={os.environ.get('POSTGRES_HOST', 'localhost')} "
    f"port={os.environ.get('POSTGRES_PORT', 5432)} "
    f"dbname={os.environ.get('POSTGRES_DB', 'shopagent')} "
    f"user={os.environ.get('POSTGRES_USER', 'shopagent')} "
    f"password={os.environ.get('POSTGRES_PASSWORD', 'shopagent')}"
)
QDRANT_URL = os.environ.get("QDRANT_URL", "http://localhost:6333")
QDRANT_COLLECTION = os.environ.get("QDRANT_COLLECTION", "shopagent_reviews")
POLL_INTERVAL_S = float(os.environ.get("OBSERVATORY_POLL_INTERVAL", "2.0"))


def _count_query(conn) -> dict[str, int]:
    out: dict[str, int] = {}
    with conn.cursor() as cur:
        for table in ("customers", "products", "orders"):
            cur.execute(f"SELECT COUNT(*) FROM {table}")
            out[table] = cur.fetchone()[0]
        cur.execute(
            "SELECT COUNT(*) FROM orders "
            "WHERE created_at > NOW() - INTERVAL '60 seconds'"
        )
        out["orders_last_minute"] = cur.fetchone()[0]
    return out


async def _snapshot_postgres() -> dict[str, int]:
    import psycopg2

    def _run() -> dict[str, int]:
        conn = psycopg2.connect(
            host=os.environ.get("POSTGRES_HOST", "localhost"),
            port=int(os.environ.get("POSTGRES_PORT", 5432)),
            dbname=os.environ.get("POSTGRES_DB", "shopagent"),
            user=os.environ.get("POSTGRES_USER", "shopagent"),
            password=os.environ.get("POSTGRES_PASSWORD", "shopagent"),
        )
        try:
            return _count_query(conn)
        finally:
            conn.close()

    try:
        return await asyncio.to_thread(_run)
    except Exception as exc:
        log.warning("postgres snapshot failed: %s", exc)
        return {"customers": 0, "products": 0, "orders": 0, "orders_last_minute": 0}


async def _snapshot_qdrant(client: httpx.AsyncClient) -> dict[str, Any]:
    try:
        resp = await client.get(
            f"{QDRANT_URL}/collections/{QDRANT_COLLECTION}", timeout=2.0
        )
        if resp.status_code != 200:
            return {"points": 0, "collection": QDRANT_COLLECTION, "status": "missing"}
        body = resp.json().get("result", {})
        return {
            "points": body.get("points_count", 0),
            "collection": QDRANT_COLLECTION,
            "status": body.get("status", "unknown"),
        }
    except Exception as exc:
        log.warning("qdrant snapshot failed: %s", exc)
        return {"points": 0, "collection": QDRANT_COLLECTION, "status": "offline"}


async def run_poller(stop_event: asyncio.Event) -> None:
    history: deque[dict[str, Any]] = deque(maxlen=30)
    async with httpx.AsyncClient() as client:
        while not stop_event.is_set():
            pg = await _snapshot_postgres()
            qd = await _snapshot_qdrant(client)
            tick = {
                "type": "platform_tick",
                "ts": time.time(),
                "postgres": pg,
                "qdrant": qd,
                "sparkline": [h["postgres"]["orders_last_minute"] for h in history],
            }
            history.append(tick)
            bus.broadcast_platform(tick)
            try:
                await asyncio.wait_for(stop_event.wait(), timeout=POLL_INTERVAL_S)
            except asyncio.TimeoutError:
                continue
