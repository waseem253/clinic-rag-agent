"""
LangGraph clinical RAG agent.

Graph:
    start
      │
      ▼
    triage  ──► out_of_scope ──► end
      │
      ▼
    retrieve  (hybrid: vector + tsvector + rerank)
      │
      ▼
    grade  (does the evidence actually answer the question?)
      │           │
      │ enough    │ insufficient
      ▼           ▼
    answer    refine_query ──► retrieve (loop, max 2x)
      │
      ▼
    end

Key design choices:
- Triage rejects anything that isn't a clinical-guideline question (PHI gate,
  cosmetic chat, etc.) before spending tokens on retrieval.
- Grade is a separate LLM call so the agent can self-correct — if the rerank
  shortlist doesn't cover the question, we rewrite the query and retry.
- Every answer carries inline citations like [cdc_sti_treatment_2021.pdf p.45].
"""
from dataclasses import dataclass, field
from typing import Literal, TypedDict
import anthropic
from langgraph.graph import StateGraph, END

from .config import ANTHROPIC_API_KEY, CLAUDE_MODEL
from .retrieval import hybrid_search, Hit


class AgentState(TypedDict, total=False):
    question: str
    refined_question: str
    hits: list[Hit]
    grade: Literal["sufficient", "insufficient"]
    retries: int
    triage: Literal["clinical", "out_of_scope"]
    answer: str
    citations: list[str]


_client: anthropic.Anthropic | None = None


def _claude() -> anthropic.Anthropic:
    global _client
    if _client is None:
        _client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    return _client


def _ask(system: str, user: str, max_tokens: int = 1024) -> str:
    r = _claude().messages.create(
        model=CLAUDE_MODEL,
        max_tokens=max_tokens,
        system=system,
        messages=[{"role": "user", "content": user}],
    )
    return r.content[0].text.strip()


# ---------- nodes ----------

TRIAGE_SYSTEM = (
    "You are a triage classifier for a clinical-guideline RAG agent. "
    "Classify the user's question as either 'clinical' (a question about "
    "screening, prevention, treatment, dosing, or evidence-based recommendations "
    "that could be answered from CDC/USPSTF/NHLBI guidelines) or 'out_of_scope' "
    "(small talk, scheduling, billing, personal medical advice without context, "
    "or anything else). Reply with ONLY one word: clinical OR out_of_scope."
)


def node_triage(state: AgentState) -> AgentState:
    label = _ask(TRIAGE_SYSTEM, state["question"], max_tokens=4).lower()
    return {**state, "triage": "clinical" if "clinical" in label else "out_of_scope"}


def node_retrieve(state: AgentState) -> AgentState:
    q = state.get("refined_question") or state["question"]
    hits = hybrid_search(q, top_n=6, rerank=True)
    return {**state, "hits": hits}


GRADE_SYSTEM = (
    "You are an evidence-grading assistant. Given a clinical question and "
    "retrieved guideline excerpts, decide whether the excerpts contain enough "
    "specific information to answer the question accurately. "
    "Reply with ONLY one word: sufficient OR insufficient."
)


def node_grade(state: AgentState) -> AgentState:
    if not state.get("hits"):
        return {**state, "grade": "insufficient"}
    evidence = "\n\n".join(f"[{i+1}] {h.text[:400]}" for i, h in enumerate(state["hits"]))
    label = _ask(GRADE_SYSTEM, f"Question: {state['question']}\n\nEvidence:\n{evidence}", max_tokens=4).lower()
    return {**state, "grade": "sufficient" if "sufficient" in label else "insufficient"}


REFINE_SYSTEM = (
    "Rewrite the user's clinical question to improve retrieval recall. "
    "Use precise medical terminology, expand acronyms, and include synonyms a "
    "clinical guideline would use (e.g. 'colorectal cancer screening' instead "
    "of 'CRC test'). Output ONLY the rewritten question on one line."
)


def node_refine(state: AgentState) -> AgentState:
    refined = _ask(REFINE_SYSTEM, state["question"], max_tokens=80)
    return {**state, "refined_question": refined, "retries": state.get("retries", 0) + 1}


ANSWER_SYSTEM = (
    "You are a clinical-guideline assistant. Answer the question using ONLY the "
    "provided evidence. Cite every factual claim inline using bracketed markers "
    "like [1], [2]. If the evidence does not cover something, say so explicitly — "
    "do not extrapolate. Keep the answer concise and clinically actionable. "
    "End with a short bullet list of the citations used, like:\n"
    "  [1] cdc_sti_treatment_2021.pdf p.45 — Syphilis > Treatment"
)


def node_answer(state: AgentState) -> AgentState:
    hits = state["hits"]
    evidence_block = "\n\n".join(
        f"[{i+1}] {h.text}\n  source: {h.source} {('p.'+str(h.page_start)) if h.page_start else ''} {('— '+h.heading_path) if h.heading_path else ''}"
        for i, h in enumerate(hits)
    )
    prompt = f"Question: {state['question']}\n\nEvidence:\n{evidence_block}"
    answer = _ask(ANSWER_SYSTEM, prompt, max_tokens=1024)
    citations = [h.cite() for h in hits]
    return {**state, "answer": answer, "citations": citations}


def node_out_of_scope(state: AgentState) -> AgentState:
    return {**state, "answer": (
        "I can only answer evidence-based clinical questions sourced from "
        "CDC, USPSTF, and NHLBI guidelines (screening, prevention, treatment, "
        "dosing). Please rephrase your question with that scope in mind."
    ), "citations": []}


# ---------- graph ----------

def _route_after_triage(state: AgentState) -> str:
    return "retrieve" if state["triage"] == "clinical" else "out_of_scope"


def _route_after_grade(state: AgentState) -> str:
    if state["grade"] == "sufficient":
        return "answer"
    if state.get("retries", 0) >= 2:
        return "answer"  # give up gracefully, let answer node hedge
    return "refine"


def build_graph():
    g = StateGraph(AgentState)
    g.add_node("triage", node_triage)
    g.add_node("retrieve", node_retrieve)
    g.add_node("grade", node_grade)
    g.add_node("refine", node_refine)
    g.add_node("answer", node_answer)
    g.add_node("out_of_scope", node_out_of_scope)

    g.set_entry_point("triage")
    g.add_conditional_edges("triage", _route_after_triage,
                            {"retrieve": "retrieve", "out_of_scope": "out_of_scope"})
    g.add_edge("retrieve", "grade")
    g.add_conditional_edges("grade", _route_after_grade,
                            {"answer": "answer", "refine": "refine"})
    g.add_edge("refine", "retrieve")
    g.add_edge("answer", END)
    g.add_edge("out_of_scope", END)
    return g.compile()


def ask(question: str) -> AgentState:
    graph = build_graph()
    return graph.invoke({"question": question, "retries": 0})
