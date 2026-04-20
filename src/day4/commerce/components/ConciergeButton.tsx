"use client";

import { useConcierge } from "../lib/concierge";

export default function ConciergeButton() {
  const { state, togglePanel } = useConcierge();
  const lastUserMsg = [...state.messages].reverse().find((m) => m.kind === "user");
  return (
    <button
      type="button"
      className="concierge-fab"
      onClick={togglePanel}
      aria-label={state.open ? "Fechar concierge" : "Abrir concierge"}
      data-open={state.open ? "true" : "false"}
      data-running={state.running ? "true" : "false"}
    >
      <span className="concierge-fab-label">
        <em>Concierge</em>
        <small>{state.running ? "pensando" : state.messages.length > 0 ? "conversa ativa" : "fale com os três"}</small>
      </span>
      <span className="concierge-fab-mark" aria-hidden>
        {state.running ? "…" : state.open ? "×" : "→"}
      </span>
      {!state.open && state.running && <span className="concierge-fab-pulse" aria-hidden />}
      {!state.open && lastUserMsg && !state.running && state.messages.some((m) => m.kind === "user") && (
        <span className="concierge-fab-dot" aria-hidden />
      )}
    </button>
  );
}
