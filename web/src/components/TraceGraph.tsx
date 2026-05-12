"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2, ShieldCheck, Search, GraduationCap, RefreshCw, MessageSquareText } from "lucide-react";
import type { AgentState, NodeName, NodeState } from "@/lib/types";

const ORDER: { id: NodeName; label: string; Icon: any }[] = [
  { id: "triage",   label: "Triage",   Icon: ShieldCheck },
  { id: "retrieve", label: "Retrieve", Icon: Search },
  { id: "grade",    label: "Grade",    Icon: GraduationCap },
  { id: "refine",   label: "Refine",   Icon: RefreshCw },
  { id: "answer",   label: "Answer",   Icon: MessageSquareText },
];

export function TraceGraph({ agent, latency }: { agent: AgentState; latency: number | null }) {
  const anyActive = Object.values(agent).some((n) => n.status !== "idle");

  return (
    <div className="card px-5 py-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="text-[11px] uppercase tracking-[0.10em] text-[#737373] font-semibold">
            Agent Pipeline
          </div>
          {anyActive && (
            <motion.div
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#eef2ff] border border-[#c7d2fe] text-[10px] text-[#4338ca] font-mono font-semibold"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#4f46e5] pulse-indigo" />
              live
            </motion.div>
          )}
        </div>
        {latency !== null && (
          <div className="font-mono text-[11.5px] text-[#737373] tnum px-2 h-6 flex items-center rounded-md bg-[#fafafa] border border-[#e7e5e4]">
            {(latency / 1000).toFixed(2)}s
          </div>
        )}
      </div>

      <div className="relative flex items-center justify-between gap-1">
        {ORDER.map((n, i) => (
          <NodeAndEdge
            key={n.id}
            node={n}
            state={agent[n.id]}
            isLast={i === ORDER.length - 1}
            prev={i > 0 ? agent[ORDER[i - 1].id] : null}
          />
        ))}
      </div>

      <div className="mt-4 grid grid-cols-5 gap-2">
        {ORDER.map(({ id }) => (
          <Detail key={id} state={agent[id]} name={id} />
        ))}
      </div>
    </div>
  );
}

function NodeAndEdge({
  node,
  state,
  isLast,
  prev,
}: {
  node: { id: NodeName; label: string; Icon: any };
  state: NodeState;
  isLast: boolean;
  prev: NodeState | null;
}) {
  const { Icon, label } = node;

  const running = state.status === "running";
  const done = state.status === "done";
  const edgeActive = prev?.status === "done";

  return (
    <>
      <motion.div
        animate={{ scale: running ? 1.04 : 1 }}
        transition={{ duration: 0.25, ease: [0.34, 1.56, 0.64, 1] }}
        className="flex flex-col items-center gap-2 z-10"
      >
        <div
          className={`relative w-12 h-12 rounded-xl flex items-center justify-center border transition ${running ? "pulse-indigo" : ""}`}
          style={{
            background: running ? "#eef2ff" : done ? "#ffffff" : "#fafafa",
            borderColor: running ? "#a5b4fc" : done ? "#c7d2fe" : "#e7e5e4",
            color: running ? "#4f46e5" : done ? "#4338ca" : "#a3a3a3",
            boxShadow: running
              ? "0 4px 10px -2px rgba(79, 70, 229, 0.18)"
              : done
              ? "0 1px 2px 0 rgba(0,0,0,0.04)"
              : "none",
          }}
        >
          <AnimatePresence mode="wait">
            {running ? (
              <motion.div key="run" initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                <Loader2 className="w-5 h-5 animate-spin" strokeWidth={2.5} />
              </motion.div>
            ) : done ? (
              <motion.div key="done" initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                <Check className="w-5 h-5" strokeWidth={3} />
              </motion.div>
            ) : (
              <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Icon className="w-5 h-5" strokeWidth={2} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div
          className="text-[11px] font-semibold uppercase tracking-[0.06em]"
          style={{ color: running ? "#4f46e5" : done ? "#4338ca" : "#a3a3a3" }}
        >
          {label}
        </div>
      </motion.div>

      {!isLast && (
        <div className="flex-1 flex items-center justify-center px-1 min-w-[20px] relative h-12">
          <div className="w-full h-px bg-[#e7e5e4]" />
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: edgeActive ? 1 : 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            style={{ originX: 0 }}
            className="absolute left-1 right-1 h-px"
          >
            <div className="w-full h-px bg-gradient-to-r from-[#a5b4fc] via-[#4f46e5] to-[#a5b4fc]" />
          </motion.div>
        </div>
      )}
    </>
  );
}

function Detail({ state, name }: { state: NodeState; name: NodeName }) {
  return (
    <div className="rounded-lg px-2.5 py-1.5 bg-[#fafafa] border border-[#e7e5e4] min-h-[40px] flex flex-col">
      <AnimatePresence mode="wait">
        {state.status === "done" && state.value && (
          <motion.div
            key={state.value}
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -3 }}
            className="font-mono text-[10.5px] text-[#4338ca] truncate font-semibold"
            title={state.value}
          >
            {state.value}
          </motion.div>
        )}
        {state.status === "done" && state.n_hits !== undefined && (
          <motion.div
            key={`hits-${state.n_hits}`}
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-mono text-[10.5px] text-[#4338ca] font-semibold"
          >
            {state.n_hits} hits
          </motion.div>
        )}
        {state.status === "running" && (
          <div className="h-3 w-full shimmer rounded" />
        )}
      </AnimatePresence>
      <div className="font-mono text-[9px] uppercase tracking-[0.10em] text-[#a3a3a3] mt-auto font-semibold">
        {name}
      </div>
    </div>
  );
}
