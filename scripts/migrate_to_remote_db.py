"""
Copy the local clinic_rag DB (documents + chunks with embeddings + tsvector)
to a remote target — Supabase, Neon, RDS, etc.

Usage:
    REMOTE_DATABASE_URL='postgresql://...supabase.co:6543/postgres' \
    python scripts/migrate_to_remote_db.py

Make sure the remote DB has the `vector` extension enabled (Supabase: Database →
Extensions → enable `vector`).
"""
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

import psycopg
from psycopg.rows import dict_row

from clinic_rag.config import DATABASE_URL


REMOTE_DATABASE_URL = os.environ.get("REMOTE_DATABASE_URL")
if not REMOTE_DATABASE_URL:
    print("ERROR: set REMOTE_DATABASE_URL", file=sys.stderr)
    sys.exit(1)


def main() -> None:
    print(f"Source: {DATABASE_URL}")
    print(f"Target: {REMOTE_DATABASE_URL.split('@')[1] if '@' in REMOTE_DATABASE_URL else '...'}")

    # 1. Bootstrap schema on remote
    from clinic_rag.db import SCHEMA, HNSW_INDEX
    with psycopg.connect(REMOTE_DATABASE_URL, prepare_threshold=None) as conn, conn.cursor() as cur:
        cur.execute(SCHEMA)
        conn.commit()
    print("✓ Schema applied to remote")

    # 2. Copy documents
    with psycopg.connect(DATABASE_URL, row_factory=dict_row) as src, src.cursor() as src_cur:
        src_cur.execute("SELECT id, source, title, publisher, pub_year, pages FROM documents ORDER BY id")
        docs = src_cur.fetchall()

    with psycopg.connect(REMOTE_DATABASE_URL, prepare_threshold=None) as dst, dst.cursor() as dst_cur:
        dst_cur.execute("TRUNCATE documents RESTART IDENTITY CASCADE")
        for d in docs:
            dst_cur.execute(
                "INSERT INTO documents (id, source, title, publisher, pub_year, pages) "
                "VALUES (%s, %s, %s, %s, %s, %s)",
                (d["id"], d["source"], d["title"], d["publisher"], d["pub_year"], d["pages"]),
            )
        # Bump the sequence past the max id
        dst_cur.execute("SELECT setval('documents_id_seq', (SELECT MAX(id) FROM documents))")
        dst.commit()
    print(f"✓ Copied {len(docs)} documents")

    # 3. Copy chunks in batches
    BATCH = 200
    with psycopg.connect(DATABASE_URL, row_factory=dict_row) as src, src.cursor() as src_cur, \
         psycopg.connect(REMOTE_DATABASE_URL, prepare_threshold=None) as dst, dst.cursor() as dst_cur:
        src_cur.execute("SELECT COUNT(*) AS n FROM chunks")
        total = src_cur.fetchone()["n"]
        print(f"Copying {total} chunks in batches of {BATCH}…")

        src_cur.execute(
            "SELECT document_id, chunk_idx, heading_path, page_start, page_end, "
            "text, token_count, embedding FROM chunks ORDER BY id"
        )
        moved = 0
        while True:
            batch = src_cur.fetchmany(BATCH)
            if not batch:
                break
            rows = [
                (
                    r["document_id"], r["chunk_idx"], r["heading_path"],
                    r["page_start"], r["page_end"], r["text"],
                    r["token_count"], r["embedding"],
                )
                for r in batch
            ]
            dst_cur.executemany(
                "INSERT INTO chunks (document_id, chunk_idx, heading_path, "
                "page_start, page_end, text, token_count, embedding) "
                "VALUES (%s, %s, %s, %s, %s, %s, %s, %s)",
                rows,
            )
            moved += len(batch)
            print(f"  {moved}/{total}", flush=True)
        dst.commit()

    # 4. Build HNSW index on remote
    print("Building HNSW index on remote…")
    with psycopg.connect(REMOTE_DATABASE_URL) as dst, dst.cursor() as dst_cur:
        dst_cur.execute(HNSW_INDEX)
        dst.commit()
    print("✓ HNSW built")
    print("\nDone. Update DATABASE_URL in your runtime env to point at the remote.")


if __name__ == "__main__":
    main()
