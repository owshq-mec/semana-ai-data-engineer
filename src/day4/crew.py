"""ShopAgent Day 4 — CrewAI 3-agent crew for e-commerce analysis."""

from crewai import Agent, Crew, Process, Task
from crewai.project import CrewBase, agent, crew, task

from src.day4.tools import qdrant_semantic_search, supabase_execute_sql


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
            llm="anthropic/claude-sonnet-4-20250514",
            verbose=True,
        )

    @agent
    def researcher(self) -> Agent:
        return Agent(
            config=self.agents_config["researcher"],
            tools=[qdrant_semantic_search],
            allow_delegation=False,
            llm="anthropic/claude-sonnet-4-20250514",
            verbose=True,
        )

    @agent
    def reporter(self) -> Agent:
        return Agent(
            config=self.agents_config["reporter"],
            allow_delegation=False,
            llm="anthropic/claude-sonnet-4-20250514",
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


if __name__ == "__main__":
    question = (
        "Faca uma analise completa de satisfacao dos clientes por regiao, "
        "incluindo faturamento, principais reclamacoes e um plano de acao."
    )
    print(run_crew(question))
