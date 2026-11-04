"use client";

import { useState } from "react";
import { Cpu, Terminal, Check, Copy, ExternalLink, ArrowRight } from "lucide-react";

export default function DocsSection() {
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSnippet(id);
    setTimeout(() => setCopiedSnippet(null), 2000);
  };

  const agentPromptSnippet = `Install the Curases custom cursor engine in this project using the 'Handy' cursor style.
Set size to 1.0 and speed to 1.0. Reference docs: https://curases.com/llms.txt.
Inject into root layout/HTML and ensure native cursor hiding does not break inputs.`;

  const htmlSnippet = `<script 
  src="https://curases.com/engine.js" 
  data-cursor="Handy" 
  data-size="1.0" 
  data-speed="1.0" 
  defer>
</script>`;

  const nextSnippet = `import Script from "next/script";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <Script
          src="https://curases.com/engine.js"
          strategy="afterInteractive"
          data-cursor="Handy"
          data-size="1.0"
          data-speed="1.0"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}`;

  return (
    <section id="docs" className="w-full py-16 border-t border-zinc-900 bg-zinc-950/50">
      <div className="max-w-6xl mx-auto px-4">
        {/* Section Header */}
        <div className="max-w-2xl mb-12">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-xs font-medium text-blue-400 mb-3">
            <Cpu className="w-3.5 h-3.5" />
            Agentic &amp; Developer Integration
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-100">
            Engineered for Agents &amp; Humans
          </h2>
          <p className="text-sm text-zinc-400 mt-2">
            No build steps, zero node_modules dependencies at runtime, and fully documented for LLMs via standardized <code>llms.txt</code>.
          </p>
        </div>

        {/* 3 Step Workflow */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="p-6 rounded-2xl bg-zinc-900/40 border border-zinc-800">
            <span className="w-8 h-8 rounded-xl bg-blue-600/20 text-blue-400 font-mono font-bold flex items-center justify-center text-sm mb-4">
              01
            </span>
            <h4 className="text-sm font-semibold text-zinc-100 mb-1">Pick a Style</h4>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Test motions in the interactive playground and select your preferred cursor and physics parameters.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-zinc-900/40 border border-zinc-800">
            <span className="w-8 h-8 rounded-xl bg-blue-600/20 text-blue-400 font-mono font-bold flex items-center justify-center text-sm mb-4">
              02
            </span>
            <h4 className="text-sm font-semibold text-zinc-100 mb-1">Prompt Your Agent</h4>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Paste the ready prompt into Cursor, Claude Code, Windsurf, or Copilot. The agent pulls context from <code>llms.txt</code>.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-zinc-900/40 border border-zinc-800">
            <span className="w-8 h-8 rounded-xl bg-blue-600/20 text-blue-400 font-mono font-bold flex items-center justify-center text-sm mb-4">
              03
            </span>
            <h4 className="text-sm font-semibold text-zinc-100 mb-1">Zero-Config Launch</h4>
            <p className="text-xs text-zinc-400 leading-relaxed">
              The engine automatically mounts to the DOM, intercepts interactions, scales to Retina displays, and tracks pointer states.
            </p>
          </div>
        </div>

        {/* Integration Code Tabs */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Box 1: The Agent Prompt */}
          <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-blue-400" />
                  <h4 className="text-sm font-semibold text-zinc-200">
                    The 1-Click Agent Prompt
                  </h4>
                </div>
                <button
                  onClick={() => copyToClipboard(agentPromptSnippet, "prompt")}
                  className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 font-medium cursor-pointer"
                >
                  {copiedSnippet === "prompt" ? (
                    <>
                      <Check className="w-3.5 h-3.5" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" /> Copy Prompt
                    </>
                  )}
                </button>
              </div>
              <p className="text-xs text-zinc-400 mb-3">
                Give this single instruction to your AI coding agent in any project:
              </p>
              <pre className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl text-xs font-mono text-zinc-300 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                {agentPromptSnippet}
              </pre>
            </div>
            <div className="mt-4 pt-3 border-t border-zinc-800/60 flex items-center justify-between text-xs text-zinc-400">
              <span>Agent Documentation Reference:</span>
              <a
                href="/llms.txt"
                target="_blank"
                className="inline-flex items-center gap-1 text-blue-400 hover:underline"
              >
                /llms.txt <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          {/* Box 2: Drop-in CDN Tag */}
          <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  <h4 className="text-sm font-semibold text-zinc-200">
                    Universal CDN Drop-in
                  </h4>
                </div>
                <button
                  onClick={() => copyToClipboard(htmlSnippet, "cdn")}
                  className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 font-medium cursor-pointer"
                >
                  {copiedSnippet === "cdn" ? (
                    <>
                      <Check className="w-3.5 h-3.5" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" /> Copy Script
                    </>
                  )}
                </button>
              </div>
              <p className="text-xs text-zinc-400 mb-3">
                Works on plain HTML, Webflow, Shopify, WordPress, or any web framework:
              </p>
              <pre className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl text-xs font-mono text-zinc-300 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                {htmlSnippet}
              </pre>
            </div>
            <div className="mt-4 pt-3 border-t border-zinc-800/60 flex items-center justify-between text-xs text-zinc-400">
              <span>Next.js App Router support:</span>
              <a
                href="#playground"
                className="inline-flex items-center gap-1 text-blue-400 hover:underline"
              >
                See Full Next.js Specs <ArrowRight className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
