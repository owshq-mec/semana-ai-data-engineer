"use client";

import { useEffect, useState } from "react";

import type { PlatformTick } from "./types";

const EMPTY: PlatformTick = {
  type: "platform_tick",
  ts: 0,
  postgres: { customers: 0, products: 0, orders: 0, orders_last_minute: 0 },
  qdrant: { points: 0, collection: "shopagent_reviews", status: "offline" },
  sparkline: [],
};

export function useTelemetry(): { tick: PlatformTick; connected: boolean } {
  const [tick, setTick] = useState<PlatformTick>(EMPTY);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const source = new EventSource(`/api/telemetry/stream`);
    source.addEventListener("platform_tick", (evt) => {
      try {
        const data = JSON.parse((evt as MessageEvent).data) as PlatformTick;
        setTick(data);
        setConnected(true);
      } catch {
        /* ignore */
      }
    });
    source.onerror = () => {
      setConnected(false);
    };
    return () => {
      source.close();
      setConnected(false);
    };
  }, []);

  return { tick, connected };
}
