"""
Hybrid retrieval over the chunks table:
  1. Vector search (cosine, HNSW)
  2. Full-text search (tsvector GIN, ts_rank_cd)
  3. Reciprocal Rank Fusion merge
  4. Optional Cohere rerank-3.5 on the top fused candidates

Each hit returns the chunk text, heading_path, page range, and source doc —
the agent uses those as citation anchors.
"""
import time
from dataclasses import dataclass
from typing import Iterable
import cohere

from .config import COHERE_API_KEY
from .db import connect
from .embedding import embed


@dataclass
class Hit:
    chunk_id: int
    source: str
    heading_path: str | None
    page_start: int | None
    page_end: int | None
    text: str
    score: float

    def cite(self) -> str:
        pages = f"p.{self.page_start}" if self.page_start == self.page_end else f"pp.{self.page_start}-{self.page_end}"
        head = f" — {self.heading_path}" if self.heading_path else ""
        return f"[{self.source} {pages}{head}]"


def vector_search(query: str, k: int = 20) -> list[Hit]:
    qv = embed([query], input_type="query")[0]
    sql = """
        SELECT c.id, d.source, c.heading_path, c.page_start, c.page_end, c.text,
               1 - (c.embedding <=> %s::vector) AS score
          FROM chunks c
          JOIN documents d ON d.id = c.document_id
         ORDER BY c.embedding <=> %s::vector
         LIMIT %s
    """
    with connect() as conn, conn.cursor() as cur:
        cur.execute(sql, (qv, qv, k))
        return [Hit(r["id"], r["source"], r["heading_path"], r["page_start"],
                    r["page_end"], r["text"], r["score"]) for r in cur.fetchall()]


def keyword_search(query: str, k: int = 20) -> list[Hit]:
    sql = """
        SELECT c.id, d.source, c.heading_path, c.page_start, c.page_end, c.text,
               ts_rank_cd(c.tsv, plainto_tsquery('english', %s)) AS score
          FROM chunks c
          JOIN documents d ON d.id = c.document_id
         WHERE c.tsv @@ plainto_tsquery('english', %s)
         ORDER BY score DESC
         LIMIT %s
    """
    with connect() as conn, conn.cursor() as cur:
        cur.execute(sql, (query, query, k))
        return [Hit(r["id"], r["source"], r["heading_path"], r["page_start"],
                    r["page_end"], r["text"], r["score"]) for r in cur.fetchall()]


def rrf(rankings: Iterable[list[Hit]], k: int = 60) -> list[Hit]:
    """Reciprocal Rank Fusion. Standard k=60. Higher rank → higher RRF score."""
    fused: dict[int, tuple[Hit, float]] = {}
    for ranking in rankings:
        for rank, hit in enumerate(ranking, start=1):
            score = 1.0 / (k + rank)
            if hit.chunk_id in fused:
                existing_hit, existing_score = fused[hit.chunk_id]
                fused[hit.chunk_id] = (existing_hit, existing_score + score)
            else:
                fused[hit.chunk_id] = (hit, score)
    ordered = sorted(fused.values(), key=lambda x: x[1], reverse=True)
    return [Hit(h.chunk_id, h.source, h.heading_path, h.page_start, h.page_end, h.text, s)
            for h, s in ordered]


def cohere_rerank(query: str, hits: list[Hit], top_n: int = 5) -> list[Hit]:
    if not COHERE_API_KEY or COHERE_API_KEY.startswith(("...", "your-")) or not hits:
        return hits[:top_n]
    co = cohere.ClientV2(api_key=COHERE_API_KEY)
    # Cohere trial keys are capped at 10 rerank calls/min; back off on 429.
    for attempt in range(3):
        try:
            resp = co.rerank(
                model="rerank-v3.5",
                query=query,
                documents=[h.text for h in hits],
                top_n=min(top_n, len(hits)),
            )
            break
        except cohere.errors.too_many_requests_error.TooManyRequestsError:
            if attempt == 2:
                # Give up gracefully — fall back to RRF order.
                return hits[:top_n]
            time.sleep(7 * (attempt + 1))
    else:
        return hits[:top_n]
    out = []
    for r in resp.results:
        h = hits[r.index]
        out.append(Hit(h.chunk_id, h.source, h.heading_path, h.page_start,
                       h.page_end, h.text, float(r.relevance_score)))
    return out


def hybrid_search(query: str, k_each: int = 20, top_n: int = 5, rerank: bool = True) -> list[Hit]:
    vec = vector_search(query, k=k_each)
    kw = keyword_search(query, k=k_each)
    fused = rrf([vec, kw])[: max(top_n * 4, 20)]  # rerank a shortlist
    if rerank:
        return cohere_rerank(query, fused, top_n=top_n)
    return fused[:top_n]
