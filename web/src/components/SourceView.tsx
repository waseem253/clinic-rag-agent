"use client";

import { motion, AnimatePresence } from "framer-motion";
import { FileText, Layers, ChevronRight } from "lucide-react";
import type { Hit, Source } from "@/lib/types";

type Props = {
  sources: Source[];
  hits: Hit[];
  selectedCitation: Hit | null;
};

export function SourceView({ sources, hits, selectedCitation }: Props) {
  return (
    <div className="card flex flex-col h-full overflow-hidden">
      <div className="px-4 py-3.5 border-b border-[#e7e5e4] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-3.5 h-3.5 text-[#4f46e5]" />
          <div className="text-[11px] uppercase tracking-[0.10em] text-[#737373] font-semibold">
            Source preview
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {selectedCitation ? (
            <ChunkDetail key={selectedCitation.chunk_id} hit={selectedCitation} />
          ) : hits.length > 0 ? (
            <RetrievedList key="retrieved" hits={hits} />
          ) : (
            <CorpusList key="corpus" sources={sources} />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function CorpusList({ sources }: { sources: Source[] }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-3">
      <div className="text-[10px] uppercase tracking-[0.10em] text-[#a3a3a3] font-semibold px-1 mb-2">
        Indexed corpus · 8 guidelines
      </div>
      <div className="space-y-1.5">
        {sources.map((s, i) => (
          <motion.div
            key={s.source}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.04 * i }}
            whileHover={{ y: -1 }}
            className="lift px-3 py-2.5 rounded-lg border border-[#e7e5e4] bg-white hover:border-[#d6d3d1] cursor-default"
          >
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <FileText className="w-3 h-3 text-[#4f46e5] shrink-0" />
                <span className="text-[11.5px] font-mono font-semibold text-[#0a0a0a] truncate" title={s.source}>
                  {s.source.replace(".pdf", "")}
                </span>
              </div>
              <span className="text-[9px] uppercase tracking-[0.08em] text-[#4338ca] shrink-0 font-bold font-mono px-1.5 py-0.5 rounded bg-[#eef2ff] border border-[#e0e7ff]">
                {s.publisher}
              </span>
            </div>
            <div className="flex gap-2.5 text-[10.5px] font-mono text-[#737373] tnum">
              <span>{s.pages} pages</span>
              <span className="text-[#d4d4d4]">·</span>
              <span>{s.chunks} chunks</span>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

function RetrievedList({ hits }: { hits: Hit[] }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-3">
      <div className="text-[10px] uppercase tracking-[0.10em] text-[#a3a3a3] font-semibold px-1 mb-2">
        Retrieved chunks · ranked
      </div>
      <div className="space-y-1.5">
        {hits.map((h, i) => (
          <motion.div
            key={h.chunk_id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            whileHover={{ y: -1 }}
            className="lift px-3 py-2.5 rounded-lg border border-[#e7e5e4] bg-white hover:border-[#d6d3d1] cursor-pointer"
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] font-bold text-white bg-[#4f46e5] px-1.5 py-0.5 rounded">
                  #{i + 1}
                </span>
                <span className="font-mono text-[10.5px] text-[#4338ca] tnum font-semibold">
                  {h.score.toFixed(3)}
                </span>
              </div>
              {h.page_start && (
                <span className="font-mono text-[10.5px] text-[#737373] tnum">
                  p.{h.page_start}
                  {h.page_end && h.page_end !== h.page_start && `-${h.page_end}`}
                </span>
              )}
            </div>
            <div className="text-[11.5px] font-mono font-semibold text-[#0a0a0a] truncate" title={h.source}>
              {h.source.replace(".pdf", "")}
            </div>
            {h.heading_path && (
              <div className="text-[10.5px] text-[#737373] flex items-center gap-1 mt-0.5">
                <ChevronRight className="w-2.5 h-2.5 shrink-0" />
                <span className="truncate">{h.heading_path}</span>
              </div>
            )}
            <div className="text-[11.5px] text-[#525252] mt-1.5 line-clamp-2 leading-snug">
              {h.text.slice(0, 180)}…
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

function ChunkDetail({ hit }: { hit: Hit }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 6 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -6 }}
      className="p-4"
    >
      <div className="rounded-lg border border-[#c7d2fe] bg-[#eef2ff] p-3 mb-3">
        <div className="text-[9.5px] uppercase tracking-[0.10em] text-[#4338ca] font-bold mb-1.5">
          Selected citation
        </div>
        <div className="font-mono text-[11.5px] font-bold text-[#0a0a0a] mb-0.5 break-all">
          {hit.source.replace(".pdf", "")}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[10.5px] text-[#525252] tnum">
          {hit.page_start && (
            <span>
              page {hit.page_start}
              {hit.page_end && hit.page_end !== hit.page_start && `–${hit.page_end}`}
            </span>
          )}
          <span>relevance {hit.score.toFixed(3)}</span>
        </div>
        {hit.heading_path && (
          <div className="text-[11px] text-[#4338ca] mt-1.5 flex items-start gap-1">
            <ChevronRight className="w-3 h-3 shrink-0 mt-0.5" />
            <span>{hit.heading_path}</span>
          </div>
        )}
      </div>

      <div className="rounded-lg bg-[#fafafa] border border-[#e7e5e4] p-4">
        <div className="text-[12px] leading-relaxed text-[#404040] whitespace-pre-wrap font-mono">
          {hit.text}
        </div>
      </div>
    </motion.div>
  );
}
