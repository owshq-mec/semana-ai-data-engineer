"use client";

import { useEffect, useRef, useState } from "react";
import { useConcierge } from "../lib/concierge";

const SUGGESTIONS = [
  "Me recomende algo em torno de R$ 300 com bom feedback.",
  "Qual a categoria com o melhor sentimento em reviews?",
  "Compare os dois bags mais vendidos.",
];

export default function ChatComposer() {
  const { state, sendMessage } = useConcierge();
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!state.running && state.open) {
      textareaRef.current?.focus();
    }
  }, [state.running, state.open]);

  const submit = () => {
    const text = value.trim();
    if (!text || state.running) return;
    sendMessage(text);
    setValue("");
  };

  return (
    <div className="composer">
      {state.messages.length === 0 && !state.running && (
        <div className="composer-suggestions">
          {SUGGESTIONS.map((s) => (
            <button key={s} type="button" className="composer-chip" onClick={() => sendMessage(s)}>
              {s}
            </button>
          ))}
        </div>
      )}
      <div className="composer-box">
        <textarea
          ref={textareaRef}
          className="composer-input"
          placeholder={
            state.productContext
              ? `Pergunte sobre "${state.productContext.name}" ou qualquer outro produto…`
              : "Fale com o concierge — procure um objeto, um sentimento, um orçamento…"
          }
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          disabled={state.running}
          rows={2}
        />
        <button
          type="button"
          className="composer-send"
          onClick={submit}
          disabled={state.running || value.trim().length === 0}
          aria-label="Enviar"
        >
          {state.running ? <span className="loading-ellipsis">pensando</span> : "Enviar →"}
        </button>
      </div>
      <div className="composer-hint">
        Enter para enviar · Shift + Enter para quebra · Os três agentes respondem como time
      </div>
    </div>
  );
}
