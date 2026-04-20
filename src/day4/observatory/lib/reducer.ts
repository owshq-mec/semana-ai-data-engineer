import {
  AGENT_ORDER,
  type AgentKey,
  type AgentState,
  type TraceEvent,
  type TraceState,
  type ToolInvocation,
} from "./types";

export function emptyTrace(): TraceState {
  const agents: Record<AgentKey, AgentState> = {
    analyst: blank("analyst"),
    researcher: blank("researcher"),
    reporter: blank("reporter"),
  };
  return {
    traceId: null,
    question: "",
    startedAt: null,
    completedAt: null,
    durationMs: 0,
    agents,
    finalReport: "",
  };
}

function blank(name: AgentKey): AgentState {
  return {
    name,
    status: "idle",
    preview: "",
    durationMs: 0,
    tools: [],
  };
}

export function reduceEvent(state: TraceState, ev: TraceEvent): TraceState {
  switch (ev.type) {
    case "trace_start":
      return {
        ...emptyTrace(),
        traceId: ev.trace_id,
        question: ev.question,
        startedAt: ev.ts,
      };
    case "agent_start": {
      const agent = state.agents[ev.agent];
      if (!agent) return state;
      return {
        ...state,
        agents: {
          ...state.agents,
          [ev.agent]: { ...agent, status: "active", startedAt: ev.ts },
        },
      };
    }
    case "agent_complete": {
      const agent = state.agents[ev.agent];
      if (!agent) return state;
      return {
        ...state,
        agents: {
          ...state.agents,
          [ev.agent]: {
            ...agent,
            status: "complete",
            preview: ev.preview,
            durationMs: ev.duration_ms,
          },
        },
      };
    }
    case "tool_start": {
      const agent = state.agents[ev.agent];
      if (!agent) return state;
      const invocation: ToolInvocation = {
        key: `${ev.agent}:${ev.tool}:${ev.ts}`,
        tool: ev.tool,
        agent: ev.agent,
        input: ev.input,
        pendingSince: ev.ts,
      };
      return {
        ...state,
        agents: {
          ...state.agents,
          [ev.agent]: { ...agent, tools: [...agent.tools, invocation] },
        },
      };
    }
    case "tool_result": {
      const agent = state.agents[ev.agent];
      if (!agent) return state;
      const tools = [...agent.tools];
      for (let i = tools.length - 1; i >= 0; i -= 1) {
        if (tools[i].tool === ev.tool && !tools[i].result && !tools[i].error) {
          tools[i] = { ...tools[i], result: ev };
          break;
        }
      }
      return {
        ...state,
        agents: { ...state.agents, [ev.agent]: { ...agent, tools } },
      };
    }
    case "tool_error": {
      const agent = state.agents[ev.agent];
      if (!agent) return state;
      const tools = [...agent.tools];
      for (let i = tools.length - 1; i >= 0; i -= 1) {
        if (tools[i].tool === ev.tool && !tools[i].result && !tools[i].error) {
          tools[i] = { ...tools[i], error: ev };
          break;
        }
      }
      return {
        ...state,
        agents: { ...state.agents, [ev.agent]: { ...agent, tools } },
      };
    }
    case "trace_complete":
      return {
        ...state,
        completedAt: ev.ts,
        durationMs: ev.duration_ms,
        finalReport: ev.final_report,
      };
    case "trace_error":
      return { ...state, completedAt: ev.ts, error: ev.error };
    default:
      return state;
  }
}

export { AGENT_ORDER };
