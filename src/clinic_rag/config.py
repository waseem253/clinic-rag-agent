import os
from pathlib import Path
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / ".env")

CORPUS_DIR = ROOT / "corpus"
PARSED_DIR = ROOT / "parsed"
CHUNKS_DIR = ROOT / "chunks"

DATABASE_URL = os.environ["DATABASE_URL"]
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY")
VOYAGE_API_KEY = os.environ.get("VOYAGE_API_KEY")
COHERE_API_KEY = os.environ.get("COHERE_API_KEY")
EMBED_MODEL = os.environ.get("EMBED_MODEL", "voyage-3-large")
EMBED_DIMS = int(os.environ.get("EMBED_DIMS", "1024"))
CLAUDE_MODEL = os.environ.get("CLAUDE_MODEL", "claude-sonnet-4-6")
