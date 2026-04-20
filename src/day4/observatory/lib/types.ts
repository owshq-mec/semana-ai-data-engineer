export type AgentKey = "analyst" | "researcher" | "reporter";

export type AgentStatus = "idle" | "active" | "complete" | "error";

export interface TraceStart {
  type: "trace_start";
  trace_id: string;
  question: string;
  ts: number;
}

export interface AgentStart {
  type: "agent_start";
  trace_id: string;
  agent: AgentKey;
  ts: number;
}

export interface AgentComplete {
  type: "agent_complete";
  trace_id: string;
  agent: AgentKey;
  preview: string;
  duration_ms: number;
  ts: number;
}

export interface ToolStart {
  type: "tool_start";
  trace_id: string;
  agent: AgentKey;
  tool: string;
  input: string;
  ts: number;
}

export interface ToolResult {
  type: "tool_result";
  trace_id: string;
  agent: AgentKey;
  tool: string;
  preview: string;
  rows: number;
  columns?: string[];
  latency_ms: number;
  top_scores?: number[];
  embed_ms?: number;
  search_ms?: number;
  hits?: Array<{
    score: number;
    rating: number | string;
    sentiment: string;
    comment: string;
  }>;
  ts: number;
}

export interface ToolError {
  type: "tool_error";
  trace_id: string;
  agent: AgentKey;
  tool: string;
  error: string;
  latency_ms: number;
  ts: number;
}

export interface TraceComplete {
  type: "trace_complete";
  trace_id: string;
  final_report: string;
  duration_ms: number;
  ts: number;
}

export interface TraceError {
  type: "trace_error";
  trace_id: string;
  error: string;
  ts: number;
}

export interface PlatformTick {
  type: "platform_tick";
  ts: number;
  postgres: {
    customers: number;
    products: number;
    orders: number;
    orders_last_minute: number;
  };
  qdrant: {
    points: number;
    collection: string;
    status: string;
  };
  sparkline: number[];
}

export type TraceEvent =
  | TraceStart
  | AgentStart
  | AgentComplete
  | ToolStart
  | ToolResult
  | ToolError
  | TraceComplete
  | TraceError;

export type ObservatoryEvent = TraceEvent | PlatformTick;

export interface ToolInvocation {
  key: string;
  tool: string;
  agent: AgentKey;
  input: string;
  result?: ToolResult;
  error?: ToolError;
  pendingSince: number;
}

export interface AgentState {
  name: AgentKey;
  status: AgentStatus;
  preview: string;
  durationMs: number;
  tools: ToolInvocation[];
  startedAt?: number;
}

export interface TraceState {
  traceId: string | null;
  question: string;
  startedAt: number | null;
  completedAt: number | null;
  durationMs: number;
  agents: Record<AgentKey, AgentState>;
  finalReport: string;
  error?: string;
}

export const AGENT_ORDER: AgentKey[] = ["analyst", "researcher", "reporter"];

export const AGENT_LABELS: Record<AgentKey, { name: string; role: string; store: string }> = {
  analyst: {
    name: "Analyst",
    role: "Analista de Dados",
    store: "The Ledger · SQL",
  },
  researcher: {
    name: "Research",
    role: "Pesquisador de Experiencia",
    store: "The Memory · Semantic",
  },
  reporter: {
    name: "Reporter",
    role: "Redator de Relatorios",
    store: "Sintese Executiva",
  },
};
