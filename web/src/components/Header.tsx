"use client";

import { Mic } from "lucide-react";
import { motion } from "framer-motion";
import type { Stats } from "@/lib/types";

export function Header({ stats }: { stats: Stats | null }) {
  return (
    <header className="relative flex items-center justify-between px-8 h-16 border-b border-[#e7e5e4] bg-white/80 backdrop-blur-md z-10">
      <div className="flex items-center gap-3">
        <motion.div
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{
            background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
            boxShadow: "0 2px 8px -2px rgba(79, 70, 229, 0.35), 0 0 0 1px rgba(79, 70, 229, 0.12)",
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" className="text-white" strokeWidth={2.5} stroke="currentColor" width="18" height="18">
            <path d="M12 2v20M2 12h20" strokeLinecap="round" opacity="0.55" />
            <circle cx="12" cy="12" r="4" fill="currentColor" />
          </svg>
        </motion.div>
        <div className="flex flex-col leading-tight">
          <div className="text-[15px] font-semibold tracking-tight text-[#0a0a0a]">
            Clinical RAG
          </div>
          <div className="text-[11.5px] text-[#737373] font-medium">
            HIPAA-aware · Evidence-grounded answers
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {stats && (
          <>
            <Stat label="chunks" value={stats.chunks.toLocaleString()} />
            <Stat label="docs" value={String(stats.documents)} />
            <Stat label="pages" value={String(stats.pages)} />
            <div className="h-6 w-px bg-[#e7e5e4] mx-1.5" />
            <Pill name="Voyage" sub="voyage-3-large" />
            <Pill name="Cohere" sub="rerank-v3.5" />
            <Pill name="Claude" sub="Sonnet 4.6" highlight />
          </>
        )}
        <button
          aria-label="Voice mode"
          className="ml-2 flex items-center gap-1.5 px-3.5 h-9 rounded-lg border border-[#e7e5e4] bg-white text-[12.5px] font-medium text-[#0a0a0a] hover:bg-[#fafafa] hover:border-[#d6d3d1] transition lift"
        >
          <Mic className="w-3.5 h-3.5 text-[#4f46e5]" />
          Voice
          <span className="text-[10px] font-mono text-[#a3a3a3] ml-0.5">soon</span>
        </button>
      </div>
    </header>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1.5 px-3 h-9 rounded-lg border border-[#e7e5e4] bg-white">
      <span className="font-mono text-[13.5px] font-bold text-[#0a0a0a] tnum">{value}</span>
      <span className="text-[10.5px] uppercase tracking-[0.08em] text-[#737373] font-semibold">{label}</span>
    </div>
  );
}

function Pill({ name, sub, highlight = false }: { name: string; sub: string; highlight?: boolean }) {
  return (
    <div
      className={`flex flex-col leading-tight px-3 h-9 justify-center rounded-lg border ${
        highlight
          ? "border-[#c7d2fe] bg-[#eef2ff]"
          : "border-[#e7e5e4] bg-white"
      }`}
    >
      <span className={`text-[11.5px] font-semibold leading-none ${highlight ? "text-[#4338ca]" : "text-[#0a0a0a]"}`}>
        {name}
      </span>
      <span className={`font-mono text-[9.5px] leading-none mt-1 ${highlight ? "text-[#6366f1]" : "text-[#a3a3a3]"}`}>
        {sub}
      </span>
    </div>
  );
}
