"use client";

import { AnimatePresence, motion } from "motion/react";

import type { ToolInvocation } from "../lib/types";

function highlightSQL(sql: string): React.ReactNode[] {
  const kw = /\b(SELECT|FROM|WHERE|GROUP BY|ORDER BY|LIMIT|JOIN|LEFT|RIGHT|INNER|OUTER|ON|AND|OR|AS|IN|NOT|NULL|IS|COUNT|SUM|AVG|MAX|MIN|CAST|CASE|WHEN|THEN|ELSE|END|DISTINCT|HAVING|INTERVAL|NOW|DATE_TRUNC|EXTRACT|DESC|ASC|BETWEEN|LIKE)\b/gi;
  const lit = /'([^']*)'|\b(\d+(?:\.\d+)?)\b/g;
  const out: React.ReactNode[] = [];
  let idx = 0;
  const marked = sql.replace(kw, (m) => `\u0001K\u0001${m}\u0001E\u0001`).replace(lit, (m) => `\u0001L\u0001${m}\u0001E\u0001`);
  const parts = marked.split(/\u0001/);
  for (let i = 0; i < parts.length; i += 1) {
    const p = parts[i];
    if (p === "K") {
      const next = parts[i + 1];
      out.push(<span key={idx++} className="kw">{next}</span>);
      i += 2;
    } else if (p === "L") {
      const next = parts[i + 1];
      out.push(<span key={idx++} className="lit">{next}</span>);
      i += 2;
    } else if (p === "E") {
      continue;
    } else if (p.length > 0) {
      out.push(<span key={idx++}>{p}</span>);
    }
  }
  return out;
}

function ScoreBars({ scores }: { scores: number[] }) {
  const max = Math.max(...scores, 0.0001);
  return (
    <div className="scores">
      {scores.map((s, i) => (
        <div className="score-row" key={`${s}-${i}`}>
          <span>#{i + 1}</span>
          <div className="score-bar">
            <span style={{ width: `${(s / max) * 100}%` }} />
          </div>
          <span>{s.toFixed(3)}</span>
        </div>
      ))}
    </div>
  );
}

export default function ToolPanel({ invocation }: { invocation: ToolInvocation }) {
  const { tool, input, result, error } = invocation;
  const isSQL = tool === "supabase_execute_sql";
  const pending = !result && !error;

  return (
    <motion.div
      className="tool"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      layout
    >
      <div className="tool-head">
        <span className="tool-title">
          {isSQL ? "supabase_execute_sql" : "qdrant_semantic_search"}
        </span>
        <div className="tool-meta">
          {pending && <span className="loading-dots">running</span>}
          {result && <span>rows · {result.rows}</span>}
          {result && <span>{result.latency_ms} ms</span>}
          {error && <span style={{ color: "var(--danger)" }}>error</span>}
        </div>
      </div>
      <div className="tool-body">
        <div className="tool-code">{isSQL ? highlightSQL(input) : input}</div>
        <AnimatePresence>
          {result && (
            <motion.div
              className="tool-result"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              key="res"
            >
              {isSQL ? (
                <pre style={{ margin: 0, fontFamily: "inherit", whiteSpace: "pre-wrap" }}>
                  {result.preview}
                </pre>
              ) : (
                <>
                  {result.top_scores && result.top_scores.length > 0 && (
                    <ScoreBars scores={result.top_scores} />
                  )}
                  <div style={{ marginTop: 10 }}>{result.preview}</div>
                </>
              )}
            </motion.div>
          )}
          {error && (
            <motion.div
              className="tool-result"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              key="err"
              style={{ color: "var(--danger)" }}
            >
              {error.error}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
