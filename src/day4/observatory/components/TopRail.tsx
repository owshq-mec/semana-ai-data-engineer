"use client";

import { motion } from "motion/react";

import type { PlatformTick } from "../lib/types";

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function Sparkline({ values, width = 120, height = 34 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 2) {
    return (
      <svg className="sparkline" width={width} height={height} aria-hidden>
        <line x1={0} x2={width} y1={height / 2} y2={height / 2} stroke="var(--line-strong)" strokeDasharray="2 4" />
      </svg>
    );
  }
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = Math.max(max - min, 1);
  const step = width / (values.length - 1);
  const pts = values
    .map((v, i) => {
      const x = i * step;
      const y = height - ((v - min) / span) * (height - 6) - 3;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg className="sparkline" width={width} height={height} aria-hidden>
      <defs>
        <linearGradient id="sparkGrad" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="var(--silver-dim)" />
          <stop offset="100%" stopColor="var(--accent)" />
        </linearGradient>
      </defs>
      <polyline points={pts} fill="none" stroke="url(#sparkGrad)" strokeWidth={1.4} />
    </svg>
  );
}

export default function TopRail({ tick, connected }: { tick: PlatformTick; connected: boolean }) {
  const dotState = connected ? "" : "off";
  return (
    <motion.header
      className="topbar"
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="wordmark">
        <strong>SHOPAGENT</strong>
        <em>· OBSERVATORY</em>
      </div>

      <div className="counters">
        <div className="counter">
          <span className="counter-label">Customers</span>
          <span className="counter-value">{fmt(tick.postgres.customers)}</span>
        </div>
        <div className="counter">
          <span className="counter-label">Products</span>
          <span className="counter-value">{fmt(tick.postgres.products)}</span>
        </div>
        <div className="counter">
          <span className="counter-label">Orders · Total</span>
          <span className="counter-value accent">{fmt(tick.postgres.orders)}</span>
        </div>
        <div className="counter">
          <span className="counter-label">Orders · 60s</span>
          <span className="counter-value signal">{tick.postgres.orders_last_minute}</span>
        </div>
        <div className="counter">
          <span className="counter-label">Memory · Points</span>
          <span className="counter-value amber">{fmt(tick.qdrant.points)}</span>
        </div>
      </div>

      <div className="status-cluster">
        <Sparkline values={tick.sparkline.length > 1 ? tick.sparkline : [0, 0, 0, 0, 0]} />
        <div className="service">
          <span className={`dot ${dotState}`} />
          Postgres
        </div>
        <div className="service">
          <span className={`dot ${dotState}`} />
          Qdrant
        </div>
      </div>
    </motion.header>
  );
}
