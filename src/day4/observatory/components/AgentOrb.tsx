"use client";

import { motion } from "motion/react";

import { AGENT_LABELS, type AgentState } from "../lib/types";
import ToolPanel from "./ToolPanel";

export default function AgentOrb({ agent, order, active }: { agent: AgentState; order: number; active: boolean }) {
  const meta = AGENT_LABELS[agent.name];
  const status = agent.status;

  return (
    <motion.article
      className="orb"
      data-status={status}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.12 + order * 0.08, ease: [0.22, 1, 0.36, 1] }}
      layout
    >
      <header className="orb-header">
        <div>
          <div className="orb-role">
            {String(order + 1).padStart(2, "0")} · {meta.role}
          </div>
          <h2 className="orb-name">{meta.name}Agent</h2>
          <div className="orb-role" style={{ marginTop: 4 }}>
            {meta.store}
          </div>
        </div>
        <span className="orb-status" data-status={status}>
          {status === "idle" && "awaiting"}
          {status === "active" && <><span className="loading-dots">thinking</span></>}
          {status === "complete" && "delivered"}
          {status === "error" && "error"}
        </span>
      </header>

      <div className="orb-body">
        {agent.tools.length === 0 && status === "idle" && (
          <div className="orb-idle">
            {order === 0
              ? "Aguardando uma pergunta..."
              : "Aguardando o handoff do agente anterior."}
          </div>
        )}

        {agent.tools.length > 0 && (
          <div className="tools">
            {agent.tools.map((t) => (
              <ToolPanel key={t.key} invocation={t} />
            ))}
          </div>
        )}

        {status === "complete" && agent.preview && (
          <motion.div
            className="orb-preview"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            {truncatePreview(agent.preview)}
          </motion.div>
        )}

        {status === "complete" && (
          <div className="orb-meta">
            <span className="pill signal">{agent.durationMs} ms</span>
            <span className="pill">{agent.tools.length} tool{agent.tools.length === 1 ? "" : "s"}</span>
          </div>
        )}
        {status === "idle" && order > 0 && (
          <div className="orb-meta">
            <span className="pill">awaiting handoff</span>
          </div>
        )}
      </div>
    </motion.article>
  );
}

function truncatePreview(text: string): string {
  const cap = 420;
  if (text.length <= cap) return text;
  return text.slice(0, cap).replace(/\s+\S*$/, "") + "…";
}
