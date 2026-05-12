import type { StreamEvent } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";

export async function fetchStats() {
  const r = await fetch(`${API_BASE}/stats`);
  return r.json();
}

export async function fetchSources() {
  const r = await fetch(`${API_BASE}/sources`);
  return r.json();
}

export async function fetchSourceMarkdown(doc: string) {
  const r = await fetch(`${API_BASE}/source/${encodeURIComponent(doc)}/markdown`);
  if (!r.ok) throw new Error(`No markdown for ${doc}`);
  return r.json();
}

/**
 * SSE-over-POST stream consumer. Calls onEvent for every parsed event.
 * Returns a function that aborts the stream.
 */
export function streamAsk(
  question: string,
  onEvent: (e: StreamEvent) => void,
  onError?: (err: Error) => void,
): () => void {
  const ac = new AbortController();

  (async () => {
    try {
      const res = await fetch(`${API_BASE}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
        signal: ac.signal,
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE events are delimited by blank lines
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;
          const payload = line.slice(6).trim();
          if (!payload) continue;
          try {
            onEvent(JSON.parse(payload) as StreamEvent);
          } catch (e) {
            console.warn("Bad SSE payload", payload, e);
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError" && onError) onError(err as Error);
    }
  })();

  return () => ac.abort();
}
