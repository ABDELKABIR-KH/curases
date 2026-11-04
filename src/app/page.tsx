"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown, Copy } from "lucide-react";
import PreviewCard from "@/components/PreviewCard";
import { HANDY_CURSOR } from "@/lib/cursorData";

type AgentType = "Claude Code" | "Cursor" | "Next.js / React" | "Plain HTML / CDN";

const AGENT_CONFIGS: Record<
  AgentType,
  {
    command: string;
    docLinkText: string;
    docUrl: string;
    note: string;
  }
> = {
  "Claude Code": {
    command: "claude mcp add curases -- npx -y curases-mcp-server",
    docLinkText: "Claude Code MCP documentation ↗",
    docUrl: "https://curases.com/llms.txt",
    note: "Restart your agent or reload its MCP servers after configuration. Your agent starts the server when it connects.",
  },
  Cursor: {
    command: "npx curases install --agent cursor",
    docLinkText: "Cursor MCP documentation ↗",
    docUrl: "https://curases.com/llms.txt",
    note: "Configures .cursor/mcp.json automatically for your project workspace.",
  },
  "Next.js / React": {
    command: "npm install curases",
    docLinkText: "Next.js App Router integration guide ↗",
    docUrl: "https://curases.com/llms.txt",
    note: "Add the Script tag to app/layout.tsx to enable zero-latency hardware accelerated cursor physics.",
  },
  "Plain HTML / CDN": {
    command: '<script src="https://curases.com/engine.js" data-cursor="Handy" defer></script>',
    docLinkText: "CDN Quickstart documentation ↗",
    docUrl: "https://curases.com/llms.txt",
    note: "Paste before closing </head> tag on any Webflow, Shopify, Framer, or static website.",
  },
};

const COLOR_PRESETS = [
  { name: "Natural / Black", hex: "" },
  { name: "Electric Blue", hex: "#2563eb" },
  { name: "Neon Cyan", hex: "#06b6d4" },
  { name: "Purple Dream", hex: "#9333ea" },
  { name: "Emerald Green", hex: "#10b981" },
  { name: "Solar Orange", hex: "#f97316" },
  { name: "Crimson Red", hex: "#ef4444" },
];

function RuleHeading({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <h2
        className={`shrink-0 text-[13px] leading-5 tracking-[-0.08px] text-heading ${className}`}
      >
        {children}
      </h2>
      <div className="h-px flex-1 bg-line" />
    </div>
  );
}

function PlainHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-4 font-body text-[13px] font-medium leading-5 tracking-[-0.08px] text-muted">
      {children}
    </h2>
  );
}

function InlineCode({ children }: { children: ReactNode }) {
  return (
    <span className="font-mono text-[12.09px] font-normal text-[#000000BF]">
      {children}
    </span>
  );
}

function CodeBlock({
  code,
  copied,
  onCopy,
  className = "",
  children,
}: {
  code: string;
  copied: boolean;
  onCopy: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`relative ${className}`}>
      <div className="overflow-clip rounded-[10px] bg-panel py-3 pr-12 pl-4">
        <code className="block wrap-anywhere font-mono text-xs leading-5 text-code">
          {children}
        </code>
      </div>
      <button
        type="button"
        onClick={onCopy}
        className="absolute top-2 right-2 flex items-center justify-center rounded-sm p-1 text-[#777777] transition-colors hover:text-ink"
        title={`Copy ${code}`}
        aria-label="Copy to clipboard"
      >
        {copied ? (
          <Check className="size-[18px] text-syntax-green" strokeWidth={1.5} />
        ) : (
          <Copy className="size-[18px]" strokeWidth={1.5} />
        )}
      </button>
    </div>
  );
}

export default function Home() {
  const [selectedAgent, setSelectedAgent] = useState<AgentType>("Claude Code");
  const [isAgentMenuOpen, setIsAgentMenuOpen] = useState(false);
  const [activeCursorState, setActiveCursorState] = useState("normal");

  // Floating bar controls
  const [sizeVal, setSizeVal] = useState(1);
  const [speedVal, setSpeedVal] = useState(1);
  const [roughnessVal, setRoughnessVal] = useState(0);
  const [boilVal, setBoilVal] = useState(0.3);
  const [selectedColor, setSelectedColor] = useState("");
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [isCopyMenuOpen, setIsCopyMenuOpen] = useState(false);
  const lastBoilRef = useRef(0.3);

  // Copy feedback
  const [copiedStep1, setCopiedStep1] = useState(false);
  const [copiedStep2, setCopiedStep2] = useState(false);
  const [copiedStep3, setCopiedStep3] = useState(false);
  const [copiedFloatingPrompt, setCopiedFloatingPrompt] = useState(false);

  const agentDropdownRef = useRef<HTMLDivElement>(null);
  const colorDropdownRef = useRef<HTMLDivElement>(null);
  const copyDropdownRef = useRef<HTMLDivElement>(null);

  const activeAgent = AGENT_CONFIGS[selectedAgent];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        agentDropdownRef.current &&
        !agentDropdownRef.current.contains(e.target as Node)
      ) {
        setIsAgentMenuOpen(false);
      }
      if (
        colorDropdownRef.current &&
        !colorDropdownRef.current.contains(e.target as Node)
      ) {
        setIsColorPickerOpen(false);
      }
      if (
        copyDropdownRef.current &&
        !copyDropdownRef.current.contains(e.target as Node)
      ) {
        setIsCopyMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Keep the live cursor engine in sync with the floating controls.
  // The engine script loads after hydration, so retry briefly until it exists.
  useEffect(() => {
    const apply = () => {
      const engine = window.Curases;
      if (!engine) return false;

      engine.setSize(sizeVal);
      engine.setSpeed(speedVal);
      engine.setColor(selectedColor);
      if (typeof engine.setRoughness === "function") {
        engine.setRoughness(roughnessVal);
      }
      if (typeof engine.setBoil === "function") {
        engine.setBoil(boilVal);
      }
      engine.state(activeCursorState);
      return true;
    };

    if (apply()) return;

    const interval = window.setInterval(() => {
      if (apply()) window.clearInterval(interval);
    }, 200);
    const timeout = window.setTimeout(
      () => window.clearInterval(interval),
      8000,
    );

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [sizeVal, speedVal, selectedColor, roughnessVal, boilVal, activeCursorState]);

  const copyToClipboard = async (
    text: string,
    setCopied: (value: boolean) => void,
  ) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard access can be blocked outside a secure context.
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const roughnessParam = roughnessVal > 0 ? `, roughness ${roughnessVal.toFixed(1)}` : "";
  const boilParam = boilVal > 0 ? `, boil ${boilVal.toFixed(1)}` : "";
  const roughnessAttr = roughnessVal > 0 ? ` data-roughness="${roughnessVal.toFixed(1)}"` : "";
  const boilAttr = boilVal > 0 ? ` data-boil="${boilVal.toFixed(1)}"` : "";

  const agentPrompt = `Install Curases, the custom cursor engine, with the "Handy" preset, size ${sizeVal.toFixed(1)}x, speed ${speedVal.toFixed(1)}${roughnessParam}${boilParam}. Docs: https://curases.com/llms.txt`;
  const scriptTag = `<script src="https://curases.com/engine.js" data-cursor="Handy" data-size="${sizeVal.toFixed(1)}" data-speed="${speedVal.toFixed(1)}"${roughnessAttr}${boilAttr} defer></script>`;
  const componentTag =
    '<Curases endpoint="http://localhost:4347" cursor="Handy" />';

  const handleStateClick = (stateId: string) => {
    setActiveCursorState(stateId);
    window.Curases?.state(stateId);
  };

  const toggleBoil = () => {
    setBoilVal((current) => {
      if (current > 0) {
        lastBoilRef.current = current;
        return 0;
      }
      return lastBoilRef.current || 0.3;
    });
  };

  return (
    <div className="min-h-screen bg-white pb-32 font-sans text-ink sm:pb-36">
      <div className="mx-auto flex w-full max-w-[576px] flex-col gap-6 px-6 pt-[50px] pb-12">
        <header className="flex h-fit items-center justify-between gap-4">
          <nav className="flex items-start gap-4" aria-label="Primary">
            <a
              href="#overview"
              className="text-[12px] leading-[150%] font-semibold text-ink transition-colors hover:text-black"
            >
              Overview
            </a>
            <a
              href="#install"
              className="text-[12px] leading-[150%] font-semibold text-muted transition-colors hover:text-ink"
            >
              Install
            </a>
            <a
              href="/llms.txt"
              target="_blank"
              rel="noreferrer"
              className="text-[12px] leading-[150%] font-semibold text-muted transition-colors hover:text-ink"
            >
              Docs
            </a>
          </nav>
          <span className="font-body text-[10px] leading-3 font-[450] text-faint underline decoration-dotted underline-offset-2">
            v1.0
          </span>
        </header>

        <main className="flex flex-col gap-6">
          <section
            id="overview"
            className="flex scroll-mt-8 flex-col items-center justify-center gap-4 self-stretch"
          >
            <h1 className="w-full text-[14px] leading-[22px] tracking-[-0.08px] text-body">
              <span className="font-wordmark font-semibold">Curases</span>{" "}
              <span className="font-sans font-semibold">
                turns custom cursor physics and multi-state animations into
                structured context that AI coding agents can understand and act
                on.
              </span>
            </h1>

            <div className="w-full">
              <PreviewCard
                cursorName={HANDY_CURSOR.name}
                cursorStates={HANDY_CURSOR.states as unknown as Record<string, string>}
                hotspots={HANDY_CURSOR.hotspots as unknown as Record<string, [number, number]>}
                activeState={activeCursorState}
                onStateChange={handleStateClick}
                size={sizeVal}
                speed={speedVal}
                color={selectedColor}
                roughness={roughnessVal}
                boil={boilVal}
                onReset={() => handleStateClick("normal")}
                onToggleBoil={toggleBoil}
              />
            </div>
          </section>

          <section
            id="install"
            className="mt-4 scroll-mt-8 text-xs leading-4"
          >
            <RuleHeading className="font-sans font-bold">
              Connect your agent
            </RuleHeading>

            <p className="mt-3 font-sans text-[14px] leading-[22px] font-semibold tracking-[-0.08px] text-body">
              Claude Code, Cursor, Gemini CLI, and other MCP clients can connect
              through Curases. Use Node.js 24 LTS for a new setup. Node.js 22
              LTS and 20 are also compatible.
            </p>

            <h3 className="mt-6 mb-2 font-body text-[13px] leading-5 font-medium tracking-[-0.08px] text-label">
              1. Register the MCP server
            </h3>

            <div className="mt-3 mb-4">
              <div className="flex items-center gap-3">
                <span className="font-body text-xs leading-4 text-muted">
                  Your agent
                </span>

                <div className="relative" ref={agentDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setIsAgentMenuOpen((open) => !open)}
                    aria-expanded={isAgentMenuOpen}
                    aria-haspopup="listbox"
                    className="flex min-h-[34px] min-w-[180px] items-center justify-between gap-3 rounded-[10px] border-[0.8px] border-border bg-white px-[11px] py-[7px] text-left font-body text-[13px] leading-[140%] text-[#171716] transition-colors hover:border-[#D4D0CB]"
                  >
                    <span className="min-w-0 truncate">{selectedAgent}</span>
                    <span className="flex shrink-0 opacity-55">
                      <ChevronDown className="size-[18px]" strokeWidth={1.5} />
                    </span>
                  </button>

                  {isAgentMenuOpen && (
                    <div
                      role="listbox"
                      className="absolute top-full right-0 z-30 mt-1.5 w-[180px] rounded-[10px] border border-border bg-white p-1 shadow-lg"
                    >
                      {(Object.keys(AGENT_CONFIGS) as AgentType[]).map(
                        (agent) => (
                          <button
                            key={agent}
                            type="button"
                            role="option"
                            aria-selected={selectedAgent === agent}
                            onClick={() => {
                              setSelectedAgent(agent);
                              setIsAgentMenuOpen(false);
                            }}
                            className={`w-full rounded-md px-2 py-1.5 text-left font-body text-[13px] leading-[140%] transition-colors ${
                              selectedAgent === agent
                                ? "bg-surface font-medium text-ink"
                                : "text-muted hover:bg-surface hover:text-ink"
                            }`}
                          >
                            {agent}
                          </button>
                        ),
                      )}
                    </div>
                  )}
                </div>
              </div>

              <p className="mt-2 font-body text-xs leading-[18px] font-[450] tracking-[-0.08px] text-muted">
                Run this in your terminal with {selectedAgent} installed.
              </p>

              <CodeBlock
                className="my-3"
                code={activeAgent.command}
                copied={copiedStep1}
                onCopy={() =>
                  copyToClipboard(activeAgent.command, setCopiedStep1)
                }
              >
                {activeAgent.command}
              </CodeBlock>

              <div className="mt-2">
                <a
                  href={activeAgent.docUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-body text-xs leading-[18px] font-[450] tracking-[-0.08px] text-link transition-colors hover:underline"
                >
                  {activeAgent.docLinkText}
                </a>
              </div>

              <p className="mt-3 font-body text-[14px] leading-[22px] font-[450] tracking-[-0.08px] text-body">
                {activeAgent.note}
              </p>
            </div>

            <h3 className="mt-6 mb-2 font-body text-[13px] leading-5 font-medium tracking-[-0.08px] text-label">
              2. Verify setup
            </h3>

            <p className="mt-3 font-body text-[14px] leading-[22px] font-[450] tracking-[-0.08px] text-body">
              Check that everything is configured correctly:
            </p>

            <CodeBlock
              className="my-4"
              code="npx curases verify"
              copied={copiedStep2}
              onCopy={() => copyToClipboard("npx curases verify", setCopiedStep2)}
            >
              npx curases verify
            </CodeBlock>

            <p className="mt-4 font-body text-[13px] leading-5 font-[450] tracking-[-0.08px] text-muted">
              The server runs on port 4347 by default. Use{" "}
              <InlineCode>--port 8080</InlineCode> to change it.
            </p>

            <h3 className="mt-4 mb-2 font-body text-[13px] leading-5 font-medium tracking-[-0.08px] text-label">
              3. Connect the component
            </h3>

            <p className="mt-3 font-body text-[14px] leading-[22px] font-[450] tracking-[-0.08px] text-body">
              Point the React component to your server:
            </p>

            <CodeBlock
              className="my-4"
              code={componentTag}
              copied={copiedStep3}
              onCopy={() => copyToClipboard(componentTag, setCopiedStep3)}
            >
              <span className="text-code-muted">
                &lt;<span className="text-syntax-red">Curases</span>{" "}
                <span className="text-syntax-blue">endpoint</span>=
                <span className="text-syntax-green">
                  &quot;http://localhost:4347&quot;
                </span>{" "}
                <span className="text-syntax-blue">cursor</span>=
                <span className="text-syntax-green">&quot;Handy&quot;</span>{" "}
                <span className="text-syntax-red">/&gt;</span>
              </span>
            </CodeBlock>

            <p className="mt-4 font-body text-[13px] leading-5 font-[450] tracking-[-0.08px] text-muted">
              Cursor presets are stored locally and synced to the server when
              connected. Registering the server with your agent does not load a
              cursor for you. Drop the component into your page, then ask your
              agent to list available cursors to check the complete connection.
            </p>

            <ul className="mt-4 flex flex-col gap-1 pl-4">
              <li className="font-body text-[13px] leading-5 font-[450] tracking-[-0.08px] text-muted">
                Local-first: Works offline; cursor presets load from your bundle
              </li>
              <li className="font-body text-[13px] leading-5 font-[450] tracking-[-0.08px] text-muted">
                Session continuity: Keeps the active cursor state across page
                transitions
              </li>
              <li className="font-body text-[13px] leading-5 font-[450] tracking-[-0.08px] text-muted">
                No duplicates: Presets are registered once and reused by every
                route
              </li>
              <li className="font-body text-[13px] leading-5 font-[450] tracking-[-0.08px] text-muted">
                Server authority: Agent changes to size, speed, or color take
                precedence on reload
              </li>
            </ul>

            <div className="my-4 border-l-[1.6px] border-l-[#D8D8D8] px-4 py-3">
              <p className="font-body text-[13px] leading-5 font-[450] tracking-[-0.08px] text-muted">
                Using Claude Code? The optional <InlineCode>/curases</InlineCode>{" "}
                skill can set up the React component for you. Install it with{" "}
                <InlineCode>npx curases add /curases/integration</InlineCode>,
                then run <InlineCode>/curases</InlineCode> in Claude Code.
              </p>
            </div>
          </section>

          <section className="mt-4 text-xs leading-4">
            <PlainHeading>Requirements</PlainHeading>

            <ul className="mt-3 flex flex-col gap-1 pl-4">
              <li className="font-body text-[13px] leading-5 font-[450] tracking-[-0.08px] text-muted">
                Node.js 24 LTS+: Runs the MCP server and the verify command
              </li>
              <li className="font-body text-[13px] leading-5 font-[450] tracking-[-0.08px] text-muted">
                Framework agnostic: Works with React, Next.js, and plain HTML
              </li>
              <li className="font-body text-[13px] leading-5 font-[450] tracking-[-0.08px] text-muted">
                Client-side only: Requires DOM access for pointer tracking
              </li>
              <li className="font-body text-[13px] leading-5 font-[450] tracking-[-0.08px] text-muted">
                Zero dependencies: No runtime deps beyond the engine script
              </li>
            </ul>
          </section>

          <section className="mt-4">
            <RuleHeading className="font-body font-[550]">
              Customize your setup
            </RuleHeading>

            <p className="mt-3 font-body text-[14px] leading-[22px] font-[450] tracking-[-0.08px] text-body">
              The{" "}
              <a
                href="/api/registry"
                target="_blank"
                rel="noreferrer"
                className="text-link transition-colors hover:underline"
              >
                API reference
              </a>{" "}
              covers every prop and callback, including cursor presets, size,
              speed, color, state overrides, and integrations with the floating
              control bar.
            </p>
          </section>

          <section className="mt-4">
            <PlainHeading>Security notes</PlainHeading>

            <p className="mt-3 font-body text-[13px] leading-5 font-[450] tracking-[-0.08px] text-muted">
              Curases runs in your browser and reads pointer and DOM events to
              render the cursor. By default, it does not send data anywhere.
              Everything stays local until you copy a preset or prompt.
            </p>

            <ul className="mt-3 flex flex-col gap-1 pl-4">
              <li className="font-body text-[13px] leading-5 font-[450] tracking-[-0.08px] text-muted">
                No external requests: all processing is client-side by default
              </li>
              <li className="font-body text-[13px] leading-5 font-[450] tracking-[-0.08px] text-muted">
                Your configured endpoint: cursor presets are served from the
                path you choose. Use a localhost endpoint for a local workflow
              </li>
              <li className="font-body text-[13px] leading-5 font-[450] tracking-[-0.08px] text-muted">
                Optional integrations: configured webhooks and callbacks can
                send cursor telemetry to other services
              </li>
              <li className="font-body text-[13px] leading-5 font-[450] tracking-[-0.08px] text-muted">
                Dev-only: use the <InlineCode>NODE_ENV</InlineCode> check to
                exclude from production
              </li>
            </ul>
          </section>
        </main>
      </div>

      <aside
        aria-label="Cursor controls"
        className="fixed bottom-[21px] left-1/2 z-50 flex w-max max-w-[calc(100vw-24px)] -translate-x-1/2 items-center justify-center gap-[6px] rounded-2xl bg-surface px-2 py-2 [outline:0.8px_solid_#0000000A] lg:gap-[10px]"
      >
        <div className="relative flex h-[42px] w-[38px] shrink-0 items-center justify-center" ref={colorDropdownRef}>
          <button
            type="button"
            onClick={() => setIsColorPickerOpen((open) => !open)}
            aria-expanded={isColorPickerOpen}
            aria-label="Choose cursor color"
            title="Choose cursor color"
            className="size-[38px] shrink-0 rounded-xl transition-transform hover:scale-105 [outline:0.8px_solid_#D4D4D4] [outline-offset:0.8px]"
            style={{ backgroundColor: selectedColor || "#000000" }}
          />

          {isColorPickerOpen && (
            <div className="absolute bottom-full left-0 z-50 mb-3 w-44 rounded-xl border border-border bg-white p-2 shadow-lg">
              <div className="grid grid-cols-4 gap-1.5">
                {COLOR_PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => {
                      setSelectedColor(preset.hex);
                      setIsColorPickerOpen(false);
                    }}
                    title={preset.name}
                    aria-label={`Use ${preset.name}`}
                    className={`size-7 rounded-lg transition-transform hover:scale-110 [outline:1px_solid_#00000014] ${
                      selectedColor === preset.hex
                        ? "[outline:2px_solid_#222222] [outline-offset:1px]"
                        : ""
                    }`}
                    style={{ backgroundColor: preset.hex || "#000000" }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <span className="h-[30px] w-px shrink-0 bg-line" />

        <div className="flex shrink-0 items-center gap-1.5 rounded-xl bg-control px-2 py-2 [outline:0.8px_solid_#00000005] lg:gap-4 lg:px-3.5">
          <span className="hidden font-mono text-[13px] leading-[160%] text-muted lg:inline">
            Size
          </span>
          <input
            type="number"
            min="0.5"
            max="3"
            step="0.1"
            value={sizeVal}
            onChange={(e) =>
              setSizeVal(Math.min(3, Math.max(0.5, Number(e.target.value) || 1)))
            }
            aria-label="Cursor size multiplier"
            className="w-7 bg-transparent text-center font-sans text-[13px] leading-[160%] font-medium text-muted outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <span className="hidden font-sans text-[13px] leading-[165%] font-medium text-muted lg:inline">
            X
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 rounded-xl bg-control px-2 py-2 [outline:0.8px_solid_#00000005] lg:gap-4 lg:px-3.5">
          <span className="hidden font-sans text-[13px] leading-[166%] font-medium text-muted lg:inline">
            Speed
          </span>
          <input
            type="number"
            min="0.1"
            max="2"
            step="0.1"
            value={speedVal}
            onChange={(e) => setSpeedVal(Number(e.target.value) || 1)}
            aria-label="Cursor speed multiplier"
            className="w-7 bg-transparent text-center font-sans text-[13px] leading-[160%] font-medium text-muted outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <span className="hidden font-sans text-[13px] leading-[165%] font-medium text-muted lg:inline">
            X
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 rounded-xl bg-control px-2 py-2 [outline:0.8px_solid_#00000005] lg:gap-4 lg:px-3.5">
          <span className="hidden font-sans text-[13px] leading-[166%] font-medium text-muted lg:inline">
            Rough
          </span>
          <input
            type="number"
            min="0"
            max="2"
            step="0.1"
            value={roughnessVal}
            onChange={(e) =>
              setRoughnessVal(Math.min(2, Math.max(0, Number(e.target.value) || 0)))
            }
            aria-label="Cursor path roughness"
            className="w-7 bg-transparent text-center font-sans text-[13px] leading-[160%] font-medium text-muted outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <span className="hidden font-sans text-[13px] leading-[165%] font-medium text-muted lg:inline">
            {roughnessVal === 0 ? "OFF" : "FX"}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 rounded-xl bg-control px-2 py-2 [outline:0.8px_solid_#00000005] lg:gap-4 lg:px-3.5">
          <span className="hidden font-sans text-[13px] leading-[166%] font-medium text-muted lg:inline">
            Boil
          </span>
          <input
            type="number"
            min="0"
            max="1"
            step="0.1"
            value={boilVal}
            onChange={(e) =>
              setBoilVal(Math.min(1, Math.max(0, Number(e.target.value) || 0)))
            }
            aria-label="Cursor boil animation amount"
            className="w-7 bg-transparent text-center font-sans text-[13px] leading-[160%] font-medium text-muted outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <span className="hidden font-sans text-[13px] leading-[165%] font-medium text-muted lg:inline">
            {boilVal === 0 ? "OFF" : "X"}
          </span>
        </div>

        <span className="h-[30px] w-px shrink-0 bg-line" />

        <div
          className="flex shrink-0 items-center rounded-xl bg-control [outline:0.8px_solid_#00000005]"
          ref={copyDropdownRef}
        >
          <button
            type="button"
            onClick={() =>
              copyToClipboard(agentPrompt, setCopiedFloatingPrompt)
            }
            className="min-w-[72px] py-2 pr-1 pl-2 text-left font-sans text-[13px] leading-[160%] font-medium text-muted transition-colors hover:text-ink lg:min-w-[78px] lg:pr-2 lg:pl-3.5"
          >
            {copiedFloatingPrompt ? "Copied" : "Copy prompt"}
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setIsCopyMenuOpen((open) => !open)}
              aria-expanded={isCopyMenuOpen}
              aria-label="More copy formats"
              title="More copy formats"
              className="flex items-center py-2 pr-2 pl-1 text-muted opacity-55 transition-opacity hover:opacity-100 lg:pr-3.5"
            >
              <ChevronDown className="size-[18px]" strokeWidth={1.5} />
            </button>

            {isCopyMenuOpen && (
              <div className="absolute right-0 bottom-full z-50 mb-3 w-56 rounded-xl border border-border bg-white p-1 shadow-lg">
                <button
                  type="button"
                  onClick={() => {
                    copyToClipboard(agentPrompt, setCopiedFloatingPrompt);
                    setIsCopyMenuOpen(false);
                  }}
                  className="w-full rounded-lg px-3 py-2 text-left transition-colors hover:bg-surface"
                >
                  <span className="block font-body text-[12px] font-medium text-ink">
                    Copy agent prompt
                  </span>
                  <span className="mt-0.5 block font-body text-[11px] text-muted">
                    Claude Code, Cursor, Copilot
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    copyToClipboard(scriptTag, setCopiedFloatingPrompt);
                    setIsCopyMenuOpen(false);
                  }}
                  className="w-full rounded-lg px-3 py-2 text-left transition-colors hover:bg-surface"
                >
                  <span className="block font-body text-[12px] font-medium text-ink">
                    Copy CDN script
                  </span>
                  <span className="mt-0.5 block font-body text-[11px] text-muted">
                    Plain HTML, Webflow, Shopify
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    copyToClipboard(componentTag, setCopiedFloatingPrompt);
                    setIsCopyMenuOpen(false);
                  }}
                  className="w-full rounded-lg px-3 py-2 text-left transition-colors hover:bg-surface"
                >
                  <span className="block font-body text-[12px] font-medium text-ink">
                    Copy React component
                  </span>
                  <span className="mt-0.5 block font-body text-[11px] text-muted">
                    Next.js App Router, Vite
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
