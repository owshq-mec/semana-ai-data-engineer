"use client";

import { useEffect, useState } from "react";
import type { ChatMessage } from "../lib/concierge";
import { AGENT_DISPLAY, AGENT_ORDER, type AgentKey } from "../lib/types";

interface Props {
  messages: ChatMessage[];
  activeTurnId: string | null;
  running: boolean;
}

interface PhaseSnapshot {
  agent: AgentKey;
  status: "idle" | "running" | "complete" | "error";
  durationMs: number;
}

function snapshot(messages: ChatMessage[], turnId: string): { phases: PhaseSnapshot[]; startedAt: number | null } {
  const turn = messages.filter((m) => m.turnId === turnId);
  const user = turn.find((m) => m.kind === "user");
  const phases: PhaseSnapshot[] = AGENT_ORDER.map((key) => {
    const agentMsg = turn.find((m) => m.kind === "agent" && m.agent === key);
    if (!agentMsg || agentMsg.kind !== "agent") {
      return { agent: key, status: "idle", durationMs: 0 };
    }
    return { agent: key, status: agentMsg.status, durationMs: agentMsg.durationMs };
  });
  return { phases, startedAt: user?.ts ?? null };
}

export default function TurnProgress({ messages, activeTurnId, running }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [running]);

  // Show for active turn, or latest completed turn if none active
  const turnId =
    activeTurnId ??
    (() => {
      for (let i = messages.length - 1; i >= 0; i -= 1) {
        if (messages[i].kind === "user") return messages[i].turnId;
      }
      return null;
    })();

  if (!turnId) return null;
  const { phases, startedAt } = snapshot(messages, turnId);
  if (!startedAt) return null;

  const elapsed = running ? (now - startedAt) / 1000 : phases.reduce((s, p) => s + p.durationMs, 0) / 1000;

  return (
    <div className="turn-progress" aria-label="Progresso da consulta">
      <ol className="turn-progress-steps">
        {phases.map((phase, idx) => {
          const label = AGENT_DISPLAY[phase.agent].name;
          const isActive = phase.status === "running";
          return (
            <li key={phase.agent} className={`turn-progress-step state-${phase.status}`}>
              <span className="turn-progress-dot" aria-hidden />
              <span className="turn-progress-label">
                <strong>{label}</strong>
                <small>
                  {phase.status === "complete" && `${(phase.durationMs / 1000).toFixed(1)}s`}
                  {phase.status === "running" && <span className="loading-ellipsis">pensando</span>}
                  {phase.status === "idle" && (idx === 0 ? "pronto" : "aguardando")}
                  {phase.status === "error" && "erro"}
                </small>
              </span>
              {idx < phases.length - 1 && (
                <span className={`turn-progress-connector ${isActive ? "live" : ""}`} aria-hidden />
              )}
            </li>
          );
        })}
      </ol>
      <span className="turn-progress-elapsed">
        <strong>{elapsed.toFixed(1)}s</strong>
        <small>{running ? "ao vivo" : "total"}</small>
      </span>
    </div>
  );
}
