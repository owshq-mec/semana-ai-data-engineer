"""ShopAgent Day 4 — Chainlit frontend with per-agent step visibility."""

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
    loop = asyncio.get_event_loop()

    steps: dict[str, cl.Step] = {}
    for key, label in AGENT_LABELS.items():
        step = cl.Step(name=label, type="run")
        steps[key] = step
        await step.__aenter__()
        step.output = "Aguardando..."
        await step.update()

    crew_obj = crew_instance.crew()

    def task_callback(task_output):
        agent_key = getattr(task_output, "agent", "")
        raw = getattr(task_output, "raw", str(task_output))
        for key in steps:
            if key in str(agent_key).lower():
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

    for step in steps.values():
        await step.__aexit__(None, None, None)

    await cl.Message(content=str(result.raw)).send()


async def _update_step(step: cl.Step, output: str):
    step.output = output
    await step.update()
