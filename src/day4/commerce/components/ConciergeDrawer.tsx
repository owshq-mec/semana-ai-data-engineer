"use client";

import { useEffect, useMemo, useRef } from "react";
import ChatComposer from "./ChatComposer";
import ChatMessageBubble from "./ChatMessage";
import TurnProgress from "./TurnProgress";
import { useConcierge } from "../lib/concierge";

export default function ConciergeDrawer() {
  const { state, closePanel, clear } = useConcierge();
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [state.messages.length, state.running]);

  const waitingForFirstAgent = useMemo(() => {
    if (!state.running || !state.activeTurnId) return false;
    const hasAgentForTurn = state.messages.some(
      (m) => m.kind === "agent" && m.turnId === state.activeTurnId,
    );
    return !hasAgentForTurn;
  }, [state.running, state.activeTurnId, state.messages]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && state.open) closePanel();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [state.open, closePanel]);

  if (!state.open) return null;

  return (
    <>
      <div className="concierge-scrim" onClick={closePanel} aria-hidden />
      <aside className="concierge" role="dialog" aria-modal="true" aria-label="Concierge ShopAgent">
        <header className="concierge-head">
          <div className="concierge-title">
            <span className="eyebrow">Concierge · três agentes em serviço</span>
            <h2>
              Analyst <em>·</em> Research <em>·</em> Reporter
            </h2>
            {state.productContext && (
              <div className="concierge-context">
                contexto em tela: <strong>{state.productContext.name}</strong>
              </div>
            )}
          </div>
          <div className="concierge-head-actions">
            {state.messages.length > 0 && (
              <a
                href="/thread/current"
                target="_blank"
                rel="noreferrer"
                className="link-btn"
                aria-label="Abrir em nova aba"
              >
                Expandir ↗
              </a>
            )}
            {state.messages.length > 0 && (
              <button type="button" className="link-btn" onClick={clear} disabled={state.running}>
                limpar
              </button>
            )}
            <button type="button" className="link-btn" onClick={closePanel} aria-label="Fechar">
              Fechar ✕
            </button>
          </div>
        </header>

        {state.messages.length > 0 && (
          <TurnProgress
            messages={state.messages}
            activeTurnId={state.activeTurnId}
            running={state.running}
          />
        )}

        <div className="concierge-body" ref={scrollRef}>
          {state.messages.length === 0 && !state.running ? (
            <div className="concierge-empty">
              <p className="serif">
                Peça uma recomendação, compare produtos ou descreva uma ocasião. Os três agentes consultam dados reais e escutam clientes reais antes de responder.
              </p>
            </div>
          ) : (
            <>
              {state.messages.map((m) => <ChatMessageBubble key={m.id} message={m} />)}
              {waitingForFirstAgent && (
                <div className="chat-waiting" role="status" aria-live="polite">
                  <span className="chat-waiting-dots" aria-hidden>
                    <span /><span /><span />
                  </span>
                  <span>
                    Convocando o time — Analyst abrirá o Ledger em instantes.
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        <ChatComposer />
      </aside>
    </>
  );
}
