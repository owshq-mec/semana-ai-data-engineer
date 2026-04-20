"use client";

import { useMemo } from "react";
import type { ChatMessage } from "../lib/concierge";
import { AGENT_ORDER, type AgentKey } from "../lib/types";

interface Props {
  turnMessages: ChatMessage[];
  running: boolean;
}

interface AgentSnapshot {
  agent: AgentKey;
  status: "idle" | "running" | "complete" | "error";
  durationMs: number;
  toolCount: number;
  latencyMs: number;
  rows: number;
  scores: number[];
}

const NODE_POSITIONS: Record<string, { x: number; y: number }> = {
  question: { x: 80, y: 110 },
  analyst: { x: 330, y: 110 },
  ledger: { x: 330, y: 280 },
  researcher: { x: 600, y: 110 },
  memory: { x: 600, y: 280 },
  reporter: { x: 870, y: 110 },
  verdict: { x: 1120, y: 110 },
};

const LABEL: Record<AgentKey, string> = {
  analyst: "Analyst",
  researcher: "Research",
  reporter: "Reporter",
};

const SOURCE: Record<AgentKey, string> = {
  analyst: "The Ledger",
  researcher: "The Memory",
  reporter: "Synthesis",
};

function snapshot(turnMessages: ChatMessage[]): Record<AgentKey, AgentSnapshot> {
  const out = {} as Record<AgentKey, AgentSnapshot>;
  for (const key of AGENT_ORDER) {
    const msg = turnMessages.find((m) => m.kind === "agent" && m.agent === key);
    if (!msg || msg.kind !== "agent") {
      out[key] = { agent: key, status: "idle", durationMs: 0, toolCount: 0, latencyMs: 0, rows: 0, scores: [] };
      continue;
    }
    let latencyMs = 0;
    let rows = 0;
    const scores: number[] = [];
    for (const t of msg.tools) {
      latencyMs += t.latency_ms ?? 0;
      rows += t.rows ?? 0;
      if (t.top_scores) scores.push(...t.top_scores);
    }
    out[key] = {
      agent: key,
      status: msg.status,
      durationMs: msg.durationMs,
      toolCount: msg.tools.length,
      latencyMs,
      rows,
      scores,
    };
  }
  return out;
}

export default function FlowDiagram({ turnMessages, running }: Props) {
  const snap = useMemo(() => snapshot(turnMessages), [turnMessages]);
  const question = turnMessages.find((m) => m.kind === "user");
  const questionPresent = Boolean(question);
  const finalReport = turnMessages.find((m) => m.kind === "agent" && m.agent === "reporter" && m.text);
  const hasVerdict = Boolean(finalReport);

  const nodeState = (key: "question" | AgentKey | "ledger" | "memory" | "verdict"): string => {
    if (key === "question") return questionPresent ? "complete" : "idle";
    if (key === "verdict") return hasVerdict ? "complete" : snap.reporter.status === "running" ? "running" : "idle";
    if (key === "ledger") return snap.analyst.toolCount > 0 ? (snap.analyst.status === "running" ? "running" : "complete") : "idle";
    if (key === "memory") return snap.researcher.toolCount > 0 ? (snap.researcher.status === "running" ? "running" : "complete") : "idle";
    return snap[key as AgentKey].status;
  };

  const edgeClass = (from: string, to: string): string => {
    const states = [nodeState(from as any), nodeState(to as any)];
    if (states.every((s) => s === "complete")) return "flow-edge complete";
    if (states.some((s) => s === "running")) return "flow-edge active";
    return "flow-edge";
  };

  return (
    <section className="flow-diagram" aria-label="Fluxo em tempo real dos agentes">
      <div className="flow-legend">
        <span className="flow-legend-dot state-idle" /> idle
        <span className="flow-legend-dot state-running" /> ativo
        <span className="flow-legend-dot state-complete" /> completo
      </div>
      <svg viewBox="0 0 1240 400" preserveAspectRatio="xMidYMid meet" className="flow-svg">
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
          </marker>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Edges (draw first so nodes cover ends cleanly) */}
        <g className="flow-edges">
          <Edge from="question" to="analyst" className={edgeClass("question", "analyst")} />
          <Edge from="analyst" to="researcher" className={edgeClass("analyst", "researcher")} />
          <Edge from="researcher" to="reporter" className={edgeClass("researcher", "reporter")} />
          <Edge from="reporter" to="verdict" className={edgeClass("reporter", "verdict")} />

          <Edge from="analyst" to="ledger" bidirectional className={`${edgeClass("analyst", "ledger")} branch`} />
          <Edge from="researcher" to="memory" bidirectional className={`${edgeClass("researcher", "memory")} branch`} />
        </g>

        {/* Tool packets traveling along branches */}
        {running && snap.analyst.status === "running" && snap.analyst.toolCount > 0 && (
          <Packet from="analyst" to="ledger" color="var(--sage)" />
        )}
        {running && snap.researcher.status === "running" && snap.researcher.toolCount > 0 && (
          <Packet from="researcher" to="memory" color="var(--bronze)" />
        )}

        {/* Nodes */}
        <Node
          id="question"
          pos={NODE_POSITIONS.question}
          state={nodeState("question")}
          label="Pergunta"
          sub={question?.kind === "user" ? truncate(question.text, 36) : "aguardando"}
          shape="round"
        />
        <Node
          id="analyst"
          pos={NODE_POSITIONS.analyst}
          state={nodeState("analyst")}
          label={LABEL.analyst}
          sub={SOURCE.analyst}
          annotation={annotationFor(snap.analyst, "sql")}
        />
        <Node
          id="ledger"
          pos={NODE_POSITIONS.ledger}
          state={nodeState("ledger")}
          label="The Ledger"
          sub="postgres"
          shape="store"
          annotation={snap.analyst.rows > 0 ? `${snap.analyst.rows} rows` : undefined}
        />
        <Node
          id="researcher"
          pos={NODE_POSITIONS.researcher}
          state={nodeState("researcher")}
          label={LABEL.researcher}
          sub={SOURCE.researcher}
          annotation={annotationFor(snap.researcher, "vec")}
        />
        <Node
          id="memory"
          pos={NODE_POSITIONS.memory}
          state={nodeState("memory")}
          label="The Memory"
          sub="qdrant"
          shape="store"
          annotation={snap.researcher.scores.length > 0 ? `${snap.researcher.scores.length} hits` : undefined}
        />
        <Node
          id="reporter"
          pos={NODE_POSITIONS.reporter}
          state={nodeState("reporter")}
          label={LABEL.reporter}
          sub={SOURCE.reporter}
          annotation={snap.reporter.durationMs > 0 ? `${(snap.reporter.durationMs / 1000).toFixed(1)}s` : undefined}
        />
        <Node
          id="verdict"
          pos={NODE_POSITIONS.verdict}
          state={nodeState("verdict")}
          label="Veredito"
          sub={hasVerdict ? "pronto" : "aguardando"}
          shape="round"
        />
      </svg>
    </section>
  );
}

function annotationFor(s: AgentSnapshot, kind: "sql" | "vec"): string | undefined {
  if (s.toolCount === 0) return undefined;
  const suffix = kind === "sql" ? "queries" : "searches";
  return `${s.toolCount} ${suffix} · ${s.latencyMs}ms`;
}

function truncate(text: string, n: number): string {
  if (text.length <= n) return text;
  return text.slice(0, n).replace(/\s+\S*$/, "") + "…";
}

interface NodeProps {
  id: string;
  pos: { x: number; y: number };
  state: string;
  label: string;
  sub: string;
  shape?: "rect" | "round" | "store";
  annotation?: string;
}

function Node({ pos, state, label, sub, shape = "rect", annotation }: NodeProps) {
  const w = 200;
  const h = 80;
  const x = pos.x - w / 2;
  const y = pos.y - h / 2;

  return (
    <g className={`flow-node state-${state} shape-${shape}`} transform={`translate(${x} ${y})`}>
      {shape === "round" ? (
        <rect x={0} y={0} width={w} height={h} rx={h / 2} ry={h / 2} className="flow-node-shape" />
      ) : shape === "store" ? (
        <path
          className="flow-node-shape"
          d={`M 0 10 Q 0 0 ${w / 2} 0 Q ${w} 0 ${w} 10 L ${w} ${h - 10} Q ${w} ${h} ${w / 2} ${h} Q 0 ${h} 0 ${h - 10} Z`}
        />
      ) : (
        <rect x={0} y={0} width={w} height={h} rx={12} ry={12} className="flow-node-shape" />
      )}
      <text x={w / 2} y={32} textAnchor="middle" className="flow-node-label">
        {label}
      </text>
      <text x={w / 2} y={54} textAnchor="middle" className="flow-node-sub">
        {sub}
      </text>
      {annotation && (
        <g transform={`translate(${w / 2} ${h + 18})`}>
          <text textAnchor="middle" className="flow-node-annotation">
            {annotation}
          </text>
        </g>
      )}
    </g>
  );
}

interface EdgeProps {
  from: string;
  to: string;
  className: string;
  bidirectional?: boolean;
}

function Edge({ from, to, className, bidirectional }: EdgeProps) {
  const a = NODE_POSITIONS[from];
  const b = NODE_POSITIONS[to];
  const halfW = 100;
  const halfH = 40;

  // Compute an offset start/end so the line doesn't go through node centers
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy) || 1;
  const ax = a.x + (dx / dist) * (Math.abs(dx) > Math.abs(dy) ? halfW : halfH);
  const ay = a.y + (dy / dist) * (Math.abs(dx) > Math.abs(dy) ? halfH : halfH);
  const bx = b.x - (dx / dist) * (Math.abs(dx) > Math.abs(dy) ? halfW : halfH);
  const by = b.y - (dy / dist) * (Math.abs(dx) > Math.abs(dy) ? halfH : halfH);

  return (
    <path
      className={className}
      d={`M ${ax} ${ay} L ${bx} ${by}`}
      markerEnd="url(#arrow)"
      markerStart={bidirectional ? "url(#arrow)" : undefined}
    />
  );
}

function Packet({ from, to, color }: { from: string; to: string; color: string }) {
  const a = NODE_POSITIONS[from];
  const b = NODE_POSITIONS[to];
  return (
    <circle className="flow-packet" r={5} fill={color} filter="url(#glow)">
      <animateMotion dur="2.2s" repeatCount="indefinite" path={`M ${a.x} ${a.y} L ${b.x} ${b.y} M ${b.x} ${b.y} L ${a.x} ${a.y}`} />
    </circle>
  );
}
