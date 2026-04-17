# BRAINSTORM: Multi-Agent ShopAgent (Day 4)

**Feature:** SHOPAGENT_DAY4
**Phase:** 0 — Brainstorm
**Date:** 2026-04-16
**Status:** Complete — Ready for /define

---

## 1. Context

Day 4 is the culmination of the Semana AI Data Engineer 2026. Participants have built:
- **Day 1:** Data generation with ShadowTraffic + Pydantic validation
- **Day 2:** RAG pipeline (LlamaIndex → Qdrant) + SQL queries (Postgres) + MCP
- **Day 3:** Single LangGraph ReAct agent with dual-store routing + Chainlit streaming

Day 3's single agent handles everything — SQL, semantic search, and synthesis — in one brain.
Day 4 decomposes this into a **team of specialists**, mirroring how real organizations work:
the analyst doesn't write the report, the researcher doesn't run SQL.

**Central Question:** *O que eu consigo fazer agora que nao conseguia antes?*

**Autonomy Progression:**
```
Day 1: EU FACO, IA AJUDA         (Claude Code assists)
Day 2: IA BUSCA, EU PERGUNTO     (RAG + Ledger via MCP)
Day 3: IA PROJETA, EU VALIDO     (AgentSpec + autonomous agent)
Day 4: IA CONSTROI, IA EXECUTA   (CrewAI + multi-agent team)  ← THIS
```

---

## 2. Problem Statement

A single ReAct agent (Day 3) struggles with complex, multi-faceted questions like:
> "Analise completa de satisfacao por regiao com impacto financeiro e plano de acao."

It tries to write SQL, search vectors, AND synthesize a report — all in one chain of thought.
The result is often incomplete, disorganized, or misses one dimension entirely.

**The solution:** Decompose into 3 specialized agents that execute sequentially, each building
on the previous agent's output. One question, three specialists, one coherent report.

---

## 3. Discovery Summary

### Questions Asked & Answers

| # | Question | Answer | Impact |
|---|----------|--------|--------|
| 1 | CrewAI config style: YAML vs inline? | **(a) YAML-first** | Declarative config, separates agent definitions from orchestration code |
| 2 | Tool implementation: reuse Day 3 or rewrite? | **(a) Rewrite from scratch** | Clean CrewAI-native tools, reinforces learning, no LlamaIndex dependency |
| 3 | Chainlit integration strategy? | **(b) Step-by-step with cl.Step** | Each agent's output visible in real-time, makes the pipeline tangible |
| 4 | DeepEval evaluation scope? | **(b) Full suite** | ToolCorrectness + AnswerRelevancy + custom metric |
| 5 | Sample data for grounding? | **(a) Existing data sufficient** | Same Postgres + Qdrant stores from Days 1-3 |

---

## 4. Architecture

### 4.1 The 3-Agent Crew

```
Question from User
        │
        ▼
┌─────────────────┐
│  AnalystAgent    │  Tool: supabase_execute_sql
│  SQL specialist  │  Store: The Ledger (Postgres)
│  "The numbers"   │  Output: Revenue, counts, averages
└────────┬────────┘
         │ context passes down
         ▼
┌─────────────────┐
│  ResearchAgent   │  Tool: qdrant_semantic_search
│  Review analyst  │  Store: The Memory (Qdrant)
│  "The meaning"   │  Output: Complaint themes, sentiment
└────────┬────────┘
         │ context passes down
         ▼
┌─────────────────┐
│  ReporterAgent   │  No tools
│  Executive writer│  Input: Both agents' outputs
│  "The story"     │  Output: Executive report
└─────────────────┘
```

**Process:** Sequential (Analyst → Researcher → Reporter)
**LLM:** `anthropic/claude-sonnet-4-20250514` for all agents

### 4.2 Dual-Store Architecture (Unchanged)

| Store | Engine | Role | Day 4 Access |
|-------|--------|------|--------------|
| The Ledger | Postgres (Supabase) | Exact data — revenue, counts, JOINs | `psycopg2` via `supabase_execute_sql` tool |
| The Memory | Qdrant | Meaning — complaints, sentiment, themes | `qdrant_client` + FastEmbed via `qdrant_semantic_search` tool |

### 4.3 File Structure

```
src/day4/
├── __init__.py
├── agents.yaml          # 3 agent definitions (role, goal, backstory)
├── tasks.yaml           # 3 task definitions (description, expected_output, agent)
├── crew.py              # @CrewBase orchestration, Sequential process
├── tools.py             # supabase_execute_sql + qdrant_semantic_search
├── chainlit_app.py      # Chainlit frontend with cl.Step per agent
├── eval_agent.py        # DeepEval test suite (3 metrics, 3+ test cases)
└── requirements.txt     # Day 4 specific deps (crewai, deepeval, langfuse)
```

---

## 5. Selected Approach

### Approach A: CrewAI Sequential with YAML Config (SELECTED)

**Why:** Most teachable. YAML separates "who are my agents" from "how do they run."
Sequential process is predictable — participants see each agent fire in order.
CrewAI handles the context passing between agents automatically.

**Pros:**
- Declarative agent/task definitions (YAML) — easy to read and modify
- Sequential process is deterministic — great for live demos
- Built-in context passing via `context=[task_a, task_b]` on ReporterAgent's task
- CrewAI callbacks integrate naturally with LangFuse
- `@tool` decorator is simple and self-documenting

**Cons:**
- CrewAI `kickoff()` is blocking — no native streaming per-token
- YAML + Python split means two places to look (acceptable trade-off for teaching)

### Approach B: LangGraph Multi-Agent (NOT SELECTED)

**Why not:** Day 3 already uses LangGraph. Day 4's point is to show a DIFFERENT framework.
LangGraph multi-agent requires explicit state management and graph construction — more
flexible but harder to teach in a 3-hour live session.

### Approach C: Autogen Multi-Agent (NOT SELECTED)

**Why not:** Autogen's conversation-based model is less intuitive for sequential workflows.
CrewAI's "crew of specialists" metaphor maps directly to the business analogy being taught.

---

## 6. YAGNI — Features Removed

| Feature | Why Removed |
|---------|-------------|
| Hierarchical Process | Sequential is sufficient for 3 agents; hierarchical adds manager-agent complexity with no pedagogical value |
| CrewAI built-in memory | Agents already access Qdrant directly; CrewAI memory would be redundant |
| Agent delegation (`allow_delegation=True`) | Makes flow unpredictable in live demos; keep it deterministic |
| Custom LLM per agent | Same Claude model for all 3 simplifies setup and cost tracking |
| CrewAI knowledge sources | Overkill — tools already handle data access |
| Async crew execution | `crew.kickoff()` is synchronous; async adds complexity without benefit for sequential |

---

## 7. Implementation Sequence (11 Live-Coding Prompts)

| # | Prompt | What Happens | Time |
|---|--------|-------------|------|
| 01 | Multi-agent concept | Show Day 3 struggling → motivate the team pattern | 10min |
| 02 | Crew design | Paper design of 3 agents before code | 10min |
| 03 | AgentSpec build | Generate YAML + project structure via Claude Code | 15min |
| 04 | CrewAI tools | `supabase_execute_sql` + `qdrant_semantic_search` from scratch | 15min |
| 05 | CrewAI crew | `crew.py` with `@CrewBase`, Sequential process | 15min |
| 06 | Crew demo | Run complex question, watch 3 agents collaborate | 10min |
| 07 | Cloud migration | Swap env vars: localhost → Supabase Cloud + Qdrant Cloud | 10min |
| 08 | DeepEval tests | ToolCorrectness + AnswerRelevancy + custom metric | 20min |
| 09 | LangFuse observability | Callbacks, traces, token/cost tracking per agent | 15min |
| 10 | Frontend | E-commerce HTML page with chat widget concept | 15min |
| 11 | Grand finale | Full system end-to-end, the answer to "O que eu consigo?" | 10min |

---

## 8. Key Technical Decisions

### 8.1 Tools — Rewrite, Not Reuse

Day 4 tools are rewritten from scratch using CrewAI's `@tool` decorator:
- `supabase_execute_sql`: `psycopg2` connection via env vars, returns formatted text
- `qdrant_semantic_search`: Direct `qdrant_client` + `fastembed` (no LlamaIndex middleware)

This removes the LlamaIndex dependency from Day 4's stack and gives participants a clean
implementation they fully understand.

### 8.2 Chainlit — Step-by-Step Visibility

Each agent's execution renders as a `cl.Step` in Chainlit:
1. Analyst step opens → shows SQL query + results → closes
2. Researcher step opens → shows semantic query + review excerpts → closes
3. Reporter step opens → streams the final executive report → closes

This requires CrewAI callbacks to detect agent start/end events and bridge them to Chainlit.

### 8.3 Cloud Migration — Zero Code Changes

```
LOCAL (Days 1-3):                    CLOUD (Day 4):
POSTGRES_HOST=localhost         →    SUPABASE_URL=https://xxx.supabase.co
QDRANT_URL=http://localhost:6333 →   QDRANT_CLOUD_URL=https://xxx.cloud.qdrant.io
```

Tools read from env vars. Same code, different endpoints. This is the Docker-First payoff.

### 8.4 DeepEval — Three Metrics

| Metric | What It Measures | Test Cases |
|--------|-----------------|------------|
| ToolCorrectness | Did the agent pick the RIGHT tool? | SQL-only, Qdrant-only, hybrid |
| AnswerRelevancy | Is the final answer relevant to the question? | All 3 cases |
| Custom (GEval) | Does the report contain data + insights + recommendations? | Hybrid case |

### 8.5 LangFuse — Per-Agent Tracing

CrewAI callback handler sends traces to LangFuse:
- Each agent appears as a separate span
- Token usage per agent (Analyst typically uses more for SQL generation)
- Latency breakdown (which agent is the bottleneck?)
- Total cost of crew execution

---

## 9. Dependencies

### New for Day 4
```
crewai>=0.100.0          # Multi-agent orchestration
deepeval>=2.0.0          # LLM evaluation framework
langfuse>=2.50.0         # LLMOps observability
```

### Carried from Days 1-3
```
psycopg2-binary>=2.9.0   # Postgres connection (The Ledger)
qdrant-client>=1.12.0    # Vector DB client (The Memory)
fastembed>=0.4.0          # Local embeddings (BAAI/bge-base-en-v1.5)
chainlit>=2.0.0           # Chat interface
python-dotenv>=1.0.0      # Env var management
anthropic>=0.40.0         # Claude API (used by CrewAI under the hood)
```

### Removed from Day 4
```
llama-index-*             # NOT needed — Day 4 uses qdrant_client directly
langchain-*               # NOT needed — Day 4 uses CrewAI, not LangChain
langgraph                 # NOT needed — Day 4 uses CrewAI Sequential
```

---

## 10. Risk Assessment

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| CrewAI kickoff() is slow (30-60s for 3 agents) | High | Set expectations in the session; show LangFuse to explain WHERE time is spent |
| Chainlit + CrewAI callback integration is brittle | Medium | Have a CLI fallback (`python src/day4/crew.py`) ready |
| DeepEval requires internet for metrics computation | Medium | Pre-run tests before live session; show cached results if needed |
| Cloud Qdrant/Supabase credentials during live demo | Low | Pre-configure before the session; have local Docker as fallback |

---

## 11. Draft Requirements (for /define)

### Functional
- FR1: 3-agent crew (Analyst, Researcher, Reporter) with Sequential process
- FR2: YAML-based agent and task configuration
- FR3: `supabase_execute_sql` tool with env-based Postgres connection
- FR4: `qdrant_semantic_search` tool with direct qdrant_client + FastEmbed
- FR5: Chainlit frontend with cl.Step per agent showing intermediate results
- FR6: DeepEval test suite with ToolCorrectness + AnswerRelevancy + custom metric
- FR7: LangFuse callback integration for per-agent tracing
- FR8: Cloud migration via environment variables only
- FR9: E-commerce frontend HTML page

### Non-Functional
- NFR1: All agents use `anthropic/claude-sonnet-4-20250514`
- NFR2: `allow_delegation=False` on all agents
- NFR3: Tools return formatted text (not raw objects)
- NFR4: All responses in Portuguese
- NFR5: Zero code changes between local and cloud

---

## Next Step

```bash
/define .claude/sdd/features/BRAINSTORM_SHOPAGENT_DAY4.md
```
