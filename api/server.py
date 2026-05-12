"""
FastAPI server: SSE streaming endpoint for the clinical RAG agent.

Endpoints:
  GET  /healthz                       liveness
  GET  /stats                         corpus stats for the UI header
  GET  /sources                       list of indexed documents
  GET  /source/{doc}/markdown         parsed markdown of a source (for preview panel)
  POST /ask                           {question} → SSE stream of agent events
"""
from __future__ import annotations
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from clinic_rag.config import PARSED_DIR
from clinic_rag.db import connect
from clinic_rag.stream import stream_ask
from clinic_rag.agent import ask_voice


# CORS — defaults to local dev; override in prod via ALLOWED_ORIGINS (comma-separated).
DEFAULT_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"]
ALLOWED_ORIGINS = (
    [o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "").split(",") if o.strip()]
    or DEFAULT_ORIGINS
)
# Allow any *.vercel.app preview deploy too.
ALLOW_ORIGIN_REGEX = os.environ.get("ALLOWED_ORIGIN_REGEX", r"https://.*\.vercel\.app")

app = FastAPI(title="Clinical RAG Agent API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=ALLOW_ORIGIN_REGEX,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AskBody(BaseModel):
    question: str


@app.get("/healthz")
def healthz() -> dict:
    return {"ok": True}


@app.get("/stats")
def stats() -> dict:
    with connect() as conn, conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) AS n FROM chunks")
        n_chunks = cur.fetchone()["n"]
        cur.execute("SELECT COUNT(*) AS n FROM documents")
        n_docs = cur.fetchone()["n"]
        cur.execute("SELECT COALESCE(SUM(pages), 0) AS p FROM documents")
        pages = cur.fetchone()["p"]
    return {
        "chunks": n_chunks,
        "documents": n_docs,
        "pages": pages,
        "embedder": "voyage-3-large",
        "reranker": "rerank-v3.5",
        "llm": "claude-sonnet-4-6",
    }


@app.get("/sources")
def sources() -> list[dict]:
    with connect() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT source, title, publisher, pages, "
            "(SELECT COUNT(*) FROM chunks WHERE document_id = documents.id) AS chunks "
            "FROM documents ORDER BY source"
        )
        return [dict(r) for r in cur.fetchall()]


@app.get("/source/{doc}/markdown")
def source_markdown(doc: str) -> dict:
    safe = Path(doc).name
    md_path = PARSED_DIR / safe.replace(".pdf", ".md")
    if not md_path.exists():
        raise HTTPException(404, f"No parsed markdown for {safe}")
    return {"source": safe, "markdown": md_path.read_text()}


@app.post("/ask")
def ask(body: AskBody) -> StreamingResponse:
    return StreamingResponse(
        stream_ask(body.question),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # nginx: don't buffer SSE
        },
    )


@app.post("/vapi-rag")
def vapi_rag(body: dict) -> dict:
    """
    Vapi 'custom function' tool endpoint.

    Vapi sends:
      { "message": { "toolCallList": [ { "id": "...", "function": { "name": "rag_query",
                                                                     "arguments": "{\"question\": \"...\"}" } } ] } }
    Vapi expects back:
      { "results": [ { "toolCallId": "...", "result": "..." } ] }
    """
    import json as _json

    msg = body.get("message", body)
    tool_calls = msg.get("toolCallList") or msg.get("tool_calls") or []
    if not tool_calls:
        # Fallback: handle direct {"question": "..."} for debugging
        if "question" in body:
            return ask_voice(body["question"])
        raise HTTPException(400, "No tool calls and no question.")

    results = []
    for tc in tool_calls:
        args_raw = tc.get("function", {}).get("arguments") or "{}"
        args = _json.loads(args_raw) if isinstance(args_raw, str) else args_raw
        question = args.get("question", "")
        out = ask_voice(question)
        results.append({"toolCallId": tc.get("id"), "result": out["answer"]})
    return {"results": results}


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
