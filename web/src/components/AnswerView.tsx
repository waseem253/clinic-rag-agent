"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ShieldCheck, Layers, Zap } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Hit } from "@/lib/types";

type Props = {
  answer: string;
  citations: Hit[];
  hits: Hit[];
  streaming: boolean;
  onSelectCitation: (idx: number) => void;
  selectedIdx: number | null;
};

export function AnswerView({ answer, citations, streaming, onSelectCitation, selectedIdx }: Props) {
  return (
    <div className="card flex-1 flex flex-col overflow-hidden">
      <div className="px-6 py-3.5 border-b border-[#e7e5e4] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="text-[11px] uppercase tracking-[0.10em] text-[#737373] font-semibold">
            Evidence-grounded answer
          </div>
        </div>
        {streaming && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#eef2ff] border border-[#c7d2fe] text-[10px] text-[#4338ca] font-mono font-semibold"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#4f46e5] pulse-indigo" />
            streaming
          </motion.div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {!answer && !streaming && <HeroEmptyState />}
        {(answer || streaming) && (
          <div className="px-8 py-7 md-answer max-w-3xl">
            <RenderedMarkdownWithCitations
              text={answer}
              onSelectCitation={onSelectCitation}
              selectedIdx={selectedIdx}
            />
            {streaming && <BlinkCursor />}
          </div>
        )}
      </div>

      <AnimatePresence>
        {citations.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="border-t border-[#e7e5e4] bg-[#fafafa] px-6 py-3.5"
          >
            <div className="flex items-center gap-2 mb-2">
              <Layers className="w-3 h-3 text-[#4f46e5]" />
              <div className="text-[10.5px] uppercase tracking-[0.10em] text-[#737373] font-semibold">
                Sources used · click to inspect
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {citations.map((c, i) => (
                <motion.button
                  key={c.chunk_id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => onSelectCitation(i)}
                  className={`lift flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11.5px] font-mono transition border ${
                    selectedIdx === i
                      ? "bg-[#eef2ff] border-[#a5b4fc] text-[#4338ca]"
                      : "bg-white border-[#e7e5e4] text-[#404040] hover:border-[#d6d3d1]"
                  }`}
                >
                  <span className="font-bold">[{i + 1}]</span>
                  <span className="truncate max-w-[280px]">
                    {c.source.replace(".pdf", "")}
                    {c.page_start ? ` · p.${c.page_start}` : ""}
                    {c.heading_path ? ` · ${c.heading_path.split(" > ").pop()}` : ""}
                  </span>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function HeroEmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="h-full flex flex-col items-center justify-center text-center px-10 py-12"
    >
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
        className="mb-7"
      >
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{
            background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 60%, #4338ca 100%)",
            boxShadow: "0 8px 20px -4px rgba(79, 70, 229, 0.35), 0 0 0 1px rgba(79, 70, 229, 0.10)",
          }}
        >
          <Sparkles className="w-6 h-6 text-white" strokeWidth={2.4} />
        </div>
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12, duration: 0.4 }}
        className="text-[44px] font-bold tracking-[-0.04em] text-[#0a0a0a] leading-[1.04] max-w-2xl"
      >
        Ask anything from <span className="gradient-text">clinical guidelines</span>.
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.22, duration: 0.4 }}
        className="mt-4 text-[15px] text-[#525252] max-w-xl leading-relaxed"
      >
        A multi-step agent that triages the question, retrieves with hybrid search,
        grades the evidence, and answers with inline citations to specific pages of
        CDC, USPSTF and NHLBI documents.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.4 }}
        className="mt-8 flex flex-wrap items-center justify-center gap-2"
      >
        {[
          { Icon: ShieldCheck, label: "HIPAA-aware" },
          { Icon: Zap, label: "Streaming · ~3s answer" },
          { Icon: Layers, label: "Per-page citations" },
        ].map(({ Icon, label }, i) => (
          <div
            key={label}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-[#e7e5e4] text-[11.5px] font-medium text-[#404040] float-${i + 1}`}
            style={{ boxShadow: "0 1px 2px 0 rgba(0,0,0,0.03)" }}
          >
            <Icon className="w-3 h-3 text-[#4f46e5]" />
            {label}
          </div>
        ))}
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-7 text-[10.5px] uppercase tracking-[0.10em] text-[#a3a3a3] font-mono font-semibold"
      >
        Pick a sample on the left or type your own ↙
      </motion.div>
    </motion.div>
  );
}

function RenderedMarkdownWithCitations({
  text,
  onSelectCitation,
  selectedIdx,
}: {
  text: string;
  onSelectCitation: (idx: number) => void;
  selectedIdx: number | null;
}) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p>{transformChildren(children, onSelectCitation, selectedIdx)}</p>,
        li: ({ children }) => <li>{transformChildren(children, onSelectCitation, selectedIdx)}</li>,
        td: ({ children }) => <td>{transformChildren(children, onSelectCitation, selectedIdx)}</td>,
        strong: ({ children }) => <strong>{transformChildren(children, onSelectCitation, selectedIdx)}</strong>,
        a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer" className="text-[#4f46e5] underline underline-offset-2 hover:text-[#4338ca]">{children}</a>,
      }}
    >
      {text}
    </ReactMarkdown>
  );
}

function transformChildren(
  children: React.ReactNode,
  onSelectCitation: (idx: number) => void,
  selectedIdx: number | null,
): React.ReactNode {
  const wrap = (n: React.ReactNode): React.ReactNode => {
    if (typeof n !== "string") return n;
    const out: React.ReactNode[] = [];
    let lastIdx = 0;
    const re = /\[(\d+)\]/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(n)) !== null) {
      if (m.index > lastIdx) out.push(n.slice(lastIdx, m.index));
      const idx = parseInt(m[1], 10) - 1;
      out.push(<CitePill key={`${m.index}-${m[1]}`} n={parseInt(m[1], 10)} active={selectedIdx === idx} onClick={() => onSelectCitation(idx)} />);
      lastIdx = m.index + m[0].length;
    }
    if (lastIdx < n.length) out.push(n.slice(lastIdx));
    return out;
  };
  if (Array.isArray(children)) return children.map((c, i) => <span key={i}>{wrap(c)}</span>);
  return wrap(children);
}

function CitePill({ n, active, onClick }: { n: number; active: boolean; onClick: () => void }) {
  return (
    <motion.button
      whileHover={{ scale: 1.08, y: -1 }}
      whileTap={{ scale: 0.92 }}
      onClick={onClick}
      className={`inline-flex items-center font-mono text-[10.5px] font-bold px-1.5 py-0 mx-0.5 rounded-md align-baseline transition border ${
        active
          ? "bg-[#4f46e5] text-white border-[#4f46e5]"
          : "bg-[#eef2ff] text-[#4338ca] border-[#c7d2fe] hover:bg-[#4f46e5] hover:text-white hover:border-[#4f46e5]"
      }`}
      style={{ lineHeight: "1.55" }}
    >
      {n}
    </motion.button>
  );
}

function BlinkCursor() {
  return (
    <motion.span
      animate={{ opacity: [1, 0.2, 1] }}
      transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
      className="inline-block w-[3px] h-4 ml-1 align-middle bg-[#4f46e5] rounded-sm"
    />
  );
}
