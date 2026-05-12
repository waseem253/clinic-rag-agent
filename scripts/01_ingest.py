"""
End-to-end ingestion:
  PDF → Docling parse → HybridChunker → OpenAI embeddings → pgvector

Idempotent: re-running wipes & rebuilds (this is a demo, not a prod pipeline).
"""
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from clinic_rag.config import CORPUS_DIR, EMBED_DIMS
from clinic_rag.db import connect, bootstrap, build_hnsw
from clinic_rag.chunking import chunk_corpus
from clinic_rag.embedding import embed


PUBLISHER_MAP = {
    "cdc_": "CDC",
    "uspstf_": "USPSTF",
    "nhlbi_": "NHLBI",
    "ahrq_": "AHRQ",
}


def publisher_for(filename: str) -> str:
    for prefix, pub in PUBLISHER_MAP.items():
        if filename.startswith(prefix):
            return pub
    return "Unknown"


def main() -> None:
    bootstrap()

    with connect() as conn, conn.cursor() as cur:
        cur.execute("TRUNCATE documents RESTART IDENTITY CASCADE")
        conn.commit()

    chunks = list(chunk_corpus(CORPUS_DIR))
    print(f"\n{len(chunks)} chunks across corpus. Embedding...", flush=True)

    t0 = time.time()
    vectors = embed([c.text for c in chunks])
    print(f"Embedded in {time.time()-t0:.1f}s", flush=True)
    assert len(vectors[0]) == EMBED_DIMS, f"expected {EMBED_DIMS}d, got {len(vectors[0])}"

    by_source: dict[str, list] = {}
    for c in chunks:
        by_source.setdefault(c.source, []).append(c)

    with connect() as conn, conn.cursor() as cur:
        doc_ids: dict[str, int] = {}
        for source, src_chunks in by_source.items():
            max_page = max((c.page_end or 0) for c in src_chunks)
            cur.execute(
                "INSERT INTO documents (source, title, publisher, pages) "
                "VALUES (%s, %s, %s, %s) RETURNING id",
                (source, source.replace("_", " ").rsplit(".", 1)[0], publisher_for(source), max_page),
            )
            doc_ids[source] = cur.fetchone()["id"]

        rows = []
        for c, v in zip(chunks, vectors):
            rows.append((
                doc_ids[c.source], c.chunk_idx, c.heading_path,
                c.page_start, c.page_end, c.text, c.token_count, v,
            ))
        cur.executemany(
            "INSERT INTO chunks (document_id, chunk_idx, heading_path, "
            "page_start, page_end, text, token_count, embedding) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s, %s)",
            rows,
        )
        conn.commit()
        cur.execute("SELECT COUNT(*) AS n FROM chunks")
        print(f"Inserted {cur.fetchone()['n']} chunks.")

    print("\nBuilding HNSW index (cosine)...")
    build_hnsw()
    print("Done.")


if __name__ == "__main__":
    main()
