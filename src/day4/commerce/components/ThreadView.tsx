"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import ChatMessageBubble from "./ChatMessage";
import FlowDiagram from "./FlowDiagram";
import { readStoredMessages, type ChatMessage } from "../lib/concierge";
import { AGENT_ORDER } from "../lib/types";

const STORAGE_KEY = "shopagent.concierge.messages.v2";

export default function ThreadView() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const bodyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMessages(readStoredMessages());
  }, []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return;
      try {
        setMessages(JSON.parse(e.newValue) as ChatMessage[]);
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("storage", onStorage);
    // Also re-poll on interval in case localStorage events don't fire (same-tab edge cases)
    const poll = setInterval(() => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as ChatMessage[];
          setMessages((prev) => (prev.length !== parsed.length ? parsed : prev));
        }
      } catch {
        /* ignore */
      }
    }, 1000);
    return () => {
      window.removeEventListener("storage", onStorage);
      clearInterval(poll);
    };
  }, []);

  // Focus on the LATEST turn
  const latestTurn = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].kind === "user") return messages[i].turnId;
    }
    return null;
  }, [messages]);

  const turnMessages = useMemo(
    () => messages.filter((m) => m.turnId === latestTurn),
    [messages, latestTurn],
  );

  const question = useMemo(() => {
    const u = turnMessages.find((m) => m.kind === "user");
    return u?.kind === "user" ? u.text : "";
  }, [turnMessages]);

  const startedAt = useMemo(() => {
    const u = turnMessages.find((m) => m.kind === "user");
    return u?.ts ?? null;
  }, [turnMessages]);

  const running = useMemo(() => {
    return turnMessages.some((m) => m.kind === "agent" && m.status === "running");
  }, [turnMessages]);

  const anyAgent = turnMessages.some((m) => m.kind === "agent");
  const allDone =
    anyAgent && AGENT_ORDER.every((a) =>
      turnMessages.some((m) => m.kind === "agent" && m.agent === a && m.status === "complete"),
    );

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [running]);

  const elapsed = running && startedAt ? (now - startedAt) / 1000 : turnMessages.reduce((s, m) => s + (m.kind === "agent" ? m.durationMs : 0), 0) / 1000;

  const stats = useMemo(() => {
    let toolCount = 0;
    let rows = 0;
    let hits = 0;
    for (const m of turnMessages) {
      if (m.kind !== "agent") continue;
      for (const t of m.tools) {
        toolCount += 1;
        if (t.tool === "supabase_execute_sql") rows += t.rows ?? 0;
        if (t.tool === "qdrant_semantic_search") hits += t.rows ?? 0;
      }
    }
    return { toolCount, rows, hits };
  }, [turnMessages]);

  useEffect(() => {
    if (!bodyRef.current) return;
    bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [messages.length, running]);

  if (messages.length === 0) {
    return (
      <div className="thread-empty">
        <div>
          <h1 className="thread-empty-title">Nenhuma conversa ainda</h1>
          <p className="thread-empty-body">
            Volte ao <Link href="/">concept store</Link>, abra o Concierge e faça a primeira
            pergunta. Esta página acompanhará a conversa em tempo real.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="thread-shell">
      <header className="thread-header">
        <div className="thread-header-left">
          <Link href="/" className="thread-back" aria-label="Voltar ao concept store">
            ← ShopAgent
          </Link>
          <div className="thread-header-eyebrow">Thread · Concierge · Agentes em serviço</div>
          <h1 className="thread-question">{question || "Sem pergunta ativa"}</h1>
        </div>
        <div className="thread-header-stats">
          <div className="thread-stat">
            <small>Elapsed</small>
            <strong>{elapsed.toFixed(1)}s</strong>
          </div>
          <div className="thread-stat">
            <small>Tool calls</small>
            <strong>{stats.toolCount}</strong>
          </div>
          <div className="thread-stat">
            <small>Ledger rows</small>
            <strong>{stats.rows}</strong>
          </div>
          <div className="thread-stat">
            <small>Memory hits</small>
            <strong>{stats.hits}</strong>
          </div>
          <div className={`thread-stat ${allDone ? "signal-complete" : running ? "signal-live" : ""}`}>
            <small>Status</small>
            <strong>{running ? "ao vivo" : allDone ? "completo" : "aguardando"}</strong>
          </div>
        </div>
      </header>

      <FlowDiagram turnMessages={turnMessages} running={running} />

      <main className="thread-body" ref={bodyRef}>
        <div className="thread-messages">
          {turnMessages.map((m) => (
            <ChatMessageBubble key={m.id} message={m} />
          ))}
        </div>
      </main>
    </div>
  );
}
