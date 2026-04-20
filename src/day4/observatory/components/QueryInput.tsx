"use client";

import { motion } from "motion/react";
import { useState } from "react";

const PRESETS = [
  "Qual o estado com maior receita e o que clientes reclamam la?",
  "Quais os 3 produtos mais vendidos e qual o sentimento dos reviews deles?",
  "Compare o ticket medio entre segmentos premium e basic com voz do cliente.",
];

export default function QueryInput({
  onSubmit,
  history,
  onReuse,
  running,
}: {
  onSubmit: (question: string) => void;
  history: string[];
  onReuse: (question: string) => void;
  running: boolean;
}) {
  const [text, setText] = useState("");

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed || running) return;
    onSubmit(trimmed);
  };

  return (
    <motion.aside
      className="rail"
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
    >
      <div>
        <div className="section-label">Pergunta ao Crew</div>
        <div className="query-card">
          <textarea
            className="query-input"
            placeholder="Ask the Ledger and the Memory..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
            }}
            disabled={running}
          />
          <div className="query-actions">
            <span className="hint">⌘ + Enter</span>
            <button
              className="btn"
              onClick={submit}
              disabled={running || text.trim().length === 0}
              aria-disabled={running || text.trim().length === 0}
            >
              {running ? "Pensando" : "Ask →"}
            </button>
          </div>
        </div>
      </div>

      <div>
        <div className="section-label">Presets</div>
        <ul className="history">
          {PRESETS.map((p) => (
            <li key={p} onClick={() => !running && setText(p)}>
              {p}
            </li>
          ))}
        </ul>
      </div>

      {history.length > 0 && (
        <div>
          <div className="section-label">Recentes</div>
          <ul className="history">
            {history.slice(-6).reverse().map((h, i) => (
              <li key={`${i}-${h.slice(0, 16)}`} onClick={() => !running && onReuse(h)}>
                {h}
              </li>
            ))}
          </ul>
        </div>
      )}
    </motion.aside>
  );
}
