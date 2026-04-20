"""ShopAgent Day 4 — CrewAI 3-agent crew for e-commerce analysis."""

from __future__ import annotations

import time
from typing import Any, Callable

from crewai import Agent, Crew, Process, Task
from crewai.project import CrewBase, agent, crew, task

from src.day4.tools import qdrant_semantic_search, supabase_execute_sql


AGENT_SEQUENCE = ["analyst", "researcher", "reporter"]


@CrewBase
class ShopAgentCrew:
    """ShopAgent multi-agent crew: Analyst + Researcher + Reporter."""

    agents_config = "config/agents.yaml"
    tasks_config = "config/tasks.yaml"

    @agent
    def analyst(self) -> Agent:
        return Agent(
            config=self.agents_config["analyst"],
            tools=[supabase_execute_sql],
            allow_delegation=False,
            llm="anthropic/claude-haiku-4-5-20251001",
            verbose=True,
        )

    @agent
    def researcher(self) -> Agent:
        return Agent(
            config=self.agents_config["researcher"],
            tools=[qdrant_semantic_search],
            allow_delegation=False,
            llm="anthropic/claude-haiku-4-5-20251001",
            verbose=True,
        )

    @agent
    def reporter(self) -> Agent:
        return Agent(
            config=self.agents_config["reporter"],
            allow_delegation=False,
            llm="anthropic/claude-haiku-4-5-20251001",
            verbose=True,
        )

    @task
    def analysis_task(self) -> Task:
        return Task(config=self.tasks_config["analysis_task"])

    @task
    def research_task(self) -> Task:
        return Task(config=self.tasks_config["research_task"])

    @task
    def report_task(self) -> Task:
        return Task(
            config=self.tasks_config["report_task"],
            context=[self.analysis_task(), self.research_task()],
        )

    @crew
    def crew(self) -> Crew:
        return Crew(
            agents=self.agents,
            tasks=self.tasks,
            process=Process.sequential,
            verbose=True,
        )


def run_crew(question: str) -> str:
    crew_instance = ShopAgentCrew()
    result = crew_instance.crew().kickoff(inputs={"question": question})
    return result.raw


def run_crew_with_emitter(
    question: str,
    trace_id: str,
    emit: Callable[[dict[str, Any]], None],
) -> str:
    """Run the crew while broadcasting agent lifecycle events.

    Emits agent_start before each task and agent_complete after. The tools
    themselves emit tool_start / tool_result via contextvars installed by the
    FastAPI handler before calling this function.
    """
    crew_instance = ShopAgentCrew()
    crew_obj = crew_instance.crew()

    state = {"index": 0, "started_at": time.time()}

    def _now() -> float:
        return time.time()

    def _fire_agent_start(agent_name: str) -> None:
        emit({
            "type": "agent_start",
            "trace_id": trace_id,
            "agent": agent_name,
            "ts": _now(),
        })

    def _fire_agent_complete(agent_name: str, preview: str, duration_ms: int) -> None:
        emit({
            "type": "agent_complete",
            "trace_id": trace_id,
            "agent": agent_name,
            "preview": preview[:1500],
            "duration_ms": duration_ms,
            "ts": _now(),
        })

    task_started_at = {"value": time.time()}

    def task_callback(task_output: Any) -> None:
        idx = state["index"]
        if idx >= len(AGENT_SEQUENCE):
            return
        current_agent = AGENT_SEQUENCE[idx]
        raw = getattr(task_output, "raw", str(task_output))
        duration_ms = int((time.time() - task_started_at["value"]) * 1000)
        _fire_agent_complete(current_agent, str(raw), duration_ms)

        state["index"] += 1
        if state["index"] < len(AGENT_SEQUENCE):
            task_started_at["value"] = time.time()
            _fire_agent_start(AGENT_SEQUENCE[state["index"]])

    crew_obj.task_callback = task_callback

    _fire_agent_start(AGENT_SEQUENCE[0])
    task_started_at["value"] = time.time()
    result = crew_obj.kickoff(inputs={"question": question})
    return result.raw


if __name__ == "__main__":
    question = (
        "Faca uma analise completa de satisfacao dos clientes por regiao, "
        "incluindo faturamento, principais reclamacoes e um plano de acao."
    )
    print(run_crew(question))
