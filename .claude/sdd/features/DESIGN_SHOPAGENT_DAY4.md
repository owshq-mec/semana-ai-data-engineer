# DESIGN: Multi-Agent ShopAgent — CrewAI 3-Agent Crew

> Technical design for a CrewAI sequential crew with 3 specialist agents, YAML config, Chainlit step-by-step UI, DeepEval evaluation, and LangFuse observability.

## Metadata

| Attribute | Value |
|-----------|-------|
| **Feature** | SHOPAGENT_DAY4 |
| **Date** | 2026-04-16 |
| **Author** | design-agent |
| **DEFINE** | [DEFINE_SHOPAGENT_DAY4.md](./DEFINE_SHOPAGENT_DAY4.md) |
| **Status** | Ready for Build |

---

## Architecture Overview

```text
┌──────────────────────────────────────────────────────────────────────┐
│                        CHAINLIT UI (Browser)                         │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  cl.Step: AnalystAgent    │  cl.Step: ResearchAgent          │   │
│  │  Shows SQL + results      │  Shows reviews + themes          │   │
│  ├───────────────────────────┴──────────────────────────────────┤   │
│  │  cl.Step: ReporterAgent                                      │   │
│  │  Shows executive report                                      │   │
│  ├──────────────────────────────────────────────────────────────┤   │
│  │  cl.Message: Final executive report (full text)              │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────┬────────────────────────────────────┘
                                  │ HTTP (localhost:8000)
                                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      chainlit_app.py                                  │
│                                                                      │
│  @cl.on_chat_start → create ShopAgentCrew, store in session          │
│  @cl.on_message    → pre-create 3 cl.Steps                          │
│                    → asyncio.to_thread(crew.kickoff)                 │
│                    → task_callback updates each Step                 │
└─────────────────────────────────┬────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│                           crew.py                                     │
│                                                                      │
│  @CrewBase class ShopAgentCrew                                       │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  agents_config = "config/agents.yaml"                          │  │
│  │  tasks_config  = "config/tasks.yaml"                           │  │
│  │                                                                │  │
│  │  Sequential Process:                                           │  │
│  │                                                                │  │
│  │  ┌─────────────┐   ┌──────────────┐   ┌─────────────────┐    │  │
│  │  │AnalystAgent │──→│ResearchAgent │──→│ ReporterAgent   │    │  │
│  │  │ tool: sql   │   │ tool: qdrant │   │ tools: none     │    │  │
│  │  │ context: —  │   │ context: —   │   │ context: [1, 2] │    │  │
│  │  └─────────────┘   └──────────────┘   └─────────────────┘    │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                   │                        │                         │
│             ┌─────┘                        └─────┐                   │
│             ▼                                    ▼                   │
│  ┌────────────────────────┐   ┌──────────────────────────────────┐  │
│  │ supabase_execute_sql   │   │  qdrant_semantic_search          │  │
│  │ @tool from tools.py    │   │  @tool from tools.py             │  │
│  └───────────┬────────────┘   └───────────────┬──────────────────┘  │
└──────────────┼────────────────────────────────┼──────────────────────┘
               │                                │
               ▼                                ▼
┌──────────────────────────┐  ┌────────────────────────────────────┐
│  Postgres (The Ledger)   │  │  Qdrant (The Memory)               │
│  psycopg2 connection     │  │  qdrant_client + fastembed          │
│  localhost:5432           │  │  localhost:6333                     │
│  OR Supabase Cloud       │  │  OR Qdrant Cloud                   │
│                          │  │                                    │
│  Tables:                 │  │  Collection:                       │
│  • customers             │  │  • shopagent_reviews (203 docs)    │
│  • products              │  │  • BAAI/bge-base-en-v1.5 (768-dim) │
│  • orders                │  │                                    │
└──────────────────────────┘  └────────────────────────────────────┘
         Docker / Cloud                    Docker / Cloud

               ┌──────────────────────────────────────┐
               │         QUALITY LAYER                 │
               │                                       │
               │  eval_agent.py (DeepEval)             │
               │  • ToolCorrectnessMetric              │
               │  • AnswerRelevancyMetric              │
               │  • Custom GEval metric                │
               │                                       │
               │  LangFuse (@observe decorator)        │
               │  • Per-agent spans                    │
               │  • Token usage + cost                 │
               │  • Latency breakdown                  │
               └──────────────────────────────────────┘
```

---

## Components

| Component | Purpose | Technology |
|-----------|---------|------------|
| `config/agents.yaml` | Declarative agent definitions (role, goal, backstory) | CrewAI YAML config |
| `config/tasks.yaml` | Task definitions with `{question}` interpolation | CrewAI YAML config |
| `tools.py` | Two CrewAI tools: SQL execution + semantic search | `@tool` decorator, psycopg2, qdrant_client, fastembed |
| `crew.py` | `@CrewBase` orchestration with Sequential process | CrewAI `Agent`, `Crew`, `Task`, `Process` |
| `chainlit_app.py` | Chat UI with per-agent `cl.Step` visibility | Chainlit lifecycle hooks, `asyncio.to_thread` |
| `eval_agent.py` | DeepEval test suite with 3 metrics | DeepEval `ToolCorrectnessMetric`, `AnswerRelevancyMetric`, `GEval` |

---

## Key Decisions

### Decision 1: psycopg2 Direct Connection (Not Supabase REST API)

| Attribute | Value |
|-----------|-------|
| **Status** | Accepted |
| **Date** | 2026-04-16 |

**Context:** The KB pattern uses `httpx` + Supabase REST API (`/rest/v1/rpc/execute_sql`). But Days 1-3 use `psycopg2` directly. Two approaches exist for Day 4.

**Choice:** Use `psycopg2` with env-based host/port/db/user/password — same pattern as Day 3's tools.

**Rationale:** Continuity. Participants already understand `psycopg2` from Day 3. The cloud migration story is cleaner: swap `POSTGRES_HOST` from `localhost` to Supabase's Postgres connection string. No new concepts (REST API, service keys) needed.

**Alternatives Rejected:**
1. Supabase REST API — Introduces httpx, API keys, and the `/rpc/execute_sql` endpoint pattern. More production-correct but too many new concepts for a live session already introducing CrewAI + DeepEval + LangFuse.

**Consequences:**
- Trade-off: Less "Supabase-native" — we're using Postgres directly, not the Supabase SDK
- Benefit: Zero new dependencies for the SQL tool; familiar pattern from Day 3

---

### Decision 2: FastEmbed Direct (Not LlamaIndex, Not Supabase Edge Function)

| Attribute | Value |
|-----------|-------|
| **Status** | Accepted |
| **Date** | 2026-04-16 |

**Context:** Day 3 uses LlamaIndex as middleware for Qdrant queries. The KB pattern uses a Supabase Edge Function for embeddings. Day 4 needs a simpler approach.

**Choice:** Use `qdrant_client.QdrantClient` + `fastembed.TextEmbedding` directly. Encode the query locally with `BAAI/bge-base-en-v1.5`, then call `client.query_points()`.

**Rationale:** Removes both LlamaIndex (6+ packages) and Supabase Edge Functions from the dependency graph. `fastembed` is already installed from Day 2. The Qdrant client's search API is straightforward. Participants see the raw pipeline: question → embed → search → format.

**Alternatives Rejected:**
1. LlamaIndex query engine (Day 3 pattern) — Adds 6 dependencies; abstracts away the embedding step
2. Supabase Edge Function for embeddings — Requires deploying a serverless function; too complex for live demo

**Consequences:**
- Trade-off: Embedding happens locally (slower first call while model loads, ~2s)
- Benefit: Participants understand every step; no hidden middleware

---

### Decision 3: YAML Config with @CrewBase (Not Pure Inline Python)

| Attribute | Value |
|-----------|-------|
| **Status** | Accepted |
| **Date** | 2026-04-16 |

**Context:** CrewAI supports both YAML-based configuration and inline Python definitions.

**Choice:** Use `@CrewBase` with `agents_config = "config/agents.yaml"` and `tasks_config = "config/tasks.yaml"`. Agent methods in Python reference YAML keys.

**Rationale:** Declarative YAML separates *identity* (who are the agents) from *orchestration* (how they run). Participants can modify a backstory in YAML without touching Python — this is the key pedagogical win. Mirrors production patterns (config-as-code).

**Alternatives Rejected:**
1. Pure inline Python — Fewer files but mixes config with code; harder to modify agents independently

**Consequences:**
- Trade-off: Two places to look (YAML + Python)
- Benefit: Backstory changes require zero Python knowledge; AT-010 is testable

---

### Decision 4: Synchronous kickoff in asyncio.to_thread (Not Async CrewAI)

| Attribute | Value |
|-----------|-------|
| **Status** | Accepted |
| **Date** | 2026-04-16 |

**Context:** CrewAI's `crew.kickoff()` is synchronous and blocks until all agents complete. Chainlit runs on an async event loop.

**Choice:** Wrap `crew.kickoff()` in `asyncio.to_thread()` so it runs in a thread pool, keeping the Chainlit event loop free. Use a `task_callback` to update `cl.Step` elements as each agent finishes.

**Rationale:** This is the established pattern from the KB (`chainlit-crewai.md`). The callback fires after each task completes, providing the bridge between CrewAI's sync world and Chainlit's async UI.

**Alternatives Rejected:**
1. Blocking the event loop — Freezes the Chainlit UI; steps won't update until all agents finish
2. CrewAI `kickoff_async()` — Experimental API; less predictable for live demo

**Consequences:**
- Trade-off: No per-token streaming from agents (unlike Day 3's LangGraph); results appear per-agent, not per-token
- Benefit: Reliable, predictable; each agent's complete output appears as a step

---

### Decision 5: Three DeepEval Metrics (ToolCorrectness + AnswerRelevancy + GEval)

| Attribute | Value |
|-----------|-------|
| **Status** | Accepted |
| **Date** | 2026-04-16 |

**Context:** DEFINE requires a "full evaluation suite" beyond minimal smoke tests.

**Choice:** Three metrics in `eval_agent.py`:
1. `ToolCorrectnessMetric(threshold=1.0)` — Binary: did the agent pick the right tool?
2. `AnswerRelevancyMetric(threshold=0.7)` — Is the answer relevant to the question?
3. `GEval(criteria="report_quality")` — Custom: does the report contain data + insights + recommendations?

**Rationale:** Each metric teaches a different concept: tool routing accuracy, response relevance, and custom business criteria. The GEval metric shows DeepEval's extensibility beyond built-in metrics.

**Alternatives Rejected:**
1. ToolCorrectness only — Too shallow; doesn't evaluate output quality
2. Full production suite (Faithfulness, Bias, Toxicity) — Overkill; adds 10+ minutes to evaluation time

**Consequences:**
- Trade-off: GEval requires an LLM call to evaluate (costs ~$0.01 per test case)
- Benefit: Participants learn 3 evaluation paradigms: binary, threshold, and custom

---

### Decision 6: LangFuse @observe Decorator (Not CrewAI Native Callbacks)

| Attribute | Value |
|-----------|-------|
| **Status** | Accepted |
| **Date** | 2026-04-16 |

**Context:** LangFuse can integrate with CrewAI via either the `@observe` decorator pattern or CrewAI's native callback handlers.

**Choice:** Use LangFuse `@observe` decorator on the crew `kickoff` function, creating a top-level trace with nested spans. Combine with `propagate_attributes` for session/user context.

**Rationale:** The `@observe` pattern is framework-agnostic — participants learn a pattern they can apply to any Python function, not just CrewAI. The KB pattern (`python-sdk-integration.md`) validates this approach.

**Alternatives Rejected:**
1. CrewAI native `langfuse_callback` — Tighter integration but less educational; participants wouldn't learn the general `@observe` pattern

**Consequences:**
- Trade-off: Less granular per-agent tracing (one trace wrapping the full crew, not per-agent spans)
- Benefit: General-purpose pattern; works with any framework

---

## File Manifest

| # | File | Action | Purpose | Agent | Dependencies |
|---|------|--------|---------|-------|--------------|
| 1 | `src/day4/__init__.py` | Create | Package marker | (general) | None |
| 2 | `src/day4/config/agents.yaml` | Create | 3 agent definitions: role, goal, backstory | @crewai-specialist | None |
| 3 | `src/day4/config/tasks.yaml` | Create | 3 task definitions: description, expected_output, agent, context | @crewai-specialist | None |
| 4 | `src/day4/tools.py` | Create | `supabase_execute_sql` + `qdrant_semantic_search` with CrewAI `@tool` | @crewai-specialist | None |
| 5 | `src/day4/crew.py` | Create | `@CrewBase` ShopAgentCrew orchestration + CLI entry point | @crewai-specialist | 2, 3, 4 |
| 6 | `src/day4/chainlit_app.py` | Create | Chainlit frontend with `cl.Step` per agent | @shopagent-builder | 4, 5 |
| 7 | `src/day4/eval_agent.py` | Create | DeepEval test suite (3 metrics, 6+ test cases) + LangFuse tracing | @shopagent-builder | 4, 5 |
| 8 | `src/day4/requirements.txt` | Create | Day 4 specific Python dependencies | @crewai-specialist | None |

**Total Files:** 8

---

## Agent Assignment Rationale

| Agent | Files Assigned | Why This Agent |
|-------|----------------|----------------|
| @crewai-specialist | 2, 3, 4, 5, 8 | CrewAI multi-agent orchestration expert; specializes in YAML config, `@CrewBase`, `@tool` decorator, process selection, and tool-to-agent registration. Has MCP validation via Context7 + Exa for CrewAI API verification |
| @shopagent-builder | 6, 7 | ShopAgent domain specialist; understands Chainlit + CrewAI integration pattern (`asyncio.to_thread`, `task_callback`) and DeepEval evaluation setup for the dual-store architecture |
| (general) | 1 | Trivial file (empty `__init__.py`) |

**Agent Discovery:**
- Scanned: `.claude/agents/**/*.md`
- @crewai-specialist matched by: CrewAI domain, YAML config, tool wiring, crew orchestration
- @shopagent-builder matched by: Chainlit integration, DeepEval evaluation, ShopAgent domain context

---

## Code Patterns

### Pattern 1: CrewAI @tool with psycopg2 (The Ledger)

```python
"""tools.py — supabase_execute_sql tool for The Ledger."""
import os
from pathlib import Path

import psycopg2
from crewai.tools import tool
from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(PROJECT_ROOT / ".env")


def _get_postgres_connection():
    return psycopg2.connect(
        host=os.environ.get("POSTGRES_HOST", "localhost"),
        port=int(os.environ.get("POSTGRES_PORT", 5432)),
        dbname=os.environ.get("POSTGRES_DB", "shopagent"),
        user=os.environ.get("POSTGRES_USER", "shopagent"),
        password=os.environ.get("POSTGRES_PASSWORD", "shopagent"),
    )


@tool("supabase_execute_sql")
def supabase_execute_sql(query: str) -> str:
    """Execute a SQL query against the ShopAgent Postgres database (The Ledger).
    Use for exact metrics: revenue, order counts, averages, customer segments.
    Available tables: customers, products, orders.
    Always write SELECT queries. Never mutate data."""
    conn = _get_postgres_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(query)
            columns = [desc[0] for desc in cur.description]
            rows = cur.fetchall()
        lines = [" | ".join(columns)]
        for row in rows:
            lines.append(" | ".join(str(v) for v in row))
        return "\n".join(lines)
    except Exception as e:
        return f"SQL Error: {e}"
    finally:
        conn.close()
```

### Pattern 2: CrewAI @tool with qdrant_client + fastembed (The Memory)

```python
"""tools.py — qdrant_semantic_search tool for The Memory."""
import os

from crewai.tools import tool
from fastembed import TextEmbedding
from qdrant_client import QdrantClient

_embedding_model = None


def _get_embedding_model() -> TextEmbedding:
    global _embedding_model
    if _embedding_model is None:
        _embedding_model = TextEmbedding(model_name="BAAI/bge-base-en-v1.5")
    return _embedding_model


@tool("qdrant_semantic_search")
def qdrant_semantic_search(question: str) -> str:
    """Search customer reviews by meaning using Qdrant vector database (The Memory).
    Use for opinions, complaints, sentiment themes, and customer feedback.
    The collection contains 203 Portuguese reviews with rating, comment, sentiment."""
    qdrant_url = os.environ.get("QDRANT_URL", "http://localhost:6333")
    qdrant_api_key = os.environ.get("QDRANT_API_KEY", None)
    collection = os.environ.get("QDRANT_COLLECTION", "shopagent_reviews")

    model = _get_embedding_model()
    embeddings = list(model.embed([question]))
    query_vector = embeddings[0].tolist()

    client = QdrantClient(url=qdrant_url, api_key=qdrant_api_key)
    results = client.query_points(
        collection_name=collection,
        query=query_vector,
        limit=5,
        with_payload=True,
    )

    if not results.points:
        return "Nenhum review encontrado para esta consulta."

    lines: list[str] = []
    for point in results.points:
        payload = point.payload or {}
        rating = payload.get("rating", "?")
        sentiment = payload.get("sentiment", "unknown")
        comment = payload.get("comment", "")[:200]
        score = round(point.score, 3)
        lines.append(f"[score={score} | rating={rating} | {sentiment}] {comment}")

    return "\n".join(lines)
```

### Pattern 3: @CrewBase with YAML Config

```python
"""crew.py — ShopAgentCrew orchestration."""
from crewai import Agent, Crew, Process, Task
from crewai.project import CrewBase, agent, crew, task

from src.day4.tools import qdrant_semantic_search, supabase_execute_sql


@CrewBase
class ShopAgentCrew:
    """ShopAgent multi-agent crew for e-commerce analysis."""

    agents_config = "config/agents.yaml"
    tasks_config = "config/tasks.yaml"

    @agent
    def analyst(self) -> Agent:
        return Agent(
            config=self.agents_config["analyst"],
            tools=[supabase_execute_sql],
            allow_delegation=False,
            verbose=True,
        )

    @agent
    def researcher(self) -> Agent:
        return Agent(
            config=self.agents_config["researcher"],
            tools=[qdrant_semantic_search],
            allow_delegation=False,
            verbose=True,
        )

    @agent
    def reporter(self) -> Agent:
        return Agent(
            config=self.agents_config["reporter"],
            allow_delegation=False,
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
```

### Pattern 4: Chainlit Step-by-Step with CrewAI task_callback

```python
"""chainlit_app.py — Chainlit frontend for ShopAgentCrew."""
import asyncio

import chainlit as cl

from src.day4.crew import ShopAgentCrew

AGENT_LABELS = {
    "analyst": "AnalystAgent — The Ledger (SQL)",
    "researcher": "ResearchAgent — The Memory (Semantic)",
    "reporter": "ReporterAgent — Relatorio Executivo",
}


@cl.on_chat_start
async def on_chat_start():
    crew_instance = ShopAgentCrew()
    cl.user_session.set("crew", crew_instance)
    await cl.Message(
        content=(
            "**ShopAgent Multi-Agent pronto!**\n\n"
            "3 agentes especializados:\n"
            "- **AnalystAgent** — consultas SQL no The Ledger\n"
            "- **ResearchAgent** — busca semantica no The Memory\n"
            "- **ReporterAgent** — relatorio executivo consolidado\n\n"
            "Faca sua pergunta sobre vendas, clientes ou satisfacao."
        )
    ).send()


@cl.on_message
async def on_message(message: cl.Message):
    crew_instance: ShopAgentCrew = cl.user_session.get("crew")

    # Pre-create steps for visual ordering
    steps: dict[str, cl.Step] = {}
    for key, label in AGENT_LABELS.items():
        step = cl.Step(name=label, type="run")
        steps[key] = step
        await step.__aenter__()
        step.output = "Aguardando..."
        await step.update()

    # Wire task callback to update steps
    crew_obj = crew_instance.crew()

    def task_callback(task_output):
        agent_key = getattr(task_output, "agent", "")
        raw = getattr(task_output, "raw", str(task_output))
        for key in steps:
            if key in str(agent_key).lower():
                # Sync context — schedule async update
                loop = asyncio.get_event_loop()
                asyncio.run_coroutine_threadsafe(
                    _update_step(steps[key], raw[:600]),
                    loop,
                )
                break

    crew_obj.task_callback = task_callback

    result = await asyncio.to_thread(
        crew_obj.kickoff,
        inputs={"question": message.content},
    )

    # Close all steps
    for step in steps.values():
        await step.__aexit__(None, None, None)

    await cl.Message(content=str(result.raw)).send()


async def _update_step(step: cl.Step, output: str):
    step.output = output
    await step.update()
```

### Pattern 5: DeepEval Test Suite with GEval Custom Metric

```python
"""eval_agent.py — DeepEval evaluation + LangFuse observability."""
import pytest
from deepeval import evaluate
from deepeval.metrics import AnswerRelevancyMetric, GEval, ToolCorrectnessMetric
from deepeval.test_case import LLMTestCase, ToolCall

# ---------------------------------------------------------------------------
# Test matrix
# ---------------------------------------------------------------------------
SQL_CASES = [
    {
        "input": "Qual o faturamento total por estado?",
        "actual_output": "SP: R$ 127.430, RJ: R$ 89.210, MG: R$ 68.440",
        "tools_called": [ToolCall(name="supabase_execute_sql")],
        "expected_tools": [ToolCall(name="supabase_execute_sql")],
    },
    {
        "input": "Quantos pedidos foram feitos por pix?",
        "actual_output": "1.847 pedidos pagos via pix (45% do total).",
        "tools_called": [ToolCall(name="supabase_execute_sql")],
        "expected_tools": [ToolCall(name="supabase_execute_sql")],
    },
]

SEMANTIC_CASES = [
    {
        "input": "Quais clientes reclamam de entrega?",
        "actual_output": "23 reviews negativos sobre entrega: atrasos e frete caro.",
        "retrieval_context": ["Demorou 15 dias.", "Frete caro demais."],
        "tools_called": [ToolCall(name="qdrant_semantic_search")],
        "expected_tools": [ToolCall(name="qdrant_semantic_search")],
    },
    {
        "input": "Qual o sentimento geral sobre o frete?",
        "actual_output": "67% negativo. Principais queixas: prazo e custo.",
        "retrieval_context": ["Frete caro demais.", "Chegou antes do previsto!"],
        "tools_called": [ToolCall(name="qdrant_semantic_search")],
        "expected_tools": [ToolCall(name="qdrant_semantic_search")],
    },
]

HYBRID_CASE = {
    "input": "Analise completa por regiao com faturamento e satisfacao",
    "actual_output": (
        "Resumo Executivo: SP lidera em faturamento (R$ 127k) mas concentra "
        "34% das reclamacoes de entrega. Recomendacao: investir em logistica SP."
    ),
    "tools_called": [
        ToolCall(name="supabase_execute_sql"),
        ToolCall(name="qdrant_semantic_search"),
    ],
    "expected_tools": [
        ToolCall(name="supabase_execute_sql"),
        ToolCall(name="qdrant_semantic_search"),
    ],
}

# ---------------------------------------------------------------------------
# Metrics
# ---------------------------------------------------------------------------
tool_metric = ToolCorrectnessMetric(threshold=1.0)

relevancy_metric = AnswerRelevancyMetric(
    threshold=0.7,
    model="claude-sonnet-4-20250514",
    include_reason=True,
)

report_quality_metric = GEval(
    name="report_quality",
    criteria=(
        "The output must contain: (1) specific numerical data from SQL queries, "
        "(2) customer sentiment insights from review analysis, and "
        "(3) at least 2 actionable recommendations."
    ),
    evaluation_params=["actual_output"],
    model="claude-sonnet-4-20250514",
    threshold=0.7,
)


# ---------------------------------------------------------------------------
# pytest tests
# ---------------------------------------------------------------------------
@pytest.mark.parametrize("case", SQL_CASES, ids=lambda c: c["input"][:40])
def test_analyst_routes_to_sql(case: dict):
    tc = LLMTestCase(**case)
    tool_metric.measure(tc)
    assert tool_metric.score == 1.0


@pytest.mark.parametrize("case", SEMANTIC_CASES, ids=lambda c: c["input"][:40])
def test_researcher_routes_to_qdrant(case: dict):
    tc = LLMTestCase(**case)
    tool_metric.measure(tc)
    assert tool_metric.score == 1.0


def test_hybrid_uses_both_tools():
    tc = LLMTestCase(**HYBRID_CASE)
    tool_metric.measure(tc)
    assert tool_metric.score == 1.0


def test_report_quality():
    tc = LLMTestCase(**HYBRID_CASE)
    report_quality_metric.measure(tc)
    assert report_quality_metric.score >= 0.7


# ---------------------------------------------------------------------------
# Batch evaluation (live demo)
# ---------------------------------------------------------------------------
def run_full_evaluation():
    all_cases = [LLMTestCase(**c) for c in SQL_CASES + SEMANTIC_CASES + [HYBRID_CASE]]
    evaluate(
        test_cases=all_cases,
        metrics=[tool_metric, relevancy_metric, report_quality_metric],
    )


if __name__ == "__main__":
    run_full_evaluation()
```

### Pattern 6: LangFuse @observe Wrapper

```python
"""Add to crew.py or eval_agent.py for LangFuse tracing."""
from langfuse import observe


@observe(name="shopagent-crew-kickoff")
def run_crew_traced(question: str) -> str:
    """Run the full crew with LangFuse tracing."""
    from src.day4.crew import ShopAgentCrew

    crew_instance = ShopAgentCrew()
    result = crew_instance.crew().kickoff(inputs={"question": question})
    return result.raw
```

---

## Data Flow

```text
1. User types question in Chainlit chat
   │  "Analise completa de satisfacao por regiao com impacto financeiro"
   ▼
2. chainlit_app.py creates 3 cl.Steps (Analyst, Researcher, Reporter)
   │  All show "Aguardando..." initially
   ▼
3. crew.kickoff(inputs={"question": ...}) starts in background thread
   │
   ▼
4. SEQUENTIAL STEP 1: AnalystAgent
   │  Reads task description from tasks.yaml (interpolated with {question})
   │  Calls supabase_execute_sql("SELECT state, SUM(total) FROM orders...")
   │  → psycopg2 executes → returns pipe-delimited table
   │  → task_callback fires → cl.Step "AnalystAgent" updates with SQL results
   ▼
5. SEQUENTIAL STEP 2: ResearchAgent
   │  Reads task description from tasks.yaml (interpolated with {question})
   │  Calls qdrant_semantic_search("reclamacoes satisfacao regiao")
   │  → fastembed encodes → qdrant_client searches → returns scored reviews
   │  → task_callback fires → cl.Step "ResearchAgent" updates with review themes
   ▼
6. SEQUENTIAL STEP 3: ReporterAgent
   │  Receives context=[analysis_task output, research_task output]
   │  No tools — synthesizes from both inputs
   │  Generates executive report: Resumo, Metricas, Voz do Cliente, Recomendacoes
   │  → task_callback fires → cl.Step "ReporterAgent" updates with report
   ▼
7. crew.kickoff returns → result.raw sent as cl.Message
   │  All steps closed → final report displayed in chat
   ▼
8. (Optional) LangFuse trace captured with @observe
   │  Token usage, latency, cost per agent visible in dashboard
```

---

## Integration Points

| External System | Integration Type | Authentication | Port | Env Vars |
|-----------------|-----------------|----------------|------|----------|
| Postgres (The Ledger) | psycopg2 direct connection | User/password | 5432 | `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` |
| Qdrant (The Memory) | qdrant_client HTTP | API key (cloud) or None (local) | 6333 | `QDRANT_URL`, `QDRANT_API_KEY`, `QDRANT_COLLECTION` |
| Anthropic API | CrewAI's litellm integration | API key | HTTPS | `ANTHROPIC_API_KEY` |
| LangFuse | `@observe` decorator / SDK | Public + secret key | HTTPS | `LANGFUSE_SECRET_KEY`, `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_BASE_URL` |

---

## Testing Strategy

| Test Type | Scope | Files | Tools | Coverage Goal |
|-----------|-------|-------|-------|---------------|
| Tool Correctness | Agent routes to correct tool per question type | `eval_agent.py` | DeepEval `ToolCorrectnessMetric` | 6 cases: 2 SQL, 2 semantic, 1 hybrid, 1 report quality |
| Answer Relevancy | Final output is relevant to input question | `eval_agent.py` | DeepEval `AnswerRelevancyMetric(threshold=0.7)` | All 5 cases above 0.7 |
| Report Quality | Executive report contains data + insights + recommendations | `eval_agent.py` | DeepEval `GEval(criteria=...)` | Hybrid case passes custom criteria |
| Smoke | Tool connectivity | CLI | `python -c "from src.day4.tools import ..."` | Both tools import and connect |
| Manual E2E | Full crew flow | Chainlit | Run app, ask 3 demo questions | AT-001 through AT-005 |
| CLI E2E | Crew execution without Chainlit | Terminal | `python src/day4/crew.py` | AT-009 |

---

## Error Handling

| Error Type | Handling Strategy | User-Visible? |
|------------|-------------------|---------------|
| Postgres connection failure | Tool returns `"SQL Error: could not connect..."` | Yes — agent relays error, may retry |
| Invalid SQL generated | psycopg2 raises, tool returns `"SQL Error: {e}"` | Yes — agent may self-correct SQL |
| Qdrant connection failure | Tool catches exception, returns `"Qdrant Error: {e}"` | Yes — agent relays error |
| Empty Qdrant results | Tool returns `"Nenhum review encontrado..."` | Yes — agent explains no results |
| FastEmbed model load failure | First call to `_get_embedding_model()` fails | Yes — tool returns error string |
| Anthropic API timeout | CrewAI propagates; Chainlit shows error | Yes — message in chat |
| LangFuse connection failure | Silent — tracing fails gracefully, crew still executes | No — observability offline but agents work |
| DeepEval API error | Test case fails with traceback | Visible in pytest output |

---

## Configuration

| Config Key | Source | Default | Description |
|------------|--------|---------|-------------|
| `POSTGRES_HOST` | .env | `localhost` | Postgres host (local or cloud) |
| `POSTGRES_PORT` | .env | `5432` | Postgres port |
| `POSTGRES_DB` | .env | `shopagent` | Database name |
| `POSTGRES_USER` | .env | `shopagent` | Database user |
| `POSTGRES_PASSWORD` | .env | `shopagent` | Database password |
| `QDRANT_URL` | .env | `http://localhost:6333` | Qdrant endpoint (local or cloud) |
| `QDRANT_API_KEY` | .env | `None` | Qdrant Cloud API key (None for local) |
| `QDRANT_COLLECTION` | .env | `shopagent_reviews` | Qdrant collection name |
| `ANTHROPIC_API_KEY` | .env | (required) | Claude API key |
| `LANGFUSE_SECRET_KEY` | .env | (optional) | LangFuse server-side key |
| `LANGFUSE_PUBLIC_KEY` | .env | (optional) | LangFuse client-side key |
| `LANGFUSE_BASE_URL` | .env | `https://cloud.langfuse.com` | LangFuse API endpoint |

**Cloud migration:** Change `POSTGRES_HOST` + `QDRANT_URL` + `QDRANT_API_KEY`. Zero code changes.

---

## Security Considerations

- **Open SQL execution:** Agent can run any SQL including DELETE/DROP. Mitigated by: (a) local Docker is throwaway, (b) cloud Supabase uses credentials with appropriate permissions, (c) tool docstring instructs "Always write SELECT queries"
- **API key management:** All keys loaded from `.env`, never hardcoded. `.env` is in `.gitignore`
- **Qdrant Cloud auth:** `QDRANT_API_KEY` required for cloud; omitted for local Docker (no auth)
- **LangFuse keys:** Optional — system works without them, just no observability

---

## Observability

| Aspect | Implementation |
|--------|----------------|
| Logging | CrewAI `verbose=True` prints agent reasoning to terminal |
| Tracing | LangFuse `@observe` decorator on crew kickoff; per-agent spans visible in dashboard |
| Metrics | LangFuse tracks token usage, latency, and estimated cost per trace |
| Evaluation | DeepEval batch evaluation produces pass/fail summary in terminal |
| UI Trace | Chainlit `cl.Step` per agent shows intermediate results in browser |

---

## Dependencies (requirements.txt)

```text
crewai>=0.100.0
crewai-tools>=0.17.0
psycopg2-binary>=2.9.0
qdrant-client>=1.12.0
fastembed>=0.4.0
python-dotenv>=1.0.0
chainlit>=2.0.0
deepeval>=2.0.0
langfuse>=2.50.0
anthropic>=0.40.0
```

**NOT included (removed from Day 3):**
- `llama-index-*` — replaced by direct `qdrant_client` + `fastembed`
- `langchain-*` / `langgraph` — replaced by CrewAI

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-04-16 | design-agent | Initial version |
| 1.1 | 2026-04-16 | iterate-agent | Reassigned CrewAI files (2,3,4,5,8) from @shopagent-builder to @crewai-specialist per user request |

---

## Next Step

**Ready for:** `/build .claude/sdd/features/DESIGN_SHOPAGENT_DAY4.md`
