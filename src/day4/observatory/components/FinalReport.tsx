"use client";

import { motion } from "motion/react";

function renderReport(raw: string): React.ReactNode {
  const blocks = raw.split(/\n\s*\n/);
  return blocks.map((block, idx) => {
    const trimmed = block.trim();
    if (!trimmed) return null;
    const m1 = trimmed.match(/^#\s+(.*)$/);
    if (m1) return <h1 key={idx}>{m1[1]}</h1>;
    const m2 = trimmed.match(/^##\s+(.*)$/);
    if (m2) return <h2 key={idx}>{m2[1]}</h2>;
    const m3 = trimmed.match(/^###?\s+(.*)$/);
    if (m3) return <h3 key={idx}>{m3[1]}</h3>;
    const bulletMatch = trimmed.match(/^(?:[-*]\s+.+\n?)+$/);
    if (bulletMatch) {
      const items = trimmed.split(/\n/).map((l) => l.replace(/^[-*]\s+/, "")).filter(Boolean);
      return (
        <ul key={idx} style={{ paddingLeft: 20, margin: "6px 0" }}>
          {items.map((it, i) => (
            <li key={i}>{it}</li>
          ))}
        </ul>
      );
    }
    return <p key={idx}>{trimmed}</p>;
  });
}

export default function FinalReport({
  report,
  durationMs,
  running,
}: {
  report: string;
  durationMs: number;
  running: boolean;
}) {
  if (!report) {
    return (
      <motion.section
        className="report"
        initial={{ opacity: 0, x: 12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay: 0.16, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="section-label">Relatorio Executivo</div>
        <div className="report-empty">
          {running
            ? "O Reporter vai sintetizar o Ledger e a Memory assim que Analyst e Research entregarem."
            : "Faca uma pergunta a esquerda. O relatorio executivo aparece aqui — metricas, voz do cliente, recomendacoes."}
        </div>
      </motion.section>
    );
  }

  return (
    <motion.section
      className="report"
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="section-label" style={{ display: "flex", justifyContent: "space-between" }}>
        <span>Relatorio Executivo</span>
        <span style={{ color: "var(--amber)" }}>{(durationMs / 1000).toFixed(1)}s · synthesized</span>
      </div>
      <motion.article
        className="report-card"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
      >
        {renderReport(report)}
      </motion.article>
    </motion.section>
  );
}
