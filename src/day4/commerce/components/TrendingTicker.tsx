"use client";

import { useEffect, useState } from "react";

interface Tick {
  orders: number;
  orders_last_minute: number;
  qdrant_points: number;
}

export default function TrendingTicker() {
  const [tick, setTick] = useState<Tick>({ orders: 0, orders_last_minute: 0, qdrant_points: 0 });

  useEffect(() => {
    const source = new EventSource(`/api/telemetry/stream`);
    source.addEventListener("platform_tick", (evt) => {
      try {
        const data = JSON.parse((evt as MessageEvent).data);
        setTick({
          orders: data.postgres?.orders ?? 0,
          orders_last_minute: data.postgres?.orders_last_minute ?? 0,
          qdrant_points: data.qdrant?.points ?? 0,
        });
      } catch {}
    });
    source.onerror = () => {};
    return () => source.close();
  }, []);

  return (
    <div className="trending-ticker" aria-live="polite">
      <span className="ticker-dot" aria-hidden />
      <span>Live</span>
      <span className="ticker-value">{tick.orders.toLocaleString("pt-BR")}</span>
      <span>pedidos</span>
      <span style={{ opacity: 0.4 }}>·</span>
      <span className="ticker-value">{tick.orders_last_minute}</span>
      <span>nos últimos 60s</span>
    </div>
  );
}
