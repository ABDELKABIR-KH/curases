"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Sparkles, Terminal, Sliders, Grab, MousePointerClick, Ban } from "lucide-react";

export default function HeroDemoBrowser() {
  const [selectedCursor, setSelectedCursor] = useState("Handy");
  const [size, setSize] = useState(1);
  const [speed, setSpeed] = useState(1.0);
  const [roughness, setRoughness] = useState(0.0);
  const [boil, setBoil] = useState(0.3);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [clickCount, setClickCount] = useState(0);

  // Sync with Curases engine
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.Curases) {
      window.Curases.load(selectedCursor);
      window.Curases.setSize(size);
      window.Curases.setSpeed(speed);
      if (typeof window.Curases.setRoughness === "function") {
        window.Curases.setRoughness(roughness);
      }
      if (typeof window.Curases.setBoil === "function") {
        window.Curases.setBoil(boil);
      }
    }
  }, [selectedCursor, size, speed, roughness, boil]);

  const roughnessParam = roughness > 0 ? `, roughness ${roughness}` : "";
  const boilParam = boil > 0 ? `, boil ${boil}` : "";
  const roughnessAttr = roughness > 0 ? ` data-roughness="${roughness}"` : "";
  const boilAttr = boil > 0 ? ` data-boil="${boil}"` : "";

  const agentPrompt = `Install Curases custom cursor engine with '${selectedCursor}' style, size ${size}, speed ${speed}${roughnessParam}${boilParam}. Docs: https://curases.com/llms.txt`;

  const scriptTag = `<script src="https://curases.com/engine.js" data-cursor="${selectedCursor}" data-size="${size}" data-speed="${speed}"${roughnessAttr}${boilAttr} defer></script>`;

  const copyPrompt = () => {
    navigator.clipboard.writeText(agentPrompt);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  const copyScript = () => {
    navigator.clipboard.writeText(scriptTag);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  return (
    <div className="w-full my-6">
      {/* Mock Browser Window */}
      <div className="hero-demo-browser bg-[#F6F5F4] border border-black/10 rounded-xl overflow-hidden shadow-sm">
        {/* Top Browser Bar */}
        <div className="hero-demo-browser-bar flex items-center justify-between px-3 py-2.5 bg-white border-b border-black/5">
          <div className="flex items-center gap-1.5">
            <span className="hero-demo-dot red" />
            <span className="hero-demo-dot yellow" />
            <span className="hero-demo-dot green" />
            <span className="hero-demo-url-bar font-mono text-[11px] text-zinc-500 bg-zinc-100 px-3 py-0.5 rounded ml-2">
              curases.com/sandbox
            </span>
          </div>

          {/* Quick presets switch inside browser header */}
          <div className="flex items-center gap-1">
            {["Handy"].map((id) => (
              <button
                key={id}
                onClick={() => setSelectedCursor(id)}
                className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors ${
                  selectedCursor === id
                    ? "bg-zinc-900 text-white"
                    : "text-zinc-600 hover:bg-zinc-100"
                }`}
              >
                {id}
              </button>
            ))}
          </div>
        </div>

        {/* Browser Content / Live Sandbox */}
        <div className="p-6 md:p-8">
          {/* Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-6 mb-6 border-b border-black/5 text-xs text-zinc-600">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-zinc-500">Size:</span>
                <input
                  type="range"
                  min="0.8"
                  max="2.2"
                  step="0.1"
                  value={size}
                  onChange={(e) => setSize(parseFloat(e.target.value))}
                  className="w-20 h-1 bg-zinc-300 rounded appearance-none cursor-pointer accent-zinc-900"
                />
                <span className="font-mono text-zinc-900 font-semibold">{size}x</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-zinc-500">Speed:</span>
                <input
                  type="range"
                  min="0.2"
                  max="1.0"
                  step="0.1"
                  value={speed}
                  onChange={(e) => setSpeed(parseFloat(e.target.value))}
                  className="w-20 h-1 bg-zinc-300 rounded appearance-none cursor-pointer accent-zinc-900"
                />
                <span className="font-mono text-zinc-900 font-semibold">{speed}</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-zinc-500">Roughness:</span>
                <input
                  type="range"
                  min="0"
                  max="2.0"
                  step="0.1"
                  value={roughness}
                  onChange={(e) => setRoughness(parseFloat(e.target.value))}
                  className="w-20 h-1 bg-zinc-300 rounded appearance-none cursor-pointer accent-zinc-900"
                />
                <span className="font-mono text-zinc-900 font-semibold">
                  {roughness === 0 ? "Solid" : `${roughness.toFixed(1)}x`}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-zinc-500">Boil:</span>
                <input
                  type="range"
                  min="0"
                  max="1.0"
                  step="0.1"
                  value={boil}
                  onChange={(e) => setBoil(parseFloat(e.target.value))}
                  className="w-20 h-1 bg-zinc-300 rounded appearance-none cursor-pointer accent-zinc-900"
                />
                <span className="font-mono text-zinc-900 font-semibold">
                  {boil === 0 ? "Static" : `${boil.toFixed(1)}x`}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={copyPrompt}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-white border border-black/10 hover:border-black/20 text-zinc-800 transition-colors shadow-2xs"
              >
                {copiedPrompt ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Terminal className="w-3.5 h-3.5 text-zinc-500" />}
                <span>{copiedPrompt ? "Copied Prompt" : "Copy for Agent"}</span>
              </button>

              <button
                onClick={copyScript}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-zinc-900 hover:bg-zinc-800 text-white transition-colors"
              >
                {copiedScript ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedScript ? "Copied Script" : "Copy <script>"}</span>
              </button>
            </div>
          </div>

          {/* Interactive Test Elements */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {/* Element 1: Button */}
            <button
              onClick={() => setClickCount((c) => c + 1)}
              className="flex flex-col items-center justify-center p-5 bg-white border border-black/8 rounded-lg hover:border-black/20 transition-all text-center group cursor-pointer shadow-2xs"
            >
              <MousePointerClick className="w-4 h-4 text-zinc-400 group-hover:text-zinc-900 mb-1.5 transition-colors" />
              <span className="text-xs font-medium text-zinc-800">
                Click Target
              </span>
              <span className="text-[10px] text-zinc-400 mt-0.5">
                Clicked {clickCount} times
              </span>
            </button>

            {/* Element 2: Input */}
            <div className="flex flex-col justify-center p-3.5 bg-white border border-black/8 rounded-lg shadow-2xs">
              <span className="text-[10px] text-zinc-400 font-medium mb-1.5">
                Typing Target
              </span>
              <input
                type="text"
                placeholder="Type here..."
                className="w-full text-xs text-zinc-800 bg-zinc-50 border border-black/10 rounded px-2.5 py-1.5 outline-none focus:border-zinc-500 focus:bg-white"
              />
            </div>

            {/* Element 3: Draggable */}
            <div
              draggable="true"
              className="flex flex-col items-center justify-center p-5 bg-white border border-dashed border-black/20 rounded-lg text-center hover:bg-zinc-50/50 transition-colors shadow-2xs"
            >
              <Grab className="w-4 h-4 text-zinc-400 mb-1.5" />
              <span className="text-xs font-medium text-zinc-800">
                Draggable Area
              </span>
              <span className="text-[10px] text-zinc-400 mt-0.5">
                Triggers drag state
              </span>
            </div>

            {/* Element 4: Disabled */}
            <button
              disabled
              className="flex flex-col items-center justify-center p-5 bg-zinc-100/60 border border-black/5 rounded-lg text-center opacity-60 cursor-not-allowed"
            >
              <Ban className="w-4 h-4 text-zinc-400 mb-1.5" />
              <span className="text-xs font-medium text-zinc-500">
                Disabled Item
              </span>
              <span className="text-[10px] text-zinc-400 mt-0.5">
                not-allowed
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
