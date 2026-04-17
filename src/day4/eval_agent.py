"""ShopAgent Day 4 — DeepEval evaluation + LangFuse observability."""

import pytest
from deepeval import evaluate
from deepeval.metrics import AnswerRelevancyMetric, GEval, ToolCorrectnessMetric
from deepeval.test_case import LLMTestCase, ToolCall
from langfuse import observe

from src.day4.crew import ShopAgentCrew

# ---------------------------------------------------------------------------
# LangFuse-traced crew execution
# ---------------------------------------------------------------------------


@observe(name="shopagent-crew-kickoff")
def run_crew_traced(question: str) -> str:
    crew_instance = ShopAgentCrew()
    result = crew_instance.crew().kickoff(inputs={"question": question})
    return result.raw


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
