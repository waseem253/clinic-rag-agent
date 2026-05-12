"""pgvector connection + schema bootstrap."""
import psycopg
from psycopg.rows import dict_row
from .config import DATABASE_URL, EMBED_DIMS


def connect(url: str | None = None):
    # prepare_threshold=None disables prepared-statement caching, which is required
    # when connecting through Supabase's transaction pooler (port 6543).
    return psycopg.connect(url or DATABASE_URL, row_factory=dict_row, prepare_threshold=None)


SCHEMA = f"""
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS documents (
    id          SERIAL PRIMARY KEY,
    source      TEXT NOT NULL UNIQUE,   -- e.g. cdc_sti_treatment_2021.pdf
    title       TEXT,
    publisher   TEXT,                   -- CDC, USPSTF, NHLBI, ...
    pub_year    INT,
    pages       INT,
    ingested_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chunks (
    id           BIGSERIAL PRIMARY KEY,
    document_id  INT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    chunk_idx    INT NOT NULL,            -- ordinal within document
    heading_path TEXT,                    -- e.g. "Syphilis > Treatment > Adults"
    page_start   INT,
    page_end     INT,
    text         TEXT NOT NULL,
    token_count  INT,
    embedding    vector({EMBED_DIMS}),
    tsv          tsvector GENERATED ALWAYS AS (to_tsvector('english', text)) STORED
);

CREATE INDEX IF NOT EXISTS chunks_tsv_idx       ON chunks USING GIN (tsv);
CREATE INDEX IF NOT EXISTS chunks_document_idx  ON chunks (document_id, chunk_idx);
-- HNSW index for cosine similarity; built after bulk insert for speed
"""

HNSW_INDEX = """
CREATE INDEX IF NOT EXISTS chunks_embedding_hnsw
    ON chunks USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);
"""


def bootstrap():
    with connect() as conn, conn.cursor() as cur:
        cur.execute(SCHEMA)
        conn.commit()
    print("Schema OK.")


def build_hnsw():
    with connect() as conn, conn.cursor() as cur:
        cur.execute(HNSW_INDEX)
        conn.commit()
    print("HNSW index built.")


if __name__ == "__main__":
    bootstrap()
