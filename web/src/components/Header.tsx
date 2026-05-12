"use client";

import { Mic, PhoneOff, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useVapi } from "@/lib/useVapi";
import type { Stats } from "@/lib/types";

const VAPI_PUBLIC_KEY = "5856a2f3-5247-4b26-acb7-4b3f161afd7e";
const VAPI_ASSISTANT_ID = "bd02c0c9-e997-4fd0-b91b-d4a0298561f6";

export function Header({ stats }: { stats: Stats | null }) {
  const { state, isAgentSpeaking, isUserSpeaking, start, stop, error } = useVapi(
    VAPI_PUBLIC_KEY,
    VAPI_ASSISTANT_ID,
  );

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
        <VoiceButton
          state={state}
          isAgentSpeaking={isAgentSpeaking}
          isUserSpeaking={isUserSpeaking}
          error={error}
          onStart={start}
          onStop={stop}
        />
      </div>
    </header>
  );
}

function VoiceButton({
  state, isAgentSpeaking, isUserSpeaking, error, onStart, onStop,
}: {
  state: "idle" | "connecting" | "live" | "error";
  isAgentSpeaking: boolean;
  isUserSpeaking: boolean;
  error: string | null;
  onStart: () => void;
  onStop: () => void;
}) {
  if (state === "live") {
    return (
      <motion.button
        layout
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        onClick={onStop}
        className="ml-2 flex items-center gap-2 px-3.5 h-9 rounded-lg font-medium text-[12.5px] text-white transition lift relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)",
          boxShadow: "0 2px 8px -2px rgba(220, 38, 38, 0.40)",
        }}
        aria-label="End voice call"
      >
        <div className="flex items-center gap-0.5">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              animate={{
                height: isAgentSpeaking
                  ? [4, 14, 4]
                  : isUserSpeaking
                  ? [4, 10, 4]
                  : [4, 6, 4],
              }}
              transition={{
                duration: 0.6,
                repeat: Infinity,
                delay: i * 0.12,
                ease: "easeInOut",
              }}
              className="w-[3px] rounded-full bg-white/90"
            />
          ))}
        </div>
        <span>End</span>
        <PhoneOff className="w-3.5 h-3.5" />
      </motion.button>
    );
  }

  if (state === "connecting") {
    return (
      <button
        disabled
        className="ml-2 flex items-center gap-1.5 px-3.5 h-9 rounded-lg border border-[#c7d2fe] bg-[#eef2ff] text-[12.5px] font-medium text-[#4338ca]"
      >
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Connecting…
      </button>
    );
  }

  if (state === "error") {
    return (
      <button
        disabled
        title={error ?? "Voice error"}
        className="ml-2 flex items-center gap-1.5 px-3.5 h-9 rounded-lg border border-[#fecaca] bg-[#fef2f2] text-[12.5px] font-medium text-[#b91c1c]"
      >
        <Mic className="w-3.5 h-3.5" />
        Mic error
      </button>
    );
  }

  // idle
  return (
    <motion.button
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.97 }}
      onClick={onStart}
      aria-label="Start voice call with Cora"
      className="ml-2 flex items-center gap-1.5 px-3.5 h-9 rounded-lg border border-[#c7d2fe] bg-[#eef2ff] text-[12.5px] font-medium text-[#4338ca] hover:bg-[#e0e7ff] hover:border-[#a5b4fc] transition lift"
    >
      <Mic className="w-3.5 h-3.5" />
      <span>Call Cora</span>
      <span className="text-[10px] font-mono text-[#6366f1] ml-0.5">voice</span>
    </motion.button>
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
