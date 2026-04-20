"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { AgentKey } from "./types";

export interface ProductContext {
  product_id: string;
  name: string;
  brand: string;
  category: string;
  price: number;
}

export interface VectorHit {
  score: number;
  rating?: number | string;
  sentiment?: string;
  comment?: string;
  order_id?: string;
}

export interface ChatToolCall {
  tool: string;
  input: string;
  preview?: string;
  rows?: number;
  columns?: string[];
  latency_ms?: number;
  embed_ms?: number;
  search_ms?: number;
  top_scores?: number[];
  hits?: VectorHit[];
}

export type ChatMessage =
  | {
      kind: "user";
      id: string;
      turnId: string;
      text: string;
      ts: number;
    }
  | {
      kind: "agent";
      id: string;
      turnId: string;
      agent: AgentKey;
      status: "running" | "complete" | "error";
      text: string;
      tools: ChatToolCall[];
      durationMs: number;
      ts: number;
    };

interface ConciergeState {
  open: boolean;
  running: boolean;
  messages: ChatMessage[];
  activeTurnId: string | null;
  productContext: ProductContext | null;
}

interface ConciergeApi {
  state: ConciergeState;
  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;
  setProductContext: (ctx: ProductContext | null) => void;
  sendMessage: (text: string) => void;
  openAndAsk: (text: string, ctx?: ProductContext | null) => void;
  clear: () => void;
}

const Ctx = createContext<ConciergeApi | null>(null);

const STORAGE_KEY = "shopagent.concierge.messages.v2";

function loadInitialMessages(): ChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ChatMessage[];
  } catch {
    return [];
  }
}

export function readStoredMessages(): ChatMessage[] {
  return loadInitialMessages();
}

export function ConciergeProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ConciergeState>({
    open: false,
    running: false,
    messages: [],
    activeTurnId: null,
    productContext: null,
  });
  const sourceRef = useRef<EventSource | null>(null);
  const hydrated = useRef(false);

  useEffect(() => {
    setState((s) => ({ ...s, messages: loadInitialMessages() }));
    hydrated.current = true;
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.messages));
    } catch {
      /* ignore */
    }
  }, [state.messages]);

  // Listen for cross-tab localStorage updates so thread view stays in sync
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return;
      try {
        const next = JSON.parse(e.newValue) as ChatMessage[];
        setState((s) => ({ ...s, messages: next }));
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const openPanel = useCallback(() => setState((s) => ({ ...s, open: true })), []);
  const closePanel = useCallback(() => setState((s) => ({ ...s, open: false })), []);
  const togglePanel = useCallback(() => setState((s) => ({ ...s, open: !s.open })), []);
  const setProductContext = useCallback(
    (ctx: ProductContext | null) => setState((s) => ({ ...s, productContext: ctx })),
    [],
  );
  const clear = useCallback(() => {
    sourceRef.current?.close();
    sourceRef.current = null;
    setState((s) => ({ ...s, messages: [], running: false, activeTurnId: null }));
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      if (state.running) return;

      const turnId = `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      const userMessage: ChatMessage = {
        kind: "user",
        id: `u-${turnId}`,
        turnId,
        text: trimmed,
        ts: Date.now(),
      };

      const messagesBefore = state.messages;
      const history = buildHistory(messagesBefore);

      setState((s) => ({
        ...s,
        messages: [...s.messages, userMessage],
        running: true,
        activeTurnId: turnId,
        open: true,
      }));

      try {
        const body = {
          question: trimmed,
          history,
          ...(state.productContext
            ? {
                product_id: state.productContext.product_id,
                product_name: state.productContext.name,
                product_brand: state.productContext.brand,
                product_category: state.productContext.category,
                product_price: state.productContext.price,
              }
            : {}),
        };

        const res = await fetch(`/api/commerce/ask`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`ask failed: ${res.status}`);
        const data = (await res.json()) as { trace_id: string };

        const source = new EventSource(`/api/stream/${data.trace_id}`);
        sourceRef.current = source;

        const listen = (type: string, handler: (data: Record<string, unknown>) => void) => {
          source.addEventListener(type, (evt) => {
            try {
              handler(JSON.parse((evt as MessageEvent).data));
            } catch {
              /* ignore malformed event */
            }
          });
        };

        listen("agent_start", (data) => {
          const agent = data.agent as AgentKey;
          setState((s) => {
            if (s.activeTurnId !== turnId) return s;
            const id = `a-${turnId}-${agent}`;
            if (s.messages.some((m) => m.kind === "agent" && m.id === id)) return s;
            const message: ChatMessage = {
              kind: "agent",
              id,
              turnId,
              agent,
              status: "running",
              text: "",
              tools: [],
              durationMs: 0,
              ts: Date.now(),
            };
            return { ...s, messages: [...s.messages, message] };
          });
        });

        listen("agent_complete", (data) => {
          const agent = data.agent as AgentKey;
          setState((s) => {
            if (s.activeTurnId !== turnId) return s;
            return {
              ...s,
              messages: s.messages.map((m) =>
                m.kind === "agent" && m.turnId === turnId && m.agent === agent
                  ? {
                      ...m,
                      status: "complete" as const,
                      text: (data.preview as string) ?? "",
                      durationMs: (data.duration_ms as number) ?? 0,
                    }
                  : m,
              ),
            };
          });
        });

        listen("tool_start", (data) => {
          const agent = data.agent as AgentKey;
          setState((s) => {
            if (s.activeTurnId !== turnId) return s;
            return {
              ...s,
              messages: s.messages.map((m) => {
                if (m.kind !== "agent" || m.turnId !== turnId || m.agent !== agent) return m;
                const newTool: ChatToolCall = {
                  tool: (data.tool as string) ?? "",
                  input: (data.input as string) ?? "",
                };
                return { ...m, tools: [...m.tools, newTool] };
              }),
            };
          });
        });

        listen("tool_result", (data) => {
          const agent = data.agent as AgentKey;
          setState((s) => {
            if (s.activeTurnId !== turnId) return s;
            return {
              ...s,
              messages: s.messages.map((m) => {
                if (m.kind !== "agent" || m.turnId !== turnId || m.agent !== agent) return m;
                const tools = [...m.tools];
                for (let i = tools.length - 1; i >= 0; i -= 1) {
                  if (tools[i].tool === data.tool && !tools[i].preview) {
                    tools[i] = {
                      ...tools[i],
                      preview: data.preview as string | undefined,
                      rows: data.rows as number | undefined,
                      columns: data.columns as string[] | undefined,
                      latency_ms: data.latency_ms as number | undefined,
                      embed_ms: data.embed_ms as number | undefined,
                      search_ms: data.search_ms as number | undefined,
                      top_scores: data.top_scores as number[] | undefined,
                      hits: data.hits as VectorHit[] | undefined,
                    };
                    break;
                  }
                }
                return { ...m, tools };
              }),
            };
          });
        });

        listen("trace_complete", (data) => {
          setState((s) => {
            if (s.activeTurnId !== turnId) return s;
            const finalReport = ((data.final_report as string) ?? "").trim();
            const messages = s.messages.map((m) => {
              if (m.kind !== "agent" || m.turnId !== turnId || m.agent !== "reporter") return m;
              return { ...m, text: finalReport || m.text, status: "complete" as const };
            });
            return { ...s, messages, running: false, activeTurnId: null };
          });
          source.close();
        });

        listen("trace_error", (data) => {
          setState((s) => {
            if (s.activeTurnId !== turnId) return s;
            return {
              ...s,
              running: false,
              activeTurnId: null,
              messages: s.messages.map((m) =>
                m.kind === "agent" && m.turnId === turnId
                  ? { ...m, status: "error" as const, text: (data.error as string) ?? "erro" }
                  : m,
              ),
            };
          });
          source.close();
        });

        source.onerror = () => {
          /* keep state; server will close */
        };
      } catch (err) {
        console.error(err);
        setState((s) => ({ ...s, running: false, activeTurnId: null }));
      }
    },
    [state.running, state.messages, state.productContext],
  );

  const openAndAsk = useCallback(
    (text: string, ctx?: ProductContext | null) => {
      if (ctx !== undefined) {
        setState((s) => ({ ...s, productContext: ctx, open: true }));
      } else {
        setState((s) => ({ ...s, open: true }));
      }
      setTimeout(() => sendMessage(text), 120);
    },
    [sendMessage],
  );

  const api = useMemo<ConciergeApi>(
    () => ({
      state,
      openPanel,
      closePanel,
      togglePanel,
      setProductContext,
      sendMessage,
      openAndAsk,
      clear,
    }),
    [state, openPanel, closePanel, togglePanel, setProductContext, sendMessage, openAndAsk, clear],
  );

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useConcierge(): ConciergeApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useConcierge must be used inside <ConciergeProvider>");
  return ctx;
}

function buildHistory(messages: ChatMessage[]): Array<{ role: string; content: string }> {
  const history: Array<{ role: string; content: string }> = [];
  const seenTurns = new Set<string>();
  for (const m of messages) {
    if (m.kind === "user") {
      history.push({ role: "user", content: m.text });
    } else if (m.kind === "agent" && m.agent === "reporter" && m.status === "complete" && !seenTurns.has(m.turnId)) {
      seenTurns.add(m.turnId);
      history.push({ role: "crew", content: m.text });
    }
  }
  return history.slice(-10);
}
