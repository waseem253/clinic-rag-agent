"""
Day 1 gate: parse a small clinical-guideline corpus with Docling and score the output.
Pass criteria (informal): text extraction works, tables come out structured, headings preserved,
no catastrophic failures on any of the layout-stress PDFs.
"""
from pathlib import Path
import time
import sys
import json

from docling.document_converter import DocumentConverter

ROOT = Path("/Users/waseem/Documents/Workspace/Codebase/clinic-rag-agent")
CORPUS = ROOT / "corpus"
PARSED = ROOT / "parsed"
PARSED.mkdir(exist_ok=True)

pdfs = sorted(CORPUS.glob("*.pdf"))
print(f"Found {len(pdfs)} PDFs in {CORPUS}\n")

converter = DocumentConverter()
results = []

for pdf in pdfs:
    print(f"--- {pdf.name} ({pdf.stat().st_size // 1024} KB) ---")
    t0 = time.time()
    try:
        doc = converter.convert(str(pdf)).document
        elapsed = time.time() - t0

        md = doc.export_to_markdown()
        md_path = PARSED / (pdf.stem + ".md")
        md_path.write_text(md)

        # Quick structural signals
        n_chars = len(md)
        n_lines = md.count("\n")
        n_tables = md.count("|---") + md.count("| ---")
        n_headings = sum(1 for ln in md.split("\n") if ln.lstrip().startswith("#"))
        n_pages = len(doc.pages) if hasattr(doc, "pages") else 0

        result = {
            "name": pdf.name,
            "size_kb": pdf.stat().st_size // 1024,
            "parse_seconds": round(elapsed, 1),
            "pages": n_pages,
            "chars": n_chars,
            "lines": n_lines,
            "headings": n_headings,
            "table_rows_approx": n_tables,
            "md_path": str(md_path.relative_to(ROOT)),
            "status": "OK",
        }
        print(f"  OK   pages={n_pages} chars={n_chars} headings={n_headings} tables~={n_tables} time={elapsed:.1f}s")
    except Exception as e:
        result = {
            "name": pdf.name,
            "size_kb": pdf.stat().st_size // 1024,
            "status": f"FAIL: {type(e).__name__}: {e}",
        }
        print(f"  FAIL {type(e).__name__}: {e}")
    results.append(result)

# Summary
print("\n=== SUMMARY ===")
ok = [r for r in results if r["status"] == "OK"]
fail = [r for r in results if r["status"] != "OK"]
print(f"Parsed OK: {len(ok)}/{len(results)}")
if fail:
    print(f"Failures:")
    for r in fail:
        print(f"  - {r['name']}: {r['status']}")

(ROOT / "parse_results.json").write_text(json.dumps(results, indent=2))
print(f"\nResults: {ROOT / 'parse_results.json'}")
print(f"Markdown output: {PARSED}")
