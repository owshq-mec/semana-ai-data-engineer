# DEFINE: Multi-Agent ShopAgent — CrewAI 3-Agent Crew with Evaluation & Observability

> A CrewAI-powered multi-agent system with 3 specialized agents (AnalystAgent for SQL, ResearchAgent for semantic search, ReporterAgent for executive synthesis), Chainlit step-by-step frontend, DeepEval evaluation, LangFuse observability, and zero-change cloud migration.

## Metadata

| Attribute | Value |
|-----------|-------|
| **Feature** | SHOPAGENT_DAY4 |
| **Date** | 2026-04-16 |
| **Author** | define-agent (from BRAINSTORM_SHOPAGENT_DAY4) |
| **Status** | Ready for Design |
| **Clarity Score** | 15/15 |

---

## Problem Statement

Day 3's single LangGraph ReAct agent attempts to handle SQL queries, semantic search, AND report synthesis in one chain of thought. When faced with complex, multi-faceted questions (e.g., "Analise completa de satisfacao por regiao com impacto financeiro e plano de acao"), it produces incomplete or disorganized results because one agent cannot specialize in all three disciplines simultaneously. Day 4 must decompose this into a team of 3 specialist agents that execute sequentially — each doing one thing well — producing a coherent executive report that no single agent could generate alone.

---

## Target Users

| User | Role | Pain Point |
|------|------|------------|
| Workshop Participant | AI Data Engineer student (200+ attendees) | Day 3's single agent produces mediocre results for complex questions; no way to specialize or evaluate agent quality |
| Instructor (Luan) | Live demo presenter | Needs a visually compelling multi-agent demo where each specialist's contribution is visible, measurable, and traceable |

---

## Goals

| Priority | Goal |
|----------|------|
| **MUST** | 3-agent crew (Analyst, Researcher, Reporter) executes sequentially via CrewAI |
| **MUST** | Agent and task definitions in YAML files (`agents.yaml`, `tasks.yaml`) |
| **MUST** | `supabase_execute_sql` tool connects to Postgres via env-based `psycopg2` connection |
| **MUST** | `qdrant_semantic_search` tool uses direct `qdrant_client` + FastEmbed (no LlamaIndex) |
| **MUST** | ReporterAgent receives context from both Analyst and Researcher outputs |
| **MUST** | Chainlit frontend shows each agent's execution as a separate `cl.Step` |
| **MUST** | DeepEval test suite with ToolCorrectness + AnswerRelevancy + custom GEval metric |
| **MUST** | Cloud migration by swapping env vars only — zero code changes |
| **SHOULD** | LangFuse callback integration traces per-agent token usage, latency, and cost |
| **SHOULD** | E-commerce frontend HTML page with product catalog and chat widget concept |
| **COULD** | CLI fallback (`python src/day4/crew.py`) for when Chainlit integration needs debugging |

---

## Success Criteria

- [ ] Crew completes "Qual o faturamento total por estado?" with AnalystAgent writing valid SQL
- [ ] Crew completes "Quais as principais reclamacoes dos clientes?" with ResearchAgent returning review themes
- [ ] Crew completes "Analise completa por regiao com faturamento e satisfacao" using ALL 3 agents sequentially
- [ ] ReporterAgent output contains: data summary, customer insights, AND actionable recommendations
- [ ] Chainlit UI shows 3 distinct `cl.Step` entries (one per agent) with intermediate results visible
- [ ] DeepEval `ToolCorrectnessMetric` passes for SQL-only, Qdrant-only, and hybrid test cases
- [ ] DeepEval `AnswerRelevancyMetric` scores above 0.7 for all test cases
- [ ] DeepEval custom `GEval` metric confirms report contains data + insights + recommendations
- [ ] Switching `POSTGRES_HOST`/`QDRANT_URL` env vars from localhost to cloud produces identical behavior with zero code changes
- [ ] LangFuse dashboard shows separate spans per agent with token counts and latency
- [ ] Full crew execution (3 agents) completes in under 90 seconds

---

## Acceptance Tests

| ID | Scenario | Given | When | Then |
|----|----------|-------|------|------|
| AT-001 | SQL-only routing | Crew is running, Postgres has data | User asks "Faturamento total por categoria" | AnalystAgent calls `supabase_execute_sql` with valid GROUP BY query, returns revenue by category |
| AT-002 | Semantic-only routing | Crew is running, Qdrant has 203 reviews | User asks "Principais reclamacoes sobre entrega" | ResearchAgent calls `qdrant_semantic_search`, returns complaint themes with similarity scores |
| AT-003 | Full sequential flow | Both stores available | User asks "Analise completa de satisfacao por regiao com impacto financeiro e plano de acao" | AnalystAgent queries revenue → ResearchAgent queries reviews → ReporterAgent synthesizes executive report |
| AT-004 | Context passing | Crew with sequential process | Reporter task executes | ReporterAgent output references specific numbers from Analyst AND specific themes from Researcher |
| AT-005 | Chainlit step visibility | Chainlit UI is open | User sends a hybrid question | UI shows 3 `cl.Step` entries: "AnalystAgent" with SQL, "ResearchAgent" with reviews, "ReporterAgent" with report |
| AT-006 | DeepEval tool correctness | Test suite defined with 3 cases | Run `deepeval test run src/day4/eval_agent.py` | All 3 test cases pass ToolCorrectness (correct tool selected per question type) |
| AT-007 | Cloud migration | `.env` has cloud URLs for Supabase + Qdrant | Run same crew code | Identical output — same agents, same tools, cloud endpoints |
| AT-008 | LangFuse tracing | `LANGFUSE_*` env vars set | Crew executes | LangFuse dashboard shows 3 agent spans with token usage and latency |
| AT-009 | CLI execution | No Chainlit running | Run `python src/day4/crew.py` | Crew executes in terminal, prints final report |
| AT-010 | YAML config modification | `agents.yaml` exists | Change AnalystAgent's `backstory` | Crew uses updated backstory without touching Python code |

---

## Out of Scope

- **Hierarchical CrewAI process** — Sequential is sufficient for 3 agents; hierarchical adds manager-agent complexity
- **CrewAI built-in memory** — Agents access Qdrant directly via tool; CrewAI memory would be redundant
- **Agent delegation** — `allow_delegation=False`; deterministic flow for live demos
- **Custom LLM per agent** — Same Claude model for all 3 simplifies setup and cost tracking
- **Async crew execution** — `crew.kickoff()` is synchronous; async adds complexity without benefit for sequential
- **LlamaIndex dependency** — Day 4 uses `qdrant_client` + FastEmbed directly; LlamaIndex was Day 2-3 only
- **LangChain/LangGraph dependency** — Day 4 uses CrewAI; LangChain was Day 3 only
- **Multi-turn conversation memory** — Each crew kickoff is independent; conversation context is not carried
- **SQL write protection** — Cloud Supabase has RLS; local Docker is throwaway
- **Production deployment** — This is a live-coded teaching system, not a production service

---

## Constraints

| Type | Constraint | Impact |
|------|------------|--------|
| Technical | Must use CrewAI `@CrewBase` with YAML config (`agents.yaml` + `tasks.yaml`) | Declarative agent definitions, separated from orchestration code |
| Technical | Must use `anthropic/claude-sonnet-4-20250514` as LLM for all agents | Consistent with Days 1-3; CrewAI uses litellm format |
| Technical | Tools must use CrewAI `@tool` decorator (not LangChain) | Framework-native tool definitions |
| Technical | `qdrant_semantic_search` must use `qdrant_client` + `fastembed` directly (no LlamaIndex) | Cleaner dependency graph for Day 4 |
| Technical | `supabase_execute_sql` must connect via `psycopg2` with env-based host/port/db/user/password | Cloud migration via env vars only |
| Technical | Python 3.11+ with type hints | Project convention |
| Technical | `allow_delegation=False` on all agents | Deterministic sequential flow |
| Timeline | Must be live-coded across 11 prompts in ~2.5 hours (20h00-22h30 on 2026-04-16) | Code must be concise; clear separation of concerns across files |
| Dependency | Day 2 ingest must be complete (Postgres populated, Qdrant indexed with 203 reviews) | Agents have no data to query otherwise |
| Dependency | `.env` must have `ANTHROPIC_API_KEY` set | All LLM calls fail without it |

---

## Technical Context

| Aspect | Value | Notes |
|--------|-------|-------|
| **Deployment Location** | `src/day4/` | Follows per-day directory convention |
| **KB Domains** | crewai, deepeval, langfuse, chainlit, qdrant, supabase, genai, python, testing | Multi-agent orchestration, evaluation, observability, UI, both data stores |
| **IaC Impact** | None for local; cloud requires Supabase + Qdrant Cloud credentials in `.env` | No new Docker services; cloud migration is env-var only |

---

## Data Contract

### Source Inventory

| Source | Type | Volume | Freshness | Owner |
|--------|------|--------|-----------|-------|
| customers | Postgres table | ~500 rows (ShadowTraffic generated) | Static after Day 1 ingest | gen/shadowtraffic.json |
| products | Postgres table | ~50 rows | Static after Day 1 ingest | gen/shadowtraffic.json |
| orders | Postgres table | ~2000+ rows (continuously generated) | Real-time via ShadowTraffic | gen/shadowtraffic.json |
| reviews | Qdrant collection `shopagent_reviews` | 203 documents | Static after Day 2 ingest | gen/data/reviews/reviews.jsonl |

### Schema Contract (Postgres — The Ledger)

| Table | Column | Type | Constraints | PII? |
|-------|--------|------|-------------|------|
| customers | customer_id | UUID | PK | No |
| customers | name | VARCHAR(255) | NOT NULL | Yes |
| customers | email | VARCHAR(255) | NOT NULL | Yes |
| customers | city | VARCHAR(100) | | No |
| customers | state | CHAR(2) | | No |
| customers | segment | VARCHAR(20) | CHECK: premium/standard/basic | No |
| products | product_id | UUID | PK | No |
| products | name | VARCHAR(255) | NOT NULL | No |
| products | category | VARCHAR(100) | NOT NULL | No |
| products | price | DECIMAL(10,2) | CHECK > 0 | No |
| products | brand | VARCHAR(100) | | No |
| orders | order_id | UUID | PK | No |
| orders | customer_id | UUID | FK → customers | No |
| orders | product_id | UUID | FK → products | No |
| orders | qty | INTEGER | CHECK 1-10 | No |
| orders | total | DECIMAL(10,2) | CHECK >= 0 | No |
| orders | status | VARCHAR(20) | CHECK: delivered/shipped/processing/cancelled | No |
| orders | payment | VARCHAR(20) | CHECK: pix/credit_card/boleto | No |
| orders | created_at | TIMESTAMPTZ | DEFAULT now() | No |

### Schema Contract (Qdrant — The Memory)

| Field | Type | Notes |
|-------|------|-------|
| review_id | UUID | Document ID in Qdrant point |
| order_id | UUID | Payload field, FK → orders |
| rating | INTEGER (1-5) | Payload field, star rating |
| comment | TEXT (Portuguese) | Embedded via BAAI/bge-base-en-v1.5 (768-dim) |
| sentiment | STRING | Payload field: positive / negative |

### Tool Output Contracts

| Tool | Input | Output Format |
|------|-------|---------------|
| `supabase_execute_sql` | SQL query string | Column headers + pipe-separated rows (text) |
| `qdrant_semantic_search` | Natural language question | Top 5 results with score, rating, comment excerpt (text) |

---

## Assumptions

| ID | Assumption | If Wrong, Impact | Validated? |
|----|------------|------------------|------------|
| A-001 | Docker infra (Postgres + Qdrant) is running from Days 1-2 | Tools cannot connect to either store | [x] Validated via docker-compose.yml |
| A-002 | Qdrant collection `shopagent_reviews` has 203 reviews with BAAI/bge-base-en-v1.5 embeddings | Semantic search returns empty or wrong results | [x] Validated via Day 2 ingest |
| A-003 | CrewAI `@CrewBase` supports YAML-based agent/task config with `@tool` decorator | Would need inline Python definitions as fallback | [ ] Verify at build time |
| A-004 | CrewAI Sequential process passes prior task output as context to subsequent tasks | ReporterAgent receives empty context; report is hollow | [ ] Verify at build time |
| A-005 | CrewAI supports callbacks compatible with LangFuse handler | LangFuse tracing won't work; observability deferred | [ ] Verify at build time |
| A-006 | `fastembed` can encode queries using BAAI/bge-base-en-v1.5 without LlamaIndex | Need to fall back to LlamaIndex embedding | [x] fastembed is a standalone library |
| A-007 | CrewAI `kickoff()` completion events can be bridged to Chainlit `cl.Step` | Chainlit shows no intermediate steps; falls back to final-result-only | [ ] Verify at build time |
| A-008 | DeepEval ToolCorrectnessMetric works with CrewAI tool calls | Metric evaluation fails; use AnswerRelevancy only | [ ] Verify at build time |
| A-009 | Cloud Supabase accepts same SQL queries as local Postgres | SQL dialect differences cause failures | [x] Supabase is Postgres-native |
| A-010 | `ANTHROPIC_API_KEY` is set in `.env` | All LLM calls fail with auth error | [x] Validated via .env.example |

---

## Clarity Score Breakdown

| Element | Score (0-3) | Notes |
|---------|-------------|-------|
| Problem | 3 | Specific: single-agent degradation on complex questions → multi-agent decomposition. Clear who (participants + instructor), clear impact (coherent executive reports) |
| Users | 3 | Two personas with distinct pain points. 200+ participant scale documented |
| Goals | 3 | 11 goals with MoSCoW priority. Every MUST goal is testable. SHOULD and COULD are explicit deferrals |
| Success | 3 | 11 measurable criteria including: specific test questions, metric thresholds (relevancy > 0.7), performance target (<90s), and behavioral tests (zero code changes for cloud) |
| Scope | 3 | 10 items explicitly excluded with rationale. Constraints include timeline (2.5hr live session), technical bounds (CrewAI-only, no delegation), and dependencies (Days 1-2 data) |
| **Total** | **15/15** | |

---

## Open Questions

None — ready for Design. All decisions pre-validated in BRAINSTORM phase:
- YAML-first config (not inline) ✓
- Rewrite tools from scratch (not reuse Day 3) ✓
- Direct qdrant_client + FastEmbed (not LlamaIndex) ✓
- Step-by-step Chainlit (not spinner-only) ✓
- Full DeepEval suite (not minimal) ✓
- Sequential process (not hierarchical) ✓
- No delegation (deterministic flow) ✓

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-04-16 | define-agent | Initial version from BRAINSTORM_SHOPAGENT_DAY4.md |

---

## Next Step

**Ready for:** `/design .claude/sdd/features/DEFINE_SHOPAGENT_DAY4.md`
