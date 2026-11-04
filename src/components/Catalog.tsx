"use client";

import { useState } from "react";
import { Sparkles, Terminal, Code2, ArrowUpRight } from "lucide-react";
import PromptModal from "./PromptModal";

interface CursorItem {
  id: string;
  name: string;
  tagline: string;
  description: string;
  badge?: string;
  features: string[];
}

const CURSORS: CursorItem[] = [
  {
    id: "Handy",
    name: "Handy",
    tagline: "Expressive hand-drawn multi-state cursor with precision responsive transformations.",
    description: "Designed for expressive, modern, and human UI experiences. Dynamically transforms into custom pointing, clicking, dragging, typing, resizing, and not-allowed states.",
    badge: "Default",
    features: ["Subtle SVG drop-shadow", "Dynamic hotspot alignment", "Multi-state vector transforms"],
  },
];

export default function Catalog() {
  const [activeModalCursor, setActiveModalCursor] = useState<string | null>(null);

  return (
    <section id="catalog" className="w-full py-16 border-t border-zinc-900">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-xs font-medium text-blue-400 mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            Designed Cursor Registry
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-100">
            Handcrafted Cursors Ready to Deploy
          </h2>
          <p className="text-sm text-zinc-400 mt-2">
            Every cursor includes full state vectors, hotspot calculations, and physics integration. Pull any style with a single prompt.
          </p>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {CURSORS.map((c) => (
            <div
              key={c.id}
              className="bg-zinc-900/40 border border-zinc-800/80 hover:border-zinc-700/80 rounded-2xl p-6 transition-all flex flex-col justify-between hover:shadow-xl hover:shadow-blue-950/10"
            >
              <div>
                {/* Top Badge & ID */}
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-mono uppercase tracking-wider text-blue-400">
                    Preset ID: <strong>{c.id}</strong>
                  </span>
                  {c.badge && (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      {c.badge}
                    </span>
                  )}
                </div>

                {/* Title & Tagline */}
                <h3 className="text-xl font-bold text-zinc-100">{c.name}</h3>
                <p className="text-xs text-zinc-300 font-medium mt-1">
                  {c.tagline}
                </p>
                <p className="text-xs text-zinc-400 mt-3 leading-relaxed">
                  {c.description}
                </p>

                {/* Features list */}
                <div className="mt-4 pt-4 border-t border-zinc-800/60 flex flex-wrap gap-2">
                  {c.features.map((f, i) => (
                    <span
                      key={i}
                      className="px-2 py-1 rounded-md bg-zinc-800/50 text-[10px] text-zinc-300 font-mono"
                    >
                      • {f}
                    </span>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-6 pt-4 border-t border-zinc-800 flex gap-2">
                <button
                  onClick={() => setActiveModalCursor(c.id)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition-colors shadow-sm cursor-pointer"
                >
                  <Terminal className="w-3.5 h-3.5" />
                  Get Agent Prompt
                </button>
                <a
                  href="#playground"
                  onClick={() => {
                    if (window.Curases) {
                      window.Curases.load(c.id);
                    }
                  }}
                  className="flex items-center justify-center gap-1 py-2.5 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium text-xs transition-colors cursor-pointer"
                >
                  <span>Test Live</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>

      {activeModalCursor && (
        <PromptModal
          cursorId={activeModalCursor}
          size={1.0}
          speed={1.0}
          color=""
          isOpen={!!activeModalCursor}
          onClose={() => setActiveModalCursor(null)}
        />
      )}
    </section>
  );
}
