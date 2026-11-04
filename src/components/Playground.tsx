"use client";

import { useEffect, useState } from "react";
import { Sliders, Sparkles, Move, MousePointerClick, Type, Ban, Grab, Palette } from "lucide-react";
import PromptModal from "./PromptModal";

const PRESET_COLORS = [
  { name: "Original", value: "" },
  { name: "Electric Blue", value: "#3b82f6" },
  { name: "Neon Cyan", value: "#00f2fe" },
  { name: "Purple Dream", value: "#a855f7" },
  { name: "Emerald", value: "#10b981" },
  { name: "Solar Orange", value: "#f97316" },
];

export default function Playground() {
  const [selectedCursor, setSelectedCursor] = useState("Handy");
  const [size, setSize] = useState(1.0);
  const [speed, setSpeed] = useState(1.0);
  const [color, setColor] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [clickCount, setClickCount] = useState(0);

  // Sync state changes with Curases engine
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (window.Curases) {
      window.Curases.load(selectedCursor);
      window.Curases.setSize(size);
      window.Curases.setSpeed(speed);
      window.Curases.setColor(color);
    }
  }, [selectedCursor, size, speed, color]);

  return (
    <section id="playground" className="w-full py-12">
      <div className="max-w-6xl mx-auto px-4">
        {/* Section Title */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-xs font-medium text-blue-400 mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              Interactive Physics Playground
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-zinc-100">
              Feel the Motion in Real Time
            </h2>
            <p className="text-sm text-zinc-400 mt-1">
              Adjust size, inertia, and color overrides. Hover over the targets to trigger dynamic states.
            </p>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="self-start md:self-auto inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition-all shadow-lg shadow-blue-600/25 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            Export Configuration & Agent Prompt
          </button>
        </div>

        {/* Studio Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Controls Panel */}
          <div className="lg:col-span-4 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-6 backdrop-blur-sm flex flex-col gap-6">
            <div className="flex items-center gap-2 pb-4 border-b border-zinc-800">
              <Sliders className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-semibold text-zinc-200">
                Engine Parameters
              </h3>
            </div>

            {/* Cursor Selector */}
            <div>
              <label className="text-xs font-medium text-zinc-400 block mb-2">
                Cursor Preset
              </label>
              <div className="grid grid-cols-2 gap-2">
                {["Handy"].map((id) => (
                  <button
                    key={id}
                    onClick={() => setSelectedCursor(id)}
                    className={`py-2 px-3 rounded-xl text-xs font-medium border transition-all text-center cursor-pointer ${
                      selectedCursor === id
                        ? "bg-blue-600 border-blue-500 text-white shadow-md shadow-blue-600/30"
                        : "bg-zinc-800/60 border-zinc-700/60 text-zinc-300 hover:bg-zinc-800"
                    }`}
                  >
                    {id} Cursor
                  </button>
                ))}
              </div>
            </div>

            {/* Size Slider */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-medium text-zinc-400">
                  Scale Multiplier
                </label>
                <span className="text-xs font-mono text-blue-400 font-semibold">
                  {size.toFixed(1)}x
                </span>
              </div>
              <input
                type="range"
                min="0.8"
                max="2.5"
                step="0.1"
                value={size}
                onChange={(e) => setSize(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <div className="flex justify-between text-[10px] text-zinc-500 mt-1 font-mono">
                <span>0.8x (Subtle)</span>
                <span>2.5x (Bold)</span>
              </div>
            </div>

            {/* Speed Slider */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-medium text-zinc-400">
                  Inertia / Smoothness
                </label>
                <span className="text-xs font-mono text-blue-400 font-semibold">
                  {speed === 1 ? "1.0 (Instant)" : speed.toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min="0.15"
                max="1.0"
                step="0.05"
                value={speed}
                onChange={(e) => setSpeed(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <div className="flex justify-between text-[10px] text-zinc-500 mt-1 font-mono">
                <span>0.15 (Fluid Trail)</span>
                <span>1.0 (Snappy)</span>
              </div>
            </div>

            {/* Color Override */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Palette className="w-3.5 h-3.5 text-zinc-400" />
                <label className="text-xs font-medium text-zinc-400">
                  Color Tint Override
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c.name}
                    onClick={() => setColor(c.value)}
                    title={c.name}
                    className={`w-7 h-7 rounded-full border-2 transition-transform cursor-pointer ${
                      color === c.value
                        ? "border-white scale-110 shadow-md"
                        : "border-transparent opacity-80 hover:opacity-100 hover:scale-105"
                    }`}
                    style={{
                      background: c.value || "linear-gradient(135deg, #666, #aaa)",
                    }}
                  />
                ))}
              </div>
              {color && (
                <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-400">
                  <span>Selected: <code className="text-blue-400 font-mono">{color}</code></span>
                  <button
                    onClick={() => setColor("")}
                    className="text-zinc-500 hover:text-zinc-300 underline cursor-pointer"
                  >
                    Reset
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Interactive Test Arena */}
          <div className="lg:col-span-8 bg-zinc-950 border border-zinc-800/80 rounded-2xl p-8 relative overflow-hidden flex flex-col justify-between min-h-[460px] shadow-2xl">
            {/* Subtle grid background */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f293710_1px,transparent_1px),linear-gradient(to_bottom,#1f293710_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

            {/* Arena Header */}
            <div className="relative z-10 flex items-center justify-between pb-6 border-b border-zinc-900">
              <div>
                <span className="text-xs font-mono uppercase tracking-wider text-zinc-500">
                  Interactive Canvas
                </span>
                <p className="text-xs text-zinc-400">
                  Hover and interact with targets below to test cursor reaction states
                </p>
              </div>
              <div className="px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-[11px] font-mono text-zinc-400">
                Active Style: <span className="text-blue-400 font-bold">{selectedCursor}</span>
              </div>
            </div>

            {/* Interactive Target Elements */}
            <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 my-8">
              {/* Target 1: Hover & Click button */}
              <button
                onClick={() => setClickCount((c) => c + 1)}
                className="group flex flex-col items-center justify-center p-5 rounded-xl bg-zinc-900/80 hover:bg-zinc-800/80 border border-zinc-800 hover:border-zinc-700 transition-all text-center interactive-target"
              >
                <MousePointerClick className="w-5 h-5 text-blue-400 mb-2 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-medium text-zinc-200">
                  Hover & Click Me
                </span>
                <span className="text-[10px] text-zinc-500 mt-1">
                  Clicked {clickCount} times
                </span>
              </button>

              {/* Target 2: Text input */}
              <div className="flex flex-col justify-center p-4 rounded-xl bg-zinc-900/80 border border-zinc-800">
                <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-400 mb-2">
                  <Type className="w-4 h-4 text-purple-400" />
                  <span>Text Field</span>
                </div>
                <input
                  type="text"
                  placeholder="Hover or type here..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Target 3: Draggable card */}
              <div
                draggable="true"
                className="group flex flex-col items-center justify-center p-5 rounded-xl bg-zinc-900/80 hover:bg-zinc-800/80 border border-dashed border-zinc-700 text-center interactive-target"
              >
                <Grab className="w-5 h-5 text-emerald-400 mb-2 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-medium text-zinc-200">
                  Draggable Target
                </span>
                <span className="text-[10px] text-zinc-500 mt-1">
                  Triggers &quot;drag&quot; state
                </span>
              </div>

              {/* Target 4: Disabled button */}
              <button
                disabled
                className="flex flex-col items-center justify-center p-5 rounded-xl bg-zinc-900/30 border border-zinc-900 text-center opacity-60 cursor-not-allowed"
              >
                <Ban className="w-5 h-5 text-rose-500 mb-2" />
                <span className="text-xs font-medium text-zinc-400">
                  Disabled Element
                </span>
                <span className="text-[10px] text-zinc-600 mt-1">
                  Triggers &quot;not-allowed&quot;
                </span>
              </button>

              {/* Target 5: Resizable box */}
              <div className="flex flex-col items-center justify-center p-5 rounded-xl bg-zinc-900/80 border border-zinc-800 text-center cursor-ew-resize">
                <Move className="w-5 h-5 text-amber-400 mb-2" />
                <span className="text-xs font-medium text-zinc-200">
                  Horizontal Resize
                </span>
                <span className="text-[10px] text-zinc-500 mt-1">
                  Triggers &quot;resize-h&quot;
                </span>
              </div>

              {/* Target 6: Link / Action */}
              <a
                href="#catalog"
                className="flex flex-col items-center justify-center p-5 rounded-xl bg-blue-950/20 hover:bg-blue-900/30 border border-blue-900/40 text-center interactive-target transition-all"
              >
                <Sparkles className="w-5 h-5 text-blue-400 mb-2" />
                <span className="text-xs font-medium text-blue-300">
                  Browse Cursor Catalog
                </span>
                <span className="text-[10px] text-blue-400/70 mt-1">
                  Standard Link Target
                </span>
              </a>
            </div>

            {/* Arena Footer live code preview */}
            <div className="relative z-10 pt-4 border-t border-zinc-900 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="font-mono text-zinc-500 text-[11px] truncate max-w-md">
                CDN: <span className="text-zinc-300">&lt;script src=&quot;https://curases.com/engine.js&quot; data-cursor=&quot;{selectedCursor}&quot; data-size=&quot;{size}&quot; data-speed=&quot;{speed}&quot; defer&gt;</span>
              </div>
              <button
                onClick={() => setIsModalOpen(true)}
                className="text-xs text-blue-400 hover:text-blue-300 font-medium underline shrink-0 cursor-pointer"
              >
                View Agent Prompt &amp; Full Code →
              </button>
            </div>
          </div>
        </div>
      </div>

      <PromptModal
        cursorId={selectedCursor}
        size={size}
        speed={speed}
        color={color}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </section>
  );
}
