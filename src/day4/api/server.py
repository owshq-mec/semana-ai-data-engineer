"""FastAPI sidecar exposing SSE streams for the Live Observatory.

Two endpoints:
  POST /query            start a query; returns trace_id immediately
  GET  /stream/{id}      SSE of events for a single query (ends on trace_complete)
  GET  /telemetry/stream SSE of platform ticks (always-on)
"""

from __future__ import annotations

import asyncio
import contextvars
import json
import logging
import time
import uuid
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from src.day4.api.commerce import router as commerce_router
from src.day4.api.events import SENTINEL, bus
from src.day4.api.instrumentation import install_trace_context
from src.day4.api.telemetry import run_poller


log = logging.getLogger("observatory.server")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")


AGENT_ORDER = ["analyst", "researcher", "reporter"]


@asynccontextmanager
async def lifespan(app: FastAPI):
    loop = asyncio.get_running_loop()
    bus.attach_loop(loop)
    stop_event = asyncio.Event()
    poller = asyncio.create_task(run_poller(stop_event))
    log.info("observatory sidecar ready — telemetry poller started")
    try:
        yield
    finally:
        stop_event.set()
        poller.cancel()
        try:
            await poller
        except (asyncio.CancelledError, Exception):
            pass


app = FastAPI(title="ShopAgent Observatory API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(commerce_router)


class QueryPayload(BaseModel):
    question: str


class QueryResponse(BaseModel):
    trace_id: str


@app.post("/query", response_model=QueryResponse)
async def post_query(payload: QueryPayload) -> QueryResponse:
    if not payload.question.strip():
        raise HTTPException(status_code=400, detail="question is required")
    trace_id = uuid.uuid4().hex[:12]
    bus.create_trace(trace_id)
    asyncio.create_task(_run_trace(trace_id, payload.question))
    return QueryResponse(trace_id=trace_id)


async def _run_trace(trace_id: str, question: str) -> None:
    from src.day4.crew import run_crew_with_emitter

    started = time.time()
    emit = lambda ev: bus.publish(trace_id, ev)

    def setup_and_run() -> str:
        install_trace_context(trace_id, emit)
        return run_crew_with_emitter(question, trace_id, emit)

    bus.publish(trace_id, {
        "type": "trace_start",
        "trace_id": trace_id,
        "question": question,
        "ts": started,
    })

    try:
        ctx = contextvars.copy_context()
        final = await asyncio.to_thread(ctx.run, setup_and_run)
    except Exception as exc:
        log.exception("trace %s failed", trace_id)
        bus.publish(trace_id, {
            "type": "trace_error",
            "trace_id": trace_id,
            "error": str(exc),
            "ts": time.time(),
        })
        bus.close_trace(trace_id)
        return

    duration_ms = int((time.time() - started) * 1000)
    bus.publish(trace_id, {
        "type": "trace_complete",
        "trace_id": trace_id,
        "final_report": final,
        "duration_ms": duration_ms,
        "ts": time.time(),
    })
    bus.close_trace(trace_id)


@app.get("/stream/{trace_id}")
async def stream_trace(trace_id: str) -> EventSourceResponse:
    queue = bus._traces.get(trace_id)
    if queue is None:
        raise HTTPException(status_code=404, detail="unknown trace_id")

    async def generator() -> AsyncIterator[dict]:
        while True:
            event = await queue.get()
            if event is SENTINEL:
                yield {"event": "end", "data": json.dumps({"trace_id": trace_id})}
                return
            yield {"event": event.get("type", "message"), "data": json.dumps(event)}

    return EventSourceResponse(generator())


@app.get("/telemetry/stream")
async def stream_telemetry() -> EventSourceResponse:
    queue = bus.subscribe_platform()

    async def generator() -> AsyncIterator[dict]:
        try:
            while True:
                event = await queue.get()
                yield {"event": event.get("type", "message"), "data": json.dumps(event)}
        finally:
            bus.unsubscribe_platform(queue)

    return EventSourceResponse(generator())


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "agents": ",".join(AGENT_ORDER)}
