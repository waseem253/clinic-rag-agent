# Clinical RAG Agent

> Multi-step AI agent that answers clinical questions from CDC, USPSTF & NHLBI guidelines — with inline per-page citations, self-correction on insufficient evidence, and a streaming UI you'd actually want to use in a clinic.

**Stack:** LangGraph · Claude Sonnet 4.6 · Voyage AI embeddings · Cohere rerank-v3.5 · pgvector HNSW · Docling · FastAPI · Next.js 16

---

## What it does

Ask a clinical question. The agent:

1. **Triages** the question (clinical vs. out-of-scope) so it doesn't burn tokens on small talk.
2. **Retrieves** with hybrid search — vector similarity over Voyage embeddings + BM25 / tsvector keyword match, fused via Reciprocal Rank Fusion.
3. **Reranks** the top candidates with Cohere `rerank-v3.5`.
4. **Grades** whether the retrieved evidence actually answers the question. If not, it rewrites the query and retries (max 2x).
5. **Answers** with Claude Sonnet 4.6, streaming tokens in real time, every claim cited inline to a specific page + section of the source PDF.

The UI shows the agent's reasoning live — each LangGraph node lights up as it runs.

---

## Architecture

```
                        ┌──────────────────────────────────┐
                        │   Next.js 16 · App Router · SSE  │
                        │   ┌───────┐ ┌────────┐ ┌──────┐  │
                        │   │ chat  │ │ trace  │ │source│  │
                        │   │ input │ │ panel  │ │ view │  │
                        │   └───────┘ └────────┘ └──────┘  │
                        └────────────────┬─────────────────┘
                                         │ POST /ask (SSE stream)
                                         ▼
                        ┌──────────────────────────────────┐
                        │  FastAPI · uvicorn               │
                        │  /ask  /stats  /sources  /source │
                        └────────────────┬─────────────────┘
                                         │
                                         ▼
              ┌─────────────────────────────────────────────────────┐
              │             LangGraph orchestration                 │
              │                                                     │
              │   triage ──► retrieve ──► grade ──► answer          │
              │       │          ▲          │                       │
              │       │          │          ▼                       │
              │   out_of_scope   └────── refine (loop, max 2x)      │
              └──────┬───────────────────┬───────────────────┬──────┘
                     │                   │                   │
        ┌────────────▼───┐  ┌────────────▼─────┐  ┌──────────▼─────┐
        │  Anthropic     │  │  Voyage AI       │  │  Cohere        │
        │  Claude        │  │  voyage-3-large  │  │  rerank-v3.5   │
        │  Sonnet 4.6    │  │  (1024-d query   │  │  (top-K        │
        │  (triage,      │  │   embeddings)    │  │   reranking)   │
        │   grade, ans)  │  └─────────┬────────┘  └────────────────┘
        └────────────────┘            │
                                      ▼
                        ┌──────────────────────────────────┐
                        │  PostgreSQL + pgvector + tsvector│
                        │  ┌──────────┐  ┌──────────────┐  │
                        │  │ HNSW     │  │ GIN tsvector │  │
                        │  │ cosine   │  │ keyword      │  │
                        │  └──────────┘  └──────────────┘  │
                        │  1,614 chunks · 378 pages        │
                        └──────────────────────────────────┘
                                      ▲
                                      │ one-time ingest
                                      │
                        ┌──────────────────────────────────┐
                        │  Docling (IBM)                   │
                        │  PDF → layout-aware Markdown     │
                        │  → HybridChunker (heading-aware) │
                        └──────────────────────────────────┘
```

### Why these choices

- **Voyage `voyage-3-large` for embeddings** instead of OpenAI — Anthropic's recommended partner, benchmarks competitively on retrieval, and keeps the stack vendor-aligned with Claude.
- **Hybrid retrieval (vector + BM25) + rerank** instead of vector-only — clinical questions mix semantic intent ("treat penicillin allergy") with exact-term recall ("ceftriaxone 500 mg"). Pure vector loses the second, pure keyword loses the first. RRF + rerank fixes both.
- **LangGraph with a grade-and-refine loop** instead of a single retrieval pass — when the corpus doesn't directly cover a question, the agent rewrites it in clinical terminology and retries instead of hallucinating.
- **Docling for parsing** instead of `pypdf` — multi-column USPSTF press releases, CDC MMWR tables, NHLBI bibliography pages all come out with heading hierarchy intact, which is what makes the citation breadcrumbs work.
- **pgvector + HNSW** instead of Pinecone/Weaviate — single Postgres, no extra service, scales fine for clinical-corpus sizes, easy to deploy on Supabase/Neon.

---

## Corpus

8 guideline PDFs (~7.5 MB, 378 pages, 1,614 chunks):

| Document | Publisher | Pages | Chunks |
|---|---|---:|---:|
| `cdc_sti_treatment_2021` | CDC | 192 | 996 |
| `cdc_opioid_prescribing_2022` | CDC | 100 | 384 |
| `cdc_acip_adult_schedule` | CDC | 15 | 65 |
| `nhlbi_atp3_exec_summary` | NHLBI | 40 | 59 |
| `cdc_tb_treatment_2020` | CDC | 16 | 58 |
| `cdc_hypertension_databrief` | CDC | 11 | 40 |
| `uspstf_colorectal_clinician_summary` | USPSTF | 2 | 9 |
| `uspstf_colorectal_cancer` | USPSTF | 2 | 3 |

All sourced from public US federal-health-agency PDFs. No PHI, no patient data — this demo is HIPAA-aware in posture (identity-gated routing, evidence-grounded answers, no extrapolation), not in regulated use.

---

## Local development

### 1. Prereqs

- Python 3.11+
- Node 20+
- Docker (for the pgvector container)
- API keys: [Anthropic](https://console.anthropic.com), [Voyage AI](https://www.voyageai.com), [Cohere](https://dashboard.cohere.com)

### 2. Install

```bash
# Python deps
pip install -e .

# Web deps
cd web && npm install && cd ..

# Postgres + pgvector
docker run -d --name clinic-rag-pgvector \
  -p 5434:5432 \
  -e POSTGRES_USER=ragdev -e POSTGRES_PASSWORD=ragdev_local -e POSTGRES_DB=clinic_rag \
  pgvector/pgvector:pg16

cp .env.example .env
# Fill in ANTHROPIC_API_KEY, VOYAGE_API_KEY, COHERE_API_KEY
```

### 3. Ingest the corpus

```bash
python scripts/01_ingest.py
# Parses 8 PDFs → chunks → embeds with Voyage → loads pgvector → builds HNSW index
# Takes ~3-5 minutes on first run (Docling downloads OCR models)
```

### 4. Run

```bash
# Terminal 1 — FastAPI
python api/server.py

# Terminal 2 — Next.js
cd web && npm run dev

# Open http://localhost:3000
```

---

## Project layout

```
clinic-rag-agent/
├── corpus/                      8 source PDFs
├── parsed/                      Docling markdown output (gitignored)
├── src/clinic_rag/
│   ├── config.py                env + paths
│   ├── db.py                    pgvector schema + HNSW bootstrap
│   ├── chunking.py              Docling HybridChunker (heading-aware)
│   ├── embedding.py             Voyage batched embed
│   ├── retrieval.py             vector + tsvector + RRF + Cohere rerank
│   ├── agent.py                 LangGraph: triage → retrieve → grade → refine/answer
│   └── stream.py                streaming variant emitting SSE events
├── scripts/
│   ├── parse_quality_test.py    Day 1 gate: Docling fidelity check
│   ├── 01_ingest.py             full ingestion pipeline
│   ├── 02_smoke_test_retrieval.py  10-query retrieval sanity test
│   └── 03_agent_test.py         end-to-end LangGraph agent test
├── api/
│   └── server.py                FastAPI · SSE /ask endpoint
└── web/                         Next.js 16 frontend
    └── src/
        ├── app/                 layout, page, globals.css
        ├── components/          Header, TraceGraph, ChatComposer, AnswerView, SourceView
        └── lib/                 SSE consumer, types
```

---

## Roadmap

- [x] Day 1 — Docling parse-quality gate
- [x] Day 2 — Voyage embeddings + pgvector + hybrid retrieval
- [x] Day 3 — LangGraph agent with grade-and-refine
- [x] Day 4 — Streaming Next.js UI (light SaaS theme)
- [ ] Day 5 — Voice mode (Vapi assistant on the same corpus)
- [ ] Production deploy (Supabase + Render + Vercel)
- [ ] RAGAS evaluation harness on a curated Q/A set
- [ ] Expand corpus to AHRQ + ACOG + ADA guidelines

---

## Built by

**Waseem Iftikhar** — AI Voice Engineer
[Upwork](https://www.upwork.com/freelancers/~0166938f759e168a91) · [GitHub](https://github.com/waseem253)
