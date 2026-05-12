export type NodeName = "triage" | "retrieve" | "grade" | "refine" | "answer";

export type TraceEvent = {
  type: "trace";
  node: NodeName;
  status: "running" | "done";
  value?: string;
  query?: string;
  n_hits?: number;
  retries?: number;
};

export type Hit = {
  idx: number;
  chunk_id: number;
  source: string;
  heading_path: string | null;
  page_start: number | null;
  page_end: number | null;
  text: string;
  score: number;
};

export type HitsEvent = { type: "hits"; hits: Hit[] };
export type TokenEvent = { type: "token"; text: string };
export type DoneEvent = { type: "done"; citations: Hit[] };

export type StreamEvent = TraceEvent | HitsEvent | TokenEvent | DoneEvent;

export type Stats = {
  chunks: number;
  documents: number;
  pages: number;
  embedder: string;
  reranker: string;
  llm: string;
};

export type Source = {
  source: string;
  title: string;
  publisher: string;
  pages: number;
  chunks: number;
};

export type NodeState = {
  status: "idle" | "running" | "done";
  value?: string;
  n_hits?: number;
  retries?: number;
};

export type AgentState = {
  triage: NodeState;
  retrieve: NodeState;
  grade: NodeState;
  refine: NodeState;
  answer: NodeState;
};

export const INITIAL_AGENT_STATE: AgentState = {
  triage: { status: "idle" },
  retrieve: { status: "idle" },
  grade: { status: "idle" },
  refine: { status: "idle" },
  answer: { status: "idle" },
};
