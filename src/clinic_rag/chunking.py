"""
Heading-aware chunker for clinical guidelines.

Strategy:
- Docling parses PDF → DoclingDocument with hierarchical headings.
- HybridChunker walks the doc, respects heading boundaries, and packs
  text into ~target_tokens chunks with the heading path attached.
- Each chunk knows its source doc, ordinal index, heading breadcrumb,
  and approximate page range — those become metadata in pgvector and
  citation anchors in the final agent.
"""
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from docling.document_converter import DocumentConverter
from docling.chunking import HybridChunker
from transformers import AutoTokenizer

EMBED_TOKENIZER = "cl100k_base"  # close enough for sizing; embeddings tokenize separately
TARGET_TOKENS = 500


@dataclass
class Chunk:
    source: str
    chunk_idx: int
    heading_path: str
    page_start: int | None
    page_end: int | None
    text: str
    token_count: int


def _heading_path(meta) -> str:
    headings = getattr(meta, "headings", None) or []
    return " > ".join(h for h in headings if h)


def _page_range(meta) -> tuple[int | None, int | None]:
    items = getattr(meta, "doc_items", None) or []
    pages: list[int] = []
    for it in items:
        for prov in getattr(it, "prov", []) or []:
            p = getattr(prov, "page_no", None)
            if p is not None:
                pages.append(p)
    if not pages:
        return None, None
    return min(pages), max(pages)


def chunk_pdf(pdf_path: Path, converter: DocumentConverter | None = None) -> list[Chunk]:
    converter = converter or DocumentConverter()
    doc = converter.convert(str(pdf_path)).document

    # HybridChunker uses a HF tokenizer for size control; sentence-transformers
    # MiniLM is a small local tokenizer that approximates BPE length well enough
    # for chunk-size decisions (real embedding happens later with OpenAI).
    tokenizer = AutoTokenizer.from_pretrained("sentence-transformers/all-MiniLM-L6-v2")
    chunker = HybridChunker(tokenizer=tokenizer, max_tokens=TARGET_TOKENS, merge_peers=True)

    out: list[Chunk] = []
    for i, ch in enumerate(chunker.chunk(doc)):
        text = chunker.contextualize(chunk=ch)  # prepends heading context
        if not text.strip():
            continue
        page_start, page_end = _page_range(ch.meta)
        out.append(
            Chunk(
                source=pdf_path.name,
                chunk_idx=i,
                heading_path=_heading_path(ch.meta),
                page_start=page_start,
                page_end=page_end,
                text=text,
                token_count=len(tokenizer.encode(text, add_special_tokens=False)),
            )
        )
    return out


def chunk_corpus(corpus_dir: Path) -> Iterable[Chunk]:
    converter = DocumentConverter()
    for pdf in sorted(corpus_dir.glob("*.pdf")):
        print(f"[chunk] {pdf.name}", flush=True)
        yield from chunk_pdf(pdf, converter=converter)
