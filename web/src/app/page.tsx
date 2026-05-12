"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Header } from "@/components/Header";
import { TraceGraph } from "@/components/TraceGraph";
import { ChatComposer } from "@/components/ChatComposer";
import { AnswerView } from "@/components/AnswerView";
import { SourceView } from "@/components/SourceView";
import { fetchStats, fetchSources, streamAsk } from "@/lib/api";
import {
  INITIAL_AGENT_STATE,
  type AgentState,
  type Hit,
  type Source,
  type Stats,
  type StreamEvent,
} from "@/lib/types";

export default function Home() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [agent, setAgent] = useState<AgentState>(INITIAL_AGENT_STATE);
  const [answer, setAnswer] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [citations, setCitations] = useState<Hit[]>([]);
  const [selectedCitation, setSelectedCitation] = useState<number | null>(null);
  const [question, setQuestion] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [latency, setLatency] = useState<number | null>(null);

  const abortRef = useRef<(() => void) | null>(null);
  const startedAt = useRef<number | null>(null);

  useEffect(() => {
    fetchStats().then(setStats).catch(() => {});
    fetchSources().then(setSources).catch(() => {});
  }, []);

  const handleAsk = useCallback((q: string) => {
    if (abortRef.current) abortRef.current();

    setQuestion(q);
    setAgent(INITIAL_AGENT_STATE);
    setAnswer("");
    setHits([]);
    setCitations([]);
    setSelectedCitation(null);
    setStreaming(true);
    setLatency(null);
    startedAt.current = performance.now();

    const interval = setInterval(() => {
      if (startedAt.current !== null) {
        setLatency(performance.now() - startedAt.current);
      }
    }, 80);

    abortRef.current = streamAsk(
      q,
      (e: StreamEvent) => {
        switch (e.type) {
          case "trace":
            setAgent((prev) => ({
              ...prev,
              [e.node]: {
                ...prev[e.node],
                status: e.status,
                value: e.value ?? prev[e.node].value,
                n_hits: e.n_hits ?? prev[e.node].n_hits,
                retries: e.retries ?? prev[e.node].retries,
              },
            }));
            break;
          case "hits":
            setHits(e.hits);
            break;
          case "token":
            setAnswer((a) => a + e.text);
            break;
          case "done":
            setCitations(e.citations);
            setStreaming(false);
            clearInterval(interval);
            break;
        }
      },
      (err) => {
        console.error(err);
        setStreaming(false);
        clearInterval(interval);
      },
    );
  }, []);

  const selectedHit = selectedCitation !== null ? citations[selectedCitation] ?? null : null;

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Header stats={stats} />

      <div className="flex-1 grid grid-cols-[300px_1fr_360px] gap-3 p-3 overflow-hidden">
        <ChatComposer onAsk={handleAsk} busy={streaming} question={question} />

        <div className="flex flex-col gap-3 overflow-hidden">
          <TraceGraph agent={agent} latency={latency} />
          <AnswerView
            answer={answer}
            citations={citations}
            hits={hits}
            streaming={streaming}
            onSelectCitation={(i) => setSelectedCitation(i)}
            selectedIdx={selectedCitation}
          />
        </div>

        <SourceView sources={sources} hits={hits} selectedCitation={selectedHit} />
      </div>

      <footer className="px-8 py-3 border-t border-[#e7e5e4] bg-white flex items-center justify-between text-[11px] text-[#737373] font-mono">
        <div>
          Voyage AI · pgvector HNSW · Cohere rerank · Claude Sonnet 4.6 · LangGraph orchestration
        </div>
        <div>built by Waseem Iftikhar · AI Voice Engineer</div>
      </footer>
    </div>
  );
}
