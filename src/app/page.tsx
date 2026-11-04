"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown, Copy } from "lucide-react";
import PreviewCard from "@/components/PreviewCard";
import { HANDY_CURSOR } from "@/lib/cursorData";

type InstallMethod =
  | "npx (Recommended)"
  | "Next.js / React (npm)"
  | "Plain HTML / CDN"
  | "Claude Code / Cursor";

interface InstallConfig {
  command: string;
  docLinkText: string;
  docUrl: string;
  note: string;
  snippetLabel: string;
  snippetCode: string;
}

const INSTALL_CONFIGS: Record<InstallMethod, InstallConfig> = {
  "npx (Recommended)": {
    command: "npx curases handy",
    docLinkText: "Interactive CLI guide ↗",
    docUrl: "https://www.npmjs.com/package/curases",
    note: "Auto-detects your project (Next.js, React, Vite, or HTML), installs the package, and configures the cursor automatically.",
    snippetLabel: "Terminal command",
    snippetCode: `# Run inside your project root:\nnpx curases handy\n\n# Or pick from an interactive menu:\nnpx curases`,
  },
  "Next.js / React (npm)": {
    command: "npm install curases",
    docLinkText: "View package on npm ↗",
    docUrl: "https://www.npmjs.com/package/curases",
    note: "Zero-dependency client package. Import <Curases /> into app/layout.tsx with full TypeScript support and SSR safety.",
    snippetLabel: "app/layout.tsx",
    snippetCode: `import { Curases } from "curases/react";\n\nexport default function RootLayout({ children }: { children: React.ReactNode }) {\n  return (\n    <html lang="en">\n      <body>\n        <Curases cursor="Handy" size={1.5} speed={1} />\n        {children}\n      </body>\n    </html>\n  );\n}`,
  },
  "Plain HTML / CDN": {
    command: '<script src="https://www.curases.com/engine.js" data-cursor="Handy" defer></script>',
    docLinkText: "CDN Integration guide ↗",
    docUrl: "https://curases.com/llms.txt",
    note: "Zero-install script tag. Paste before the closing </head> tag on Webflow, Shopify, Framer, WordPress, or static HTML.",
    snippetLabel: "index.html",
    snippetCode: `<!-- Add inside <head> -->\n<script\n  src="https://www.curases.com/engine.js"\n  data-cursor="Handy"\n  data-size="1.5"\n  data-speed="1"\n  defer\n></script>`,
  },
  "Claude Code / Cursor": {
    command: "claude mcp add curases -- npx -y curases-mcp-server",
    docLinkText: "Claude Code & Cursor MCP docs ↗",
    docUrl: "https://curases.com/llms.txt",
    note: "Let your AI coding agents install presets, tweak physics, and configure cursors directly in your workspace.",
    snippetLabel: "Agent configuration",
    snippetCode: `# Register MCP server with your AI agent:\nclaude mcp add curases -- npx -y curases-mcp-server\n\n# Or configure via Cursor:\nnpx curases install --agent cursor`,
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
        <code className="block wrap-anywhere font-mono text-xs leading-5 text-code whitespace-pre">
          {children}
        </code>
      </div>
      <button
        type="button"
        onClick={onCopy}
        className="absolute top-2 right-2 flex items-center justify-center rounded-sm p-1 text-[#777777] transition-colors hover:text-ink cursor-pointer"
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
  const [selectedMethod, setSelectedMethod] = useState<InstallMethod>("npx (Recommended)");
  const [isMethodMenuOpen, setIsMethodMenuOpen] = useState(false);
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
  const [copiedFloatingPrompt, setCopiedFloatingPrompt] = useState(false);

  const methodDropdownRef = useRef<HTMLDivElement>(null);
  const colorDropdownRef = useRef<HTMLDivElement>(null);
  const copyDropdownRef = useRef<HTMLDivElement>(null);

  const activeMethod = INSTALL_CONFIGS[selectedMethod];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        methodDropdownRef.current &&
        !methodDropdownRef.current.contains(e.target as Node)
      ) {
        setIsMethodMenuOpen(false);
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
  useEffect(() => {
    const apply = () => {
      const engine = (window.Curases || window.CustomCursor) as any;
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
  const colorParam = selectedColor ? `, color "${selectedColor}"` : "";
  const colorAttr = selectedColor ? ` data-color="${selectedColor}"` : "";

  const agentPrompt = `Install Curases, the custom cursor engine, with the "Handy" preset, size ${sizeVal.toFixed(1)}x, speed ${speedVal.toFixed(1)}${colorParam}${roughnessParam}${boilParam}. Docs: https://curases.com/llms.txt`;
  const scriptTag = `<script src="https://www.curases.com/engine.js" data-cursor="Handy" data-size="${sizeVal.toFixed(1)}" data-speed="${speedVal.toFixed(1)}"${colorAttr}${roughnessAttr}${boilAttr} defer></script>`;
  
  const handleStateClick = (stateId: string) => {
    setActiveCursorState(stateId);
    ((window.Curases || window.CustomCursor) as any)?.state(stateId);
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
              href="https://www.npmjs.com/package/curases"
              target="_blank"
              rel="noreferrer"
              className="text-[12px] leading-[150%] font-semibold text-muted transition-colors hover:text-ink"
            >
              npm
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
            v0.2.0
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
                is a zero-latency, hardware-accelerated custom cursor engine with
                multi-state animations, live SVG physics, and instant npm or CDN deployment.
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
              Installation & Integration
            </RuleHeading>

            <p className="mt-3 font-sans text-[14px] leading-[22px] font-semibold tracking-[-0.08px] text-body">
              Install via npm, drop a 1-line CDN script tag into any website, or use
              the interactive npx setup tool. The engine is centrally hosted on your
              edge so bug fixes and new cursor presets update automatically without redeploying.
            </p>

            <h3 className="mt-6 mb-2 font-body text-[13px] leading-5 font-medium tracking-[-0.08px] text-label">
              1. Choose your installation method
            </h3>

            <div className="mt-3 mb-4">
              <div className="flex items-center gap-3">
                <span className="font-body text-xs leading-4 text-muted">
                  Method
                </span>

                <div className="relative" ref={methodDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setIsMethodMenuOpen((open) => !open)}
                    aria-expanded={isMethodMenuOpen}
                    aria-haspopup="listbox"
                    className="flex min-h-[34px] min-w-[210px] items-center justify-between gap-3 rounded-[10px] border-[0.8px] border-border bg-white px-[11px] py-[7px] text-left font-body text-[13px] leading-[140%] text-[#171716] transition-colors hover:border-[#D4D0CB] cursor-pointer"
                  >
                    <span className="min-w-0 truncate">{selectedMethod}</span>
                    <span className="flex shrink-0 opacity-55">
                      <ChevronDown className="size-[18px]" strokeWidth={1.5} />
                    </span>
                  </button>

                  {isMethodMenuOpen && (
                    <div
                      role="listbox"
                      className="absolute top-full left-0 z-30 mt-1.5 w-[220px] rounded-[10px] border border-border bg-white p-1 shadow-lg"
                    >
                      {(Object.keys(INSTALL_CONFIGS) as InstallMethod[]).map(
                        (method) => (
                          <button
                            key={method}
                            type="button"
                            role="option"
                            aria-selected={selectedMethod === method}
                            onClick={() => {
                              setSelectedMethod(method);
                              setIsMethodMenuOpen(false);
                            }}
                            className={`w-full rounded-md px-2 py-1.5 text-left font-body text-[13px] leading-[140%] transition-colors cursor-pointer ${
                              selectedMethod === method
                                ? "bg-surface font-medium text-ink"
                                : "text-muted hover:bg-surface hover:text-ink"
                            }`}
                          >
                            {method}
                          </button>
                        ),
                      )}
                    </div>
                  )}
                </div>
              </div>

              <CodeBlock
                className="my-3"
                code={activeMethod.command}
                copied={copiedStep1}
                onCopy={() =>
                  copyToClipboard(activeMethod.command, setCopiedStep1)
                }
              >
                {activeMethod.command}
              </CodeBlock>

              <div className="mt-2">
                <a
                  href={activeMethod.docUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-body text-xs leading-[18px] font-[450] tracking-[-0.08px] text-link transition-colors hover:underline"
                >
                  {activeMethod.docLinkText}
                </a>
              </div>

              <p className="mt-3 font-body text-[14px] leading-[22px] font-[450] tracking-[-0.08px] text-body">
                {activeMethod.note}
              </p>
            </div>

            <h3 className="mt-6 mb-2 font-body text-[13px] leading-5 font-medium tracking-[-0.08px] text-label">
              2. {activeMethod.snippetLabel}
            </h3>

            <p className="mt-3 font-body text-[14px] leading-[22px] font-[450] tracking-[-0.08px] text-body">
              Add the snippet to your application:
            </p>

            <CodeBlock
              className="my-4"
              code={activeMethod.snippetCode}
              copied={copiedStep2}
              onCopy={() => copyToClipboard(activeMethod.snippetCode, setCopiedStep2)}
            >
              {activeMethod.snippetCode}
            </CodeBlock>

            <h3 className="mt-6 mb-2 font-body text-[13px] leading-5 font-medium tracking-[-0.08px] text-label">
              3. Thin client & hosted engine features
            </h3>

            <ul className="mt-3 flex flex-col gap-2 pl-4">
              <li className="font-body text-[13px] leading-5 font-[450] tracking-[-0.08px] text-muted">
                <strong className="text-ink">Zero Maintenance:</strong> The engine is served from <InlineCode>https://www.curases.com/engine.js</InlineCode>. Physics updates, optimizations, and new cursor presets roll out automatically without users needing to redeploy.
              </li>
              <li className="font-body text-[13px] leading-5 font-[450] tracking-[-0.08px] text-muted">
                <strong className="text-ink">Dual Distribution:</strong> Choose between a fully-typed npm package with React/Next.js components (<InlineCode>curases/react</InlineCode>) or a zero-install 1-line CDN script tag.
              </li>
              <li className="font-body text-[13px] leading-5 font-[450] tracking-[-0.08px] text-muted">
                <strong className="text-ink">Interactive npx CLI:</strong> Run <InlineCode>npx curases handy</InlineCode> in any terminal to automatically inspect your project, install packages, and inject components.
              </li>
              <li className="font-body text-[13px] leading-5 font-[450] tracking-[-0.08px] text-muted">
                <strong className="text-ink">Multi-State Detection:</strong> Automatically morphs cursor states on interactive elements: hover, click, drag, typing, and not-allowed.
              </li>
              <li className="font-body text-[13px] leading-5 font-[450] tracking-[-0.08px] text-muted">
                <strong className="text-ink">Roughness & Boil Animation:</strong> Real-time procedural SVG sketch jitter and hand-drawn line boiling physics.
              </li>
            </ul>
          </section>

          <section className="mt-4 text-xs leading-4">
            <PlainHeading>Requirements & Compatibility</PlainHeading>

            <ul className="mt-3 flex flex-col gap-1 pl-4">
              <li className="font-body text-[13px] leading-5 font-[450] tracking-[-0.08px] text-muted">
                Framework support: React 18 & 19, Next.js (App & Pages Router), Vite, Astro, Vue, and plain HTML
              </li>
              <li className="font-body text-[13px] leading-5 font-[450] tracking-[-0.08px] text-muted">
                No-code tools: Fully compatible with Webflow, Framer, Shopify, WordPress, and Squarespace
              </li>
              <li className="font-body text-[13px] leading-5 font-[450] tracking-[-0.08px] text-muted">
                Ultra-lightweight footprint: The npm package is only ~11 KB and introduces 0 external runtime dependencies
              </li>
              <li className="font-body text-[13px] leading-5 font-[450] tracking-[-0.08px] text-muted">
                SSR safe: Zero hydration warnings or DOM mismatches in Next.js
              </li>
            </ul>
          </section>

          <section className="mt-4">
            <RuleHeading className="font-body font-[550]">
              Configuration & Props Reference
            </RuleHeading>

            <div className="overflow-x-auto">
              <table className="w-full text-left font-body text-[13px] leading-5 text-muted">
                <thead>
                  <tr className="border-b border-line text-ink">
                    <th className="py-2 pr-4 font-semibold">Prop / Attribute</th>
                    <th className="py-2 pr-4 font-semibold">Type</th>
                    <th className="py-2 pr-4 font-semibold">Default</th>
                    <th className="py-2 font-semibold">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  <tr>
                    <td className="py-2 pr-4 font-mono text-xs text-ink">cursor</td>
                    <td className="py-2 pr-4 font-mono text-xs">string</td>
                    <td className="py-2 pr-4 font-mono text-xs">&quot;Handy&quot;</td>
                    <td className="py-2">Cursor preset name from the catalog</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-mono text-xs text-ink">size</td>
                    <td className="py-2 pr-4 font-mono text-xs">number</td>
                    <td className="py-2 pr-4 font-mono text-xs">1.5</td>
                    <td className="py-2">Scale multiplier (1 = 32px base size)</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-mono text-xs text-ink">speed</td>
                    <td className="py-2 pr-4 font-mono text-xs">number</td>
                    <td className="py-2 pr-4 font-mono text-xs">1</td>
                    <td className="py-2">Lerp smoothing factor (1 = instant 1:1 hardware)</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-mono text-xs text-ink">color</td>
                    <td className="py-2 pr-4 font-mono text-xs">string</td>
                    <td className="py-2 pr-4 font-mono text-xs">&quot;&quot;</td>
                    <td className="py-2">Hex color override (empty string keeps natural SVG)</td>
                  </tr>
                </tbody>
              </table>
            </div>
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
            className="size-[38px] shrink-0 rounded-xl transition-transform hover:scale-105 [outline:0.8px_solid_#D4D4D4] [outline-offset:0.8px] cursor-pointer"
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
                    className={`size-7 rounded-lg transition-transform hover:scale-110 [outline:1px_solid_#00000014] cursor-pointer ${
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
            max="3"
            step="0.5"
            value={roughnessVal}
            onChange={(e) =>
              setRoughnessVal(
                Math.min(3, Math.max(0, Number(e.target.value) || 0)),
              )
            }
            aria-label="Cursor edge roughness"
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
            className="min-w-[72px] py-2 pr-1 pl-2 text-left font-sans text-[13px] leading-[160%] font-medium text-muted transition-colors hover:text-ink lg:min-w-[78px] lg:pr-2 lg:pl-3.5 cursor-pointer"
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
              className="flex items-center py-2 pr-2 pl-1 text-muted opacity-55 transition-opacity hover:opacity-100 lg:pr-3.5 cursor-pointer"
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
                  className="w-full rounded-lg px-3 py-2 text-left transition-colors hover:bg-surface cursor-pointer"
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
                  className="w-full rounded-lg px-3 py-2 text-left transition-colors hover:bg-surface cursor-pointer"
                >
                  <span className="block font-body text-[12px] font-medium text-ink">
                    Copy CDN script
                  </span>
                  <span className="mt-0.5 block font-body text-[11px] text-muted">
                    Plain HTML, Webflow, Shopify
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
