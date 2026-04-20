"use client";

import { useEffect, useMemo, useState } from "react";

import AgentOrb from "../components/AgentOrb";
import FinalReport from "../components/FinalReport";
import QueryInput from "../components/QueryInput";
import TopRail from "../components/TopRail";
import { AGENT_ORDER } from "../lib/reducer";
import { useEventStream } from "../lib/useEventStream";
import { useTelemetry } from "../lib/useTelemetry";

export default function ObservatoryPage() {
  const [traceId, setTraceId] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const { tick, connected: telemetryConnected } = useTelemetry();
  const { trace, connected } = useEventStream(traceId);

  const running = submitting || connected;

  useEffect(() => {
    if (trace.completedAt || trace.error) setSubmitting(false);
  }, [trace.completedAt, trace.error]);

  const submit = async (question: string) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/query`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question }),
      });
      if (!res.ok) throw new Error(`query failed: ${res.status}`);
      const body = (await res.json()) as { trace_id: string };
      setTraceId(body.trace_id);
      setHistory((h) => [...h, question]);
    } catch (err) {
      console.error(err);
      setSubmitting(false);
    }
  };

  const activeAgent = useMemo(() => {
    for (const key of AGENT_ORDER) {
      if (trace.agents[key].status === "active") return key;
    }
    return null;
  }, [trace]);

  return (
    <div className="shell">
      <TopRail tick={tick} connected={telemetryConnected} />
      <div className="main">
        <QueryInput
          onSubmit={submit}
          onReuse={submit}
          history={history}
          running={running}
        />

        <section className="stage">
          <header className="stage-heading">
            <h1>
              {trace.question ? trace.question : "Three agents, one question."}
            </h1>
            <span>
              {trace.traceId ? `trace · ${trace.traceId}` : "awaiting · no trace"}
            </span>
          </header>

          <div className="orbs">
            {AGENT_ORDER.map((key, idx) => (
              <div key={key}>
                <AgentOrb
                  agent={trace.agents[key]}
                  order={idx}
                  active={activeAgent === key}
                />
                {idx < AGENT_ORDER.length - 1 && <div className="ribbon" aria-hidden />}
              </div>
            ))}
          </div>

          {trace.error && (
            <div className="error-banner" role="alert">
              trace_error · {trace.error}
            </div>
          )}
        </section>

        <FinalReport
          report={trace.finalReport}
          durationMs={trace.durationMs}
          running={running}
        />
      </div>
    </div>
  );
}
