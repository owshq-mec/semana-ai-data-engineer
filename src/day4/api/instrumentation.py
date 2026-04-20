"""Context-var plumbing that lets CrewAI tools emit events without changing signatures.

A FastAPI request sets the trace id and emit callable; `asyncio.to_thread`
propagates the context into CrewAI's worker thread (Python 3.11+); tools call
`emit(...)` and silently no-op when run outside the API (e.g. from Chainlit).
"""

from __future__ import annotations

import contextvars
import time
from typing import Any, Callable


EmitFn = Callable[[dict[str, Any]], None]

_trace_id_var: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "shopagent_trace_id", default=None
)
_emit_var: contextvars.ContextVar[EmitFn | None] = contextvars.ContextVar(
    "shopagent_emit", default=None
)


TOOL_TO_AGENT = {
    "supabase_execute_sql": "analyst",
    "qdrant_semantic_search": "researcher",
}


def install_trace_context(trace_id: str, emit: EmitFn) -> None:
    _trace_id_var.set(trace_id)
    _emit_var.set(emit)


def emit(event: dict[str, Any]) -> None:
    emit_fn = _emit_var.get()
    trace_id = _trace_id_var.get()
    if emit_fn is None or trace_id is None:
        return
    event.setdefault("ts", time.time())
    event["trace_id"] = trace_id
    emit_fn(event)


def tool_agent(tool_name: str) -> str:
    return TOOL_TO_AGENT.get(tool_name, "unknown")
