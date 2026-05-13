# Clinical RAG · Multi-Agent Search Over Medical Guidelines

**Live demo →** https://clinic-rag.vercel.app
**Code →** https://github.com/waseem253/clinic-rag-agent

---

## The problem

Clinicians need fast, grounded answers from official guidelines (CDC, USPSTF, NHLBI). Hallucinating LLMs are unsafe in this setting — every claim must trace back to a specific page of a real document, and the system must refuse questions outside its evidence base.

Off-the-shelf RAG demos break on this domain because:
- Clinical PDFs are layout-heavy — multi-column tables, footnotes, drug-dosing matrices — so naive `pypdf` extraction loses structure and citations
- Single-vector retrieval misses exact drug names and dosages; pure keyword search misses semantic intent
- A single LLM call has no way to refuse out-of-scope questions or detect when the evidence doesn't answer the question

## The build (5 days, solo)

| Day | Deliverable | Tech |
|---|---|---|
| 1 | Parse-quality gate over 8 clinical PDFs (378 pages) | Docling (IBM) — layout-aware Markdown |
| 2 | Hybrid retrieval over 1,614 chunks with HNSW + GIN tsvector + RRF + Cohere rerank-v3.5 | pgvector · Voyage `voyage-3-large` |
| 3 | LangGraph agent — triage → retrieve → grade → refine (loop) → answer with inline page-level citations | LangGraph · Claude Sonnet 4.6 |
| 4 | Premium light-mode Next.js 16 UI with SSE token streaming, live pipeline trace, source-preview panel | Next.js 16 · Tailwind · Framer Motion |
| 5 | Live cloud deploy + voice mode | Vercel · Fly.io · Supabase · Vapi |

## Architecture

```
   Next.js 16  ──SSE──▶  FastAPI on Fly.io  ──▶  LangGraph orchestration
   ▲                                              │
   │                                              ├──▶ Voyage AI embeddings
   │                                              ├──▶ pgvector HNSW (Supabase)
   │                                              ├──▶ Cohere rerank-v3.5
   │                                              └──▶ Claude Sonnet 4.6 generation
   │
   └── Vapi voice ──▶ /vapi-rag tool ──▶ same LangGraph pipeline (spoken-output variant)
```

Every answer chunk is anchored to `source.pdf · page N · heading-path`. The grade node uses a separate Claude call to verify the evidence answers the question before generating; if insufficient, a refine node rewrites the query in clinical terminology and retries (max 2 loops).

## Results

| | Local | Live (Fly.io · Supabase) |
|---|---|---|
| Retrieval (vec + BM25 + rerank) | ~1.0s | ~1.2s |
| Triage + grade (Claude) | ~1.0s | ~1.1s |
| Answer streaming first token | ~0.6s | ~0.8s |
| Full answer end-to-end | 3–5s | 3–5s |
| Cited section accuracy (10-query smoke test) | 10/10 correct source doc, 9/10 correct section | identical |

## Why this matters for the client

For a clinic or health-tech company:
- **HIPAA-aware posture by design** — no PHI in this demo, but the architecture supports identity-gated routing, evidence-only answers, BAA-eligible inference vendors (Anthropic + Voyage), and audit logging of every retrieval.
- **Polyglot stack any team can fork** — Python for the agent layer (where data scientists already live), TypeScript for the UI (where most product teams live).
- **Plugs into voice** — same backend serves Vapi via a custom function tool; a clinician can phone the agent and get the same evidence-grounded answer Cora pulls inline.

## Stack

- **Generation:** Claude Sonnet 4.6 via Anthropic API
- **Embeddings:** Voyage AI `voyage-3-large` (1024-d)
- **Reranker:** Cohere `rerank-v3.5`
- **Parser:** Docling (IBM, layout-aware PDF → Markdown)
- **Orchestration:** LangGraph (Python)
- **Vector DB:** PostgreSQL + pgvector (HNSW cosine) on Supabase
- **Keyword index:** Postgres `tsvector` GIN
- **API:** FastAPI + uvicorn (SSE streaming) on Fly.io
- **Frontend:** Next.js 16 (App Router) + Tailwind + Framer Motion on Vercel
- **Voice:** Vapi (Deepgram STT + Aura TTS + custom function tool)

## Built by

**Waseem Iftikhar** — AI Voice Engineer
[Upwork](https://www.upwork.com/freelancers/~0166938f759e168a91) · [GitHub](https://github.com/waseem253) · waseemiftikhar1014@gmail.com
