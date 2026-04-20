export interface Product {
  product_id: string;
  name: string;
  category: string;
  brand: string;
  price: number;
  order_count?: number;
  total_revenue?: number;
  recent_orders?: number;
  recent_revenue?: number;
}

export interface ProductDetail extends Product {
  avg_qty: number;
  status_breakdown: Record<string, number>;
  payment_breakdown: Record<string, number>;
}

export interface Category {
  category: string;
  product_count: number;
}

export interface TraceEvent {
  type: string;
  trace_id: string;
  ts: number;
  agent?: "analyst" | "researcher" | "reporter";
  tool?: string;
  input?: string;
  preview?: string;
  rows?: number;
  columns?: string[];
  latency_ms?: number;
  top_scores?: number[];
  error?: string;
  final_report?: string;
  duration_ms?: number;
}

export interface VerdictPhase {
  agent: "analyst" | "researcher" | "reporter";
  status: "idle" | "active" | "complete";
  preview: string;
  durationMs: number;
  tools: ToolCall[];
}

export interface ToolCall {
  tool: string;
  input: string;
  preview?: string;
  rows?: number;
  latency_ms?: number;
  top_scores?: number[];
}

export interface VerdictState {
  traceId: string | null;
  phases: Record<"analyst" | "researcher" | "reporter", VerdictPhase>;
  finalReport: string;
  durationMs: number;
  error?: string;
  running: boolean;
}

export type AgentKey = "analyst" | "researcher" | "reporter";

export const AGENT_ORDER: AgentKey[] = ["analyst", "researcher", "reporter"];

export const AGENT_DISPLAY: Record<AgentKey, { name: string; label: string }> = {
  analyst: { name: "Analyst", label: "The Ledger · SQL" },
  researcher: { name: "Research", label: "The Memory · Vector" },
  reporter: { name: "Reporter", label: "Synthesis · Verdict" },
};
