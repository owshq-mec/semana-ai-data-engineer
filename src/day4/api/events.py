"""Thread-safe event bus with per-trace fanout and a global platform channel.

Tools run inside a CrewAI worker thread; SSE subscribers read from asyncio
queues on the main loop. `loop.call_soon_threadsafe(queue.put_nowait, event)`
is the bridge that keeps emission latency negligible.
"""

from __future__ import annotations

import asyncio
from typing import Any


SENTINEL: dict[str, Any] = {"type": "_stream_end"}


class EventBus:
    def __init__(self) -> None:
        self._traces: dict[str, asyncio.Queue[dict[str, Any]]] = {}
        self._platform_subs: set[asyncio.Queue[dict[str, Any]]] = set()
        self._loop: asyncio.AbstractEventLoop | None = None

    def attach_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        self._loop = loop

    def create_trace(self, trace_id: str) -> asyncio.Queue[dict[str, Any]]:
        queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue()
        self._traces[trace_id] = queue
        return queue

    def close_trace(self, trace_id: str) -> None:
        queue = self._traces.pop(trace_id, None)
        if queue is not None:
            self._safe_put(queue, SENTINEL)

    def subscribe_platform(self) -> asyncio.Queue[dict[str, Any]]:
        queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=64)
        self._platform_subs.add(queue)
        return queue

    def unsubscribe_platform(self, queue: asyncio.Queue[dict[str, Any]]) -> None:
        self._platform_subs.discard(queue)

    def publish(self, trace_id: str, event: dict[str, Any]) -> None:
        queue = self._traces.get(trace_id)
        if queue is not None:
            self._safe_put(queue, event)

    def broadcast_platform(self, event: dict[str, Any]) -> None:
        for queue in list(self._traces.values()):
            self._safe_put(queue, event)
        for queue in list(self._platform_subs):
            self._safe_put(queue, event)

    def _safe_put(self, queue: asyncio.Queue[dict[str, Any]], event: dict[str, Any]) -> None:
        if self._loop is None:
            return
        try:
            self._loop.call_soon_threadsafe(queue.put_nowait, event)
        except RuntimeError:
            pass


bus = EventBus()
