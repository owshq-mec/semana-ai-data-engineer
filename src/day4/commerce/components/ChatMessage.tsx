"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatMessage, ChatToolCall, VectorHit } from "../lib/concierge";
import { AGENT_DISPLAY, type AgentKey } from "../lib/types";

const HINTS: Record<AgentKey, string[]> = {
  analyst: [
    "Abrindo o Ledger",
    "Escrevendo a query SQL",
    "Executando no Postgres",
    "Interpretando os números",
  ],
  researcher: [
    "Embedando a pergunta",
    "Buscando na Memória",
    "Lendo reviews relevantes",
    "Identificando temas",
  ],
  reporter: [
    "Consolidando métricas",
    "Extraindo citações de clientes",
    "Redigindo recomendações",
    "Finalizando o veredito",
  ],
};

function ThinkingHint({ agent }: { agent: AgentKey }) {
  const hints = HINTS[agent];
  const [i, setI] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setI((x) => (x + 1) % hints.length), 3500);
    return () => clearInterval(timer);
  }, [hints.length]);
  return (
    <span className="thinking-hint" key={i}>
      {hints[i]}
    </span>
  );
}

export default function ChatMessageBubble({ message }: { message: ChatMessage }) {
  if (message.kind === "user") {
    return (
      <div className="chat-row user">
        <div className="chat-bubble user-bubble">
          <span className="chat-author">Você</span>
          <p>{message.text}</p>
        </div>
      </div>
    );
  }

  const meta = AGENT_DISPLAY[message.agent];
  const variant = message.agent;
  const statusLabel =
    message.status === "running"
      ? "pensando"
      : message.status === "error"
      ? "erro"
      : `${(message.durationMs / 1000).toFixed(1)}s`;

  return (
    <div className="chat-row agent">
      <div className={`chat-bubble agent-bubble agent-${variant}`} data-status={message.status}>
        <div className="chat-author-row">
          <span className="chat-avatar" aria-hidden>
            {variant === "analyst" && "L"}
            {variant === "researcher" && "M"}
            {variant === "reporter" && "R"}
          </span>
          <span className="chat-author">
            <strong>{meta.name}</strong>
            <em>{meta.label}</em>
          </span>
          <span className="chat-status">
            {message.status === "running" ? <span className="loading-ellipsis">{statusLabel}</span> : statusLabel}
          </span>
        </div>

        {message.tools.length > 0 && (
          <div className="chat-tools">
            {message.tools.map((t, i) => (
              <ChatToolPill key={`${t.tool}-${i}`} tool={t} />
            ))}
          </div>
        )}

        {message.text ? (
          <div className={`chat-editorial ${message.agent === "reporter" ? "" : "chat-editorial-compact"}`}>
            {renderMarkdown(message.text)}
          </div>
        ) : message.status === "running" ? (
          <p className="chat-placeholder">
            <ThinkingHint agent={message.agent} />
            <span className="loading-ellipsis" />
          </p>
        ) : null}
      </div>
    </div>
  );
}

function ChatToolPill({ tool }: { tool: ChatToolCall }) {
  const isSQL = tool.tool === "supabase_execute_sql";
  const running = !tool.preview && !tool.hits;

  return (
    <div className="chat-tool">
      <div className="chat-tool-head">
        <span className="chat-tool-label">
          <strong>{isSQL ? "sql" : "vector"}</strong>
        </span>
        <span className="chat-tool-meta">
          {running ? (
            <span className="loading-ellipsis">running</span>
          ) : (
            <>
              {tool.latency_ms !== undefined && <span>{tool.latency_ms} ms</span>}
              {tool.rows !== undefined && (
                <span>
                  {tool.rows} {isSQL ? "row" : "hit"}
                  {tool.rows === 1 ? "" : "s"}
                </span>
              )}
              {tool.embed_ms !== undefined && <span>embed {tool.embed_ms}ms</span>}
            </>
          )}
        </span>
      </div>

      {isSQL ? (
        <>
          <pre className="chat-tool-code">{highlightSQL(tool.input)}</pre>
          {tool.preview && <SQLResultTable preview={tool.preview} />}
        </>
      ) : (
        <>
          <div className="chat-tool-query" aria-label="Semantic search query">
            “{tool.input}”
          </div>
          {tool.hits && tool.hits.length > 0 ? (
            <VectorHits hits={tool.hits} />
          ) : tool.preview ? (
            <ParsedVectorHits preview={tool.preview} scores={tool.top_scores} />
          ) : null}
        </>
      )}
    </div>
  );
}

// ---------- SQL rendering ----------

function SQLResultTable({ preview }: { preview: string }) {
  const lines = preview.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;
  const headers = lines[0].split("|").map((s) => s.trim());
  const rows = lines.slice(1).map((line) => line.split("|").map((s) => s.trim()));

  if (headers.length === 0 || rows.length === 0) {
    return <div className="chat-tool-result-empty">sem linhas retornadas</div>;
  }

  const visibleRows = rows.slice(0, 8);
  const extra = rows.length - visibleRows.length;

  return (
    <div className="chat-tool-table-wrap">
      <table className="chat-tool-table">
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={`${h}-${i}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visibleRows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => {
                const header = headers[j] || "";
                const f = formatCell(cell, header);
                return (
                  <td key={j} className={f.isNum ? "num" : undefined} title={f.title}>
                    {f.display}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {extra > 0 && (
        <div className="chat-tool-table-more">+{extra} linha{extra === 1 ? "" : "s"} omitida{extra === 1 ? "" : "s"}</div>
      )}
    </div>
  );
}

function formatCell(value: string, column: string): { display: string; isNum: boolean; title?: string } {
  if (!value) return { display: "—", isNum: false };
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-/i.test(value)) {
    return { display: value.slice(0, 8) + "…", isNum: false, title: value };
  }
  const n = Number(value);
  if (!Number.isNaN(n) && value !== "") {
    const lower = column.toLowerCase();
    if (/(price|revenue|total|faturamento|receita)/.test(lower)) {
      return {
        display: n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
        isNum: true,
      };
    }
    if (/(pct|percent|taxa|rate)/.test(lower)) {
      return { display: n.toFixed(1) + "%", isNum: true };
    }
    return { display: n.toLocaleString("pt-BR"), isNum: true };
  }
  return value.length > 36 ? { display: value.slice(0, 36) + "…", isNum: false, title: value } : { display: value, isNum: false };
}

function highlightSQL(sql: string): React.ReactNode[] {
  const KEYWORDS = /\b(SELECT|FROM|WHERE|GROUP BY|ORDER BY|LIMIT|JOIN|LEFT|RIGHT|INNER|OUTER|ON|AND|OR|AS|IN|NOT|NULL|IS|COUNT|SUM|AVG|MAX|MIN|ROUND|CAST|CASE|WHEN|THEN|ELSE|END|DISTINCT|HAVING|INTERVAL|NOW|DATE_TRUNC|EXTRACT|DESC|ASC|BETWEEN|LIKE|ILIKE|COALESCE)\b/gi;
  const LIT = /'([^']*)'|\b(\d+(?:\.\d+)?)\b/g;
  const marked = sql
    .replace(KEYWORDS, "\u0001K\u0001$&\u0001E\u0001")
    .replace(LIT, "\u0001L\u0001$&\u0001E\u0001");
  const parts = marked.split(/\u0001/);
  const out: React.ReactNode[] = [];
  for (let i = 0; i < parts.length; i += 1) {
    const p = parts[i];
    if (p === "K") {
      out.push(
        <span className="kw" key={i}>
          {parts[i + 1]}
        </span>,
      );
      i += 2;
    } else if (p === "L") {
      out.push(
        <span className="lit" key={i}>
          {parts[i + 1]}
        </span>,
      );
      i += 2;
    } else if (p === "E") {
      continue;
    } else if (p.length > 0) {
      out.push(<span key={i}>{p}</span>);
    }
  }
  return out;
}

// ---------- Vector rendering ----------

function VectorHits({ hits }: { hits: VectorHit[] }) {
  const top = hits.slice(0, 4);
  return (
    <div className="chat-hits">
      {top.map((hit, i) => (
        <HitCard key={i} hit={hit} rank={i + 1} />
      ))}
      {hits.length > top.length && (
        <div className="chat-tool-table-more">+{hits.length - top.length} hits adicionais</div>
      )}
    </div>
  );
}

function ParsedVectorHits({ preview, scores }: { preview: string; scores?: number[] }) {
  // Fallback parser for "[score=X | rating=R | sentiment] comment"
  const lines = preview.split("\n").filter(Boolean).slice(0, 4);
  const hits: VectorHit[] = lines.map((line, i) => {
    const m = line.match(/\[score=([\d.]+)\s*\|\s*rating=(\S+?)\s*\|\s*(\w+)\]\s*(.*)/);
    if (m) {
      return { score: Number(m[1]), rating: m[2], sentiment: m[3], comment: m[4] };
    }
    return { score: scores?.[i] ?? 0, comment: line };
  });
  return <VectorHits hits={hits} />;
}

function HitCard({ hit, rank }: { hit: VectorHit; rank: number }) {
  const sentiment = (hit.sentiment ?? "").toLowerCase();
  const rating = typeof hit.rating === "string" ? Number(hit.rating) : hit.rating;
  const stars =
    typeof rating === "number" && !Number.isNaN(rating) && rating >= 0 && rating <= 5
      ? "★".repeat(Math.round(rating)) + "☆".repeat(5 - Math.round(rating))
      : null;

  return (
    <div className="chat-hit" data-sentiment={sentiment || "unknown"}>
      <div className="chat-hit-meta">
        <span className="chat-hit-rank">#{rank}</span>
        <span className="chat-hit-score">{hit.score.toFixed(2)}</span>
        {stars && <span className="chat-hit-stars" aria-label={`rating ${rating}`}>{stars}</span>}
        {hit.sentiment && <span className="chat-hit-sentiment">{hit.sentiment}</span>}
      </div>
      {hit.comment && <div className="chat-hit-comment">{truncate(hit.comment, 200)}</div>}
    </div>
  );
}

// ---------- Shared helpers ----------

function truncate(text: string, cap: number): string {
  if (text.length <= cap) return text;
  return text.slice(0, cap).replace(/\s+\S*$/, "") + "…";
}

function renderMarkdown(raw: string): React.ReactNode {
  // Clean up common LLM quirks: stray "**" wrapping headings, leftover triple-dash sections
  const cleaned = raw
    .replace(/^\*\*(#{1,6}\s[^*]+)\*\*/gm, "$1")
    .replace(/^\*\*\s*$/gm, "")
    .trim();

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => <h3>{children}</h3>,
        h2: ({ children }) => <h4>{children}</h4>,
        h3: ({ children }) => <h5>{children}</h5>,
        h4: ({ children }) => <h5>{children}</h5>,
        h5: ({ children }) => <h5>{children}</h5>,
        h6: ({ children }) => <h5>{children}</h5>,
        hr: () => <hr className="chat-editorial-hr" />,
        strong: ({ children }) => <strong className="chat-editorial-strong">{children}</strong>,
        em: ({ children }) => <em className="chat-editorial-em">{children}</em>,
        blockquote: ({ children }) => (
          <blockquote className="chat-editorial-quote">{children}</blockquote>
        ),
        code: ({ className, children }) => {
          const isBlock = Boolean(className);
          if (isBlock) {
            return <code className="chat-editorial-code-block">{children}</code>;
          }
          return <code className="chat-editorial-code-inline">{children}</code>;
        },
        pre: ({ children }) => <pre className="chat-editorial-pre">{children}</pre>,
        table: ({ children }) => (
          <div className="chat-editorial-table-wrap">
            <table className="chat-editorial-table">{children}</table>
          </div>
        ),
        thead: ({ children }) => <thead>{children}</thead>,
        tbody: ({ children }) => <tbody>{children}</tbody>,
        tr: ({ children }) => <tr>{children}</tr>,
        th: ({ children }) => <th>{children}</th>,
        td: ({ children }) => {
          const text = extractText(children);
          const numeric = /^[R$\s€£]*[\d.,%]+[a-zA-Zá-ú\s]*$/.test(text.trim()) && /\d/.test(text);
          return <td className={numeric ? "num" : undefined}>{children}</td>;
        },
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noreferrer" className="chat-editorial-link">
            {children}
          </a>
        ),
      }}
    >
      {cleaned}
    </ReactMarkdown>
  );
}

function extractText(node: React.ReactNode): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (node && typeof node === "object" && "props" in node) {
    const p = (node as { props?: { children?: React.ReactNode } }).props;
    return extractText(p?.children ?? "");
  }
  return "";
}
