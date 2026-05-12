"""Voyage AI embedding client with batched calls."""
from typing import Sequence
import voyageai
from .config import VOYAGE_API_KEY, EMBED_MODEL, EMBED_DIMS

_client: voyageai.Client | None = None


def client() -> voyageai.Client:
    global _client
    if _client is None:
        if not VOYAGE_API_KEY:
            raise RuntimeError("VOYAGE_API_KEY not set — add it to .env")
        _client = voyageai.Client(api_key=VOYAGE_API_KEY)
    return _client


def embed(texts: Sequence[str], input_type: str = "document", batch_size: int = 64) -> list[list[float]]:
    """
    input_type: 'document' for indexing, 'query' for retrieval — Voyage uses
    different prompts internally and this measurably improves retrieval.
    """
    out: list[list[float]] = []
    cli = client()
    for i in range(0, len(texts), batch_size):
        batch = list(texts[i : i + batch_size])
        resp = cli.embed(batch, model=EMBED_MODEL, input_type=input_type)
        out.extend(resp.embeddings)
    return out
