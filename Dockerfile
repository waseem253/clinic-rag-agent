# FastAPI runtime image for Fly.io.
# Slim — we do NOT ship Docling / PyTorch (those are only used at ingest time).
# Runtime needs: psycopg, voyageai, cohere, anthropic, langgraph, fastapi.

FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements-runtime.txt ./
RUN pip install -r requirements-runtime.txt

COPY src/ ./src/
COPY api/ ./api/

EXPOSE 8080

CMD ["uvicorn", "api.server:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "1"]
