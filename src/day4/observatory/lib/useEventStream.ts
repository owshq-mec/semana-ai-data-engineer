"use client";

import { useEffect, useRef, useState } from "react";

import { emptyTrace, reduceEvent } from "./reducer";
import type { TraceEvent, TraceState } from "./types";

export function useEventStream(traceId: string | null): {
  trace: TraceState;
  connected: boolean;
} {
  const [trace, setTrace] = useState<TraceState>(emptyTrace());
  const [connected, setConnected] = useState(false);
  const sourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!traceId) {
      setTrace(emptyTrace());
      setConnected(false);
      return;
    }

    const source = new EventSource(`/api/stream/${traceId}`);
    sourceRef.current = source;
    setConnected(true);

    const handler = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data) as TraceEvent;
        setTrace((prev) => reduceEvent(prev, data));
        if (data.type === "trace_complete" || data.type === "trace_error") {
          source.close();
          setConnected(false);
        }
      } catch (err) {
        console.warn("invalid event", err);
      }
    };

    const types = [
      "trace_start",
      "agent_start",
      "agent_complete",
      "tool_start",
      "tool_result",
      "tool_error",
      "trace_complete",
      "trace_error",
    ];
    for (const t of types) source.addEventListener(t, handler as EventListener);

    source.addEventListener("end", () => {
      source.close();
      setConnected(false);
    });
    source.onerror = () => {
      setConnected(false);
    };

    return () => {
      source.close();
      setConnected(false);
    };
  }, [traceId]);

  return { trace, connected };
}
