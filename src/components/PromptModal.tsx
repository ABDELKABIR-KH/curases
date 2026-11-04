"use client";

import { useState } from "react";
import { Copy, Check, X, Sparkles, Code2, Layers, Cpu } from "lucide-react";

interface PromptModalProps {
  cursorId: string;
  size: number;
  speed: number;
  color: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function PromptModal({
  cursorId,
  size,
  speed,
  color,
  isOpen,
  onClose,
}: PromptModalProps) {
  const [activeTab, setActiveTab] = useState<"agent" | "cdn" | "nextjs" | "react">("agent");
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const colorAttr = color ? ` data-color="${color}"` : "";

  const agentPrompt = `Install and configure the Curases custom cursor engine in this project using the '${cursorId}' cursor style.
- Set cursor style: "${cursorId}"
- Set size: ${size}
- Set speed: ${speed}${color ? `\n- Set color tint: "${color}"` : ""}
- Ensure native cursor hiding does not conflict with input text selection.
- Reference documentation: https://curases.com/llms.txt`;

  const cdnSnippet = `<script 
  src="https://curases.com/engine.js" 
  data-cursor="${cursorId}" 
  data-size="${size}" 
  data-speed="${speed}"${colorAttr}
  defer>
</script>`;

  const nextjsSnippet = `import Script from "next/script";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <Script
          src="https://curases.com/engine.js"
          strategy="afterInteractive"
          data-cursor="${cursorId}"
          data-size="${size}"
          data-speed="${speed}"${colorAttr}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}`;

  const reactSnippet = `import { useEffect } from "react";

export function CurasesCursor() {
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://curases.com/engine.js";
    script.setAttribute("data-cursor", "${cursorId}");
    script.setAttribute("data-size", "${size}");
    script.setAttribute("data-speed", "${speed}");
    ${color ? `script.setAttribute("data-color", "${color}");` : ""}
    script.defer = true;
    document.head.appendChild(script);

    return () => {
      script.remove();
      window.Curases?.hide();
    };
  }, []);

  return null;
}`;

  const currentContent =
    activeTab === "agent"
      ? agentPrompt
      : activeTab === "cdn"
      ? cdnSnippet
      : activeTab === "nextjs"
      ? nextjsSnippet
      : reactSnippet;

  const handleCopy = () => {
    navigator.clipboard.writeText(currentContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl p-6 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
              <Sparkles className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-lg font-semibold text-zinc-100">
                Install {cursorId} Cursor
              </h3>
              <p className="text-xs text-zinc-400">
                Ready for AI coding agents and all modern web frameworks
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mt-4 p-1 bg-zinc-900/60 rounded-xl border border-zinc-800/60">
          <button
            onClick={() => setActiveTab("agent")}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg transition-all ${
              activeTab === "agent"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            Agent Prompt (Cursor / Claude)
          </button>
          <button
            onClick={() => setActiveTab("cdn")}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg transition-all ${
              activeTab === "cdn"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            HTML Script Tag
          </button>
          <button
            onClick={() => setActiveTab("nextjs")}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg transition-all ${
              activeTab === "nextjs"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Next.js
          </button>
          <button
            onClick={() => setActiveTab("react")}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg transition-all ${
              activeTab === "react"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            React
          </button>
        </div>

        {/* Code Snippet Box */}
        <div className="relative mt-4">
          <pre className="p-4 bg-zinc-900/80 border border-zinc-800 rounded-xl text-xs font-mono text-zinc-300 overflow-x-auto whitespace-pre-wrap max-h-64 leading-relaxed">
            {currentContent}
          </pre>
          <button
            onClick={handleCopy}
            className="absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition-colors shadow"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                Copy
              </>
            )}
          </button>
        </div>

        {/* Tip for Agent Prompt */}
        {activeTab === "agent" && (
          <div className="mt-3 p-3 rounded-lg bg-blue-950/40 border border-blue-900/40 text-[11px] text-blue-300 leading-normal flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <span>
              Tip: Paste this directly into Cursor, Claude Code, Windsurf, or Copilot. The agent will read <strong>https://curases.com/llms.txt</strong> and inject the code into your project automatically.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
