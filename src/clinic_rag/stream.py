"""
Streaming variant of the LangGraph agent.

Why a separate module: LangGraph's `invoke` is great for batch use, but the
UI wants progressive events (each node lighting up, then token-by-token answer
streaming). This module manually orchestrates the same flow but yields SSE
events at every step.

Event protocol:
    {"type": "trace", "node": "triage|retrieve|grade|refine|answer",
     "status": "running|done", ...payload}
    {"type": "hits",  "hits": [{"source", "page_start", "page_end",
                                "heading_path", "text", "score"}, ...]}
    {"type": "token", "text": "..."}
    {"type": "done",  "citations": [...]}
"""
from __future__ import annotations
import json
from typing import Iterator
import anthropic

from .config import ANTHROPIC_API_KEY, CLAUDE_MODEL
from .retrieval import hybrid_search, Hit
from .agent import (
    TRIAGE_SYSTEM, GRADE_SYSTEM, REFINE_SYSTEM, ANSWER_SYSTEM, _ask,
)


_client: anthropic.Anthropic | None = None


def _claude() -> anthropic.Anthropic:
    global _client
    if _client is None:
        _client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    return _client


def _hit_dict(h: Hit, idx: int) -> dict:
    return {
        "idx": idx,
        "chunk_id": h.chunk_id,
        "source": h.source,
        "heading_path": h.heading_path,
        "page_start": h.page_start,
        "page_end": h.page_end,
        "text": h.text,
        "score": round(h.score, 4),
    }


def _evt(payload: dict) -> str:
    return f"data: {json.dumps(payload)}\n\n"


def stream_ask(question: str) -> Iterator[str]:
    # --- TRIAGE ---
    yield _evt({"type": "trace", "node": "triage", "status": "running"})
    label = _ask(TRIAGE_SYSTEM, question, max_tokens=4).lower()
    triage = "clinical" if "clinical" in label else "out_of_scope"
    yield _evt({"type": "trace", "node": "triage", "status": "done", "value": triage})

    if triage == "out_of_scope":
        msg = ("I can only answer evidence-based clinical questions sourced from "
               "CDC, USPSTF, and NHLBI guidelines (screening, prevention, treatment, "
               "dosing). Please rephrase your question with that scope in mind.")
        for word in msg.split(" "):
            yield _evt({"type": "token", "text": word + " "})
        yield _evt({"type": "done", "citations": []})
        return

    # --- RETRIEVE → GRADE → maybe REFINE loop (max 2) ---
    retries = 0
    current_q = question
    hits: list[Hit] = []
    grade = "insufficient"

    while True:
        yield _evt({"type": "trace", "node": "retrieve", "status": "running",
                    "query": current_q})
        hits = hybrid_search(current_q, top_n=6, rerank=True)
        yield _evt({"type": "trace", "node": "retrieve", "status": "done",
                    "n_hits": len(hits)})
        yield _evt({"type": "hits", "hits": [_hit_dict(h, i) for i, h in enumerate(hits)]})

        yield _evt({"type": "trace", "node": "grade", "status": "running"})
        evidence = "\n\n".join(f"[{i+1}] {h.text[:400]}" for i, h in enumerate(hits))
        label = _ask(GRADE_SYSTEM,
                     f"Question: {question}\n\nEvidence:\n{evidence}",
                     max_tokens=4).lower()
        grade = "sufficient" if "sufficient" in label else "insufficient"
        yield _evt({"type": "trace", "node": "grade", "status": "done", "value": grade})

        if grade == "sufficient" or retries >= 2:
            break

        yield _evt({"type": "trace", "node": "refine", "status": "running"})
        current_q = _ask(REFINE_SYSTEM, question, max_tokens=80)
        retries += 1
        yield _evt({"type": "trace", "node": "refine", "status": "done",
                    "value": current_q, "retries": retries})

    # --- ANSWER (token streaming) ---
    yield _evt({"type": "trace", "node": "answer", "status": "running"})
    evidence_block = "\n\n".join(
        f"[{i+1}] {h.text}\n  source: {h.source}"
        f"{' p.'+str(h.page_start) if h.page_start else ''}"
        f"{' — '+h.heading_path if h.heading_path else ''}"
        for i, h in enumerate(hits)
    )
    prompt = f"Question: {question}\n\nEvidence:\n{evidence_block}"

    with _claude().messages.stream(
        model=CLAUDE_MODEL,
        max_tokens=1024,
        system=ANSWER_SYSTEM,
        messages=[{"role": "user", "content": prompt}],
    ) as stream:
        for text in stream.text_stream:
            yield _evt({"type": "token", "text": text})

    yield _evt({"type": "trace", "node": "answer", "status": "done"})
    yield _evt({"type": "done",
                "citations": [_hit_dict(h, i) for i, h in enumerate(hits)]})
