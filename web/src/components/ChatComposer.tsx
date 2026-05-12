"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Send, Stethoscope, Pill, Syringe, Activity, Brain, Sparkles } from "lucide-react";

type Sample = { icon: any; label: string; query: string };

const SAMPLES: Sample[] = [
  { icon: Syringe,     label: "Shingles vaccine age",       query: "At what age should adults get the shingles vaccine?" },
  { icon: Pill,        label: "Gonorrhea first-line Rx",    query: "What is the first-line treatment for uncomplicated gonorrhea in adults?" },
  { icon: Stethoscope, label: "Colorectal screening",       query: "At what age should average-risk adults start colorectal cancer screening, and what tests are recommended?" },
  { icon: Activity,    label: "Opioid initial Rx",          query: "What does CDC recommend about initial opioid prescribing duration for acute pain?" },
  { icon: Brain,       label: "Syphilis + penicillin allergy", query: "How should syphilis be treated in a penicillin-allergic patient?" },
  { icon: Sparkles,    label: "TB regimen",                 query: "What is the standard regimen for drug-susceptible pulmonary tuberculosis?" },
];

export function ChatComposer({
  onAsk,
  busy,
  question,
}: {
  onAsk: (q: string) => void;
  busy: boolean;
  question: string | null;
}) {
  const [text, setText] = useState("");

  const submit = (q: string) => {
    const final = q.trim();
    if (!final || busy) return;
    onAsk(final);
    setText("");
  };

  return (
    <div className="card flex flex-col h-full overflow-hidden">
      <div className="px-5 pt-5 pb-2">
        <div className="text-[11px] uppercase tracking-[0.10em] text-[#737373] font-semibold mb-3">
          Quick start
        </div>
        <div className="grid grid-cols-1 gap-1.5">
          {SAMPLES.map(({ icon: Icon, label, query }, i) => (
            <motion.button
              key={label}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.05 + i * 0.04, duration: 0.35 }}
              whileHover={{ x: 2 }}
              whileTap={{ scale: 0.98 }}
              disabled={busy}
              onClick={() => submit(query)}
              className="lift group flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-[#e7e5e4] bg-white hover:bg-[#fafafa] hover:border-[#d6d3d1] transition text-left disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-[#eef2ff] border border-[#e0e7ff] shrink-0">
                <Icon className="w-3.5 h-3.5 text-[#4f46e5]" strokeWidth={2.2} />
              </div>
              <span className="text-[13px] text-[#0a0a0a] font-medium truncate">
                {label}
              </span>
            </motion.button>
          ))}
        </div>
      </div>

      {question && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="px-4 py-3 mx-5 mt-3 rounded-lg bg-[#eef2ff] border border-[#c7d2fe]"
        >
          <div className="text-[10px] uppercase tracking-[0.10em] text-[#4338ca] font-semibold mb-1">
            Your question
          </div>
          <div className="text-[13px] text-[#0a0a0a] leading-snug">{question}</div>
        </motion.div>
      )}

      <div className="mt-auto p-5 border-t border-[#e7e5e4] bg-[#fafafa]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(text);
          }}
          className="relative"
        >
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit(text);
              }
            }}
            placeholder="Ask about a CDC, USPSTF, or NHLBI recommendation…"
            disabled={busy}
            rows={3}
            className="focus-ring w-full resize-none rounded-lg bg-white border border-[#e7e5e4] p-3 pr-12 text-[13.5px] text-[#0a0a0a] placeholder:text-[#a3a3a3] transition disabled:opacity-50"
          />
          <motion.button
            type="submit"
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.95 }}
            disabled={busy || !text.trim()}
            className="absolute right-2 bottom-2 w-9 h-9 rounded-lg flex items-center justify-center transition disabled:opacity-30 disabled:cursor-not-allowed"
            style={{
              background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
              boxShadow: "0 2px 6px -1px rgba(79, 70, 229, 0.4)",
            }}
            aria-label="Send"
          >
            <Send className="w-4 h-4 text-white" strokeWidth={2.5} />
          </motion.button>
        </form>
        <div className="text-[10.5px] text-[#a3a3a3] mt-2 font-mono">
          ⏎ to send · ⇧⏎ for newline
        </div>
      </div>
    </div>
  );
}
