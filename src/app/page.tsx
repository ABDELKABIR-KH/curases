"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Check, ChevronDown, Copy, RotateCcw } from "lucide-react";
import { motion, useSpring, useTransform } from "framer-motion";
import GitHubIcon from "@/components/GitHubIcon";
import PreviewCard from "@/components/PreviewCard";

type CursorAssets = {
  name?: string;
  states: Record<string, string>;
  hotspots?: Record<string, [number, number]>;
};

const EMPTY_CURSOR_STATES: Record<string, string> = {};

type CursorEngine = NonNullable<Window["Curases"]>;

function getCursorEngine(): CursorEngine | undefined {
  if (typeof window === "undefined") return undefined;
  return (
    window.Curases ??
    (window as unknown as { CustomCursor?: CursorEngine }).CustomCursor
  );
}

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

// Dock color fan: natural ink, a full custom color wheel, and a scribble
// fill toggle that composes with the picked color (50/50 chip).
const COLOR_PRESETS = [
  { kind: "natural", name: "Natural / Black", hint: "Use natural ink" },
  { kind: "wheel", name: "Custom color", hint: "Pick any color" },
  { kind: "scribble", name: "Color + scribble", hint: "Toggle scribble fill" },
] as const;

type ColorPresetKind = (typeof COLOR_PRESETS)[number]["kind"];

function ChipFace({ kind, color }: { kind: ColorPresetKind; color: string }) {
  if (kind === "natural") {
    return (
      <span
        className="block size-full rounded-[inherit]"
        style={{ backgroundColor: "#000000" }}
      />
    );
  }

  if (kind === "wheel") {
    return (
      <span className="relative block size-full overflow-hidden rounded-[inherit] bg-white">
        <span
          className="absolute inset-0 rounded-[inherit]"
          style={{
            background:
              "conic-gradient(from -90deg, #ff5f5f, #ffc55f, #f8f860, #78d385, #62c8d8, #6f8dff, #b17df8, #f47fb1, #ff5f5f)",
          }}
        />
        <span
          className="absolute inset-[19%] rounded-full border border-black/10"
          style={{ backgroundColor: color || "#ffffff" }}
        />
      </span>
    );
  }

  // Scribble: half solid color, half hand-drawn hatch.
  return (
    <span className="relative block size-full overflow-hidden rounded-[inherit] bg-white">
      <span
        className="absolute inset-y-0 left-0 w-1/2"
        style={{ backgroundColor: color || "#050505" }}
      />
      <svg
        className="absolute inset-y-0 right-0 h-full w-1/2"
        viewBox="0 0 16 32"
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
      >
        <path
          d="M3.5 5.5L12.5 8M3.5 12L12.5 14.5M3.5 19L12.5 21.5M3.5 26L12.5 28.5"
          stroke={color || "#050505"}
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    </span>
  );
}

// The fan is one arc struck from the dock's top-left rounded corner:
// its center is the corner-radius center, its angle step is constant,
// and only the spring-driven radius changes.
const FAN_SWATCH = 27;
const DOCK_PADDING = 8;
const DOCK_CORNER_RADIUS = 16;
const FAN_ORIGIN = DOCK_CORNER_RADIUS - DOCK_PADDING;
const FAN_AIR = 13;
const FAN_RADIUS = DOCK_CORNER_RADIUS + FAN_AIR + FAN_SWATCH / 2;
const FAN_CENTER_ANGLE = 132;
const FAN_ARC = 124;
const COMPACT_FAN_RADIUS = 34;
const COMPACT_FAN_TOP = 4;
const COMPACT_ANGLE_STEP = 43;

function fanAngle(index: number, total: number, compact: boolean) {
  if (compact) {
    // Phone docks sit near the screen edge, so the origin moves up and
    // the radius shortens; the angular step stays constant.
    return 90 + COMPACT_ANGLE_STEP * ((total - 1) / 2 - index);
  }

  const step = total > 1 ? FAN_ARC / (total - 1) : 0;

  return FAN_CENTER_ANGLE + FAN_ARC / 2 - step * index;
}

function useMinWidth(query: string) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const update = () => setMatches(mql.matches);

    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, [query]);

  return matches;
}

function ArcSwatch({
  preset,
  color,
  index,
  total,
  open,
  compact,
  selected,
  onSelect,
}: {
  preset: (typeof COLOR_PRESETS)[number];
  color: string;
  index: number;
  total: number;
  open: boolean;
  compact: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const radius = compact ? COMPACT_FAN_RADIUS : FAN_RADIUS;
  const angle = (fanAngle(index, total, compact) * Math.PI) / 180;
  const progress = useSpring(0, { stiffness: 180, damping: 22, mass: 0.9 });

  useEffect(() => {
    progress.set(open ? 1 : 0);
  }, [open, progress]);

  const x = useTransform(progress, (value) => Math.cos(angle) * radius * value);
  const y = useTransform(progress, (value) => -Math.sin(angle) * radius * value);
  const scale = useTransform(progress, (value) => 0.35 + 0.65 * Math.min(value, 1));
  const opacity = useTransform(progress, (value) => Math.min(value, 1));

  return (
    <motion.div
      className="absolute top-0 left-0"
      style={{
        width: FAN_SWATCH,
        height: FAN_SWATCH,
        marginTop: -FAN_SWATCH / 2,
        marginLeft: -FAN_SWATCH / 2,
        x,
        y,
        scale,
        opacity,
        pointerEvents: open ? "auto" : "none",
        zIndex: selected ? total + 1 : total - index,
      }}
    >
      <button
        type="button"
        onClick={onSelect}
        tabIndex={open ? 0 : -1}
        title={preset.name}
        aria-label={preset.hint}
        aria-pressed={selected}
        className={`block size-full cursor-pointer overflow-hidden rounded-[8px] transition-transform duration-200 hover:scale-110 [outline:0.8px_solid_#D4D4D4] [outline-offset:0.8px] ${
          selected ? "[outline:2px_solid_#222222] [outline-offset:1px]" : ""
        }`}
      >
        <ChipFace kind={preset.kind} color={color} />
      </button>
    </motion.div>
  );
}

// ---------------------------------------------------------
// HSV color wheel popover (replaces the flat preset colors)
// ---------------------------------------------------------
function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec((hex || "").trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  const part = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v)))
      .toString(16)
      .padStart(2, "0");
  return `#${part(r)}${part(g)}${part(b)}`;
}

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  const rr = r / 255,
    gg = g / 255,
    bb = b / 255;
  const max = Math.max(rr, gg, bb),
    min = Math.min(rr, gg, bb);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rr) h = ((gg - bb) / d) % 6;
    else if (max === gg) h = (bb - rr) / d + 2;
    else h = (rr - gg) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, max === 0 ? 0 : d / max, max];
}

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const c = v * s;
  const hh = ((((h % 360) + 360) % 360) / 60) % 6;
  const x = c * (1 - Math.abs((hh % 2) - 1));
  let rgb: [number, number, number];
  if (hh < 1) rgb = [c, x, 0];
  else if (hh < 2) rgb = [x, c, 0];
  else if (hh < 3) rgb = [0, c, x];
  else if (hh < 4) rgb = [0, x, c];
  else if (hh < 5) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  const m = v - c;
  return [(rgb[0] + m) * 255, (rgb[1] + m) * 255, (rgb[2] + m) * 255];
}

const WHEEL_SIZE = 152;

function ColorWheelPopover({
  color,
  onChange,
}: {
  color: string;
  onChange: (hex: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wheelRef = useRef<HTMLDivElement | null>(null);

  const [hsv, setHsv] = useState<[number, number, number]>(() => {
    const rgb = hexToRgb(color) || [255, 255, 255];
    return rgbToHsv(rgb[0], rgb[1], rgb[2]);
  });
  const [hexDraft, setHexDraft] = useState(color || "#ffffff");

  // Paint the hue/saturation wheel once per mount.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const R = WHEEL_SIZE / 2;
    const img = ctx.createImageData(WHEEL_SIZE, WHEEL_SIZE);
    for (let y = 0; y < WHEEL_SIZE; y++) {
      for (let x = 0; x < WHEEL_SIZE; x++) {
        const dx = x + 0.5 - R;
        const dy = y + 0.5 - R;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > R) continue;
        const hue = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
        const sat = Math.min(1, dist / (R - 2));
        const [r, g, b] = hsvToRgb(hue, sat, 1);
        const i = (y * WHEEL_SIZE + x) * 4;
        img.data[i] = r;
        img.data[i + 1] = g;
        img.data[i + 2] = b;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }, []);

  const emit = (h: number, s: number, v: number) => {
    const [r, g, b] = hsvToRgb(h, s, v);
    const hex = rgbToHex(r, g, b);
    setHsv([h, s, v]);
    setHexDraft(hex);
    onChange(hex);
  };

  const pick = (clientX: number, clientY: number) => {
    const wheel = wheelRef.current;
    if (!wheel) return;
    const rect = wheel.getBoundingClientRect();
    const R = rect.width / 2;
    const x = clientX - rect.left - R;
    const y = clientY - rect.top - R;
    const dist = Math.min(Math.hypot(x, y), R - 3);
    const hue = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
    const sat = Math.min(1, dist / (R - 3));
    emit(hue, sat, hsv[2]);
  };

  const markerLeft = 50 + 46.5 * hsv[1] * Math.cos((hsv[0] * Math.PI) / 180);
  const markerTop = 50 + 46.5 * hsv[1] * Math.sin((hsv[0] * Math.PI) / 180);
  const dark = rgbToHex(...hsvToRgb(hsv[0], hsv[1], 0.06));
  const bright = rgbToHex(...hsvToRgb(hsv[0], hsv[1], 1));

  return (
    <div
      role="dialog"
      aria-label="Pick a custom cursor color"
      className="pointer-events-auto absolute bottom-[calc(100%+12px)] left-0 z-50 flex w-[196px] flex-col gap-3 rounded-2xl bg-surface p-3 [outline:0.8px_solid_#0000000A]"
    >
      <div
        ref={wheelRef}
        className="relative mx-auto touch-none select-none"
        style={{ width: WHEEL_SIZE, height: WHEEL_SIZE }}
      >
        <canvas
          ref={canvasRef}
          width={WHEEL_SIZE}
          height={WHEEL_SIZE}
          className="cursor-crosshair rounded-full shadow-[inset_0_0_0_0.8px_rgba(0,0,0,0.08)]"
          style={{ width: WHEEL_SIZE, height: WHEEL_SIZE }}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            pick(e.clientX, e.clientY);
          }}
          onPointerMove={(e) => {
            if (e.buttons !== 1) return;
            pick(e.clientX, e.clientY);
          }}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[2.5px] border-white [box-shadow:0_0_0_1.5px_rgba(0,0,0,0.35)]"
          style={{ left: `${markerLeft}%`, top: `${markerTop}%` }}
        />
      </div>

      <div className="flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className="size-[26px] shrink-0 rounded-lg [outline:0.8px_solid_#D4D4D4] [outline-offset:0.8px]"
          style={{ backgroundColor: color || "#ffffff" }}
        />
        <input
          type="range"
          min={25}
          max={100}
          value={Math.round(hsv[2] * 100)}
          onChange={(e) => emit(hsv[0], hsv[1], Number(e.target.value) / 100)}
          aria-label="Color brightness"
          className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full outline-none [&::-moz-range-thumb]:size-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-[#222222] [&::-webkit-slider-thumb]:size-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-[#222222] [&::-webkit-slider-thumb]:shadow"
          style={{ background: `linear-gradient(90deg, ${dark}, ${bright})` }}
        />
      </div>

      <div className="flex items-center gap-2">
        <label
          htmlFor="curases-hex"
          className="shrink-0 font-mono text-[11px] font-medium text-muted"
        >
          HEX
        </label>
        <input
          id="curases-hex"
          value={hexDraft}
          onChange={(e) => {
            const v = e.target.value;
            setHexDraft(v);
            const rgb = hexToRgb(v);
            if (rgb) {
              const [h, s, val] = rgbToHsv(rgb[0], rgb[1], rgb[2]);
              setHsv([h, s, val]);
              onChange(rgbToHex(rgb[0], rgb[1], rgb[2]));
            }
          }}
          spellCheck={false}
          autoComplete="off"
          className="w-full rounded-md bg-transparent px-1 py-0.5 font-mono text-[12px] text-ink outline-none focus:bg-black/[0.03]"
          placeholder="#1B4962"
        />
      </div>
    </div>
  );
}

function HandRule({ className = "" }: { className?: string }) {
  const filterId = `hand-rule-${useId().replace(/:/g, "")}`;

  return (
    <svg
      className={className}
      viewBox="0 0 400 6"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <filter id={filterId} x="-5%" y="-300%" width="110%" height="700%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.16 0.5"
            numOctaves="2"
            seed="4"
            result="ruleNoise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="ruleNoise"
            scale="4"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
      <g
        filter={`url(#${filterId})`}
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
      >
        <path d="M2 3.4H398" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        <path
          d="M8 3.9H392"
          strokeWidth="0.8"
          opacity="0.4"
          vectorEffect="non-scaling-stroke"
        />
      </g>
    </svg>
  );
}

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
      <HandRule className="h-[6px] flex-1 text-line" />
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
  const [cursorAssets, setCursorAssets] = useState<CursorAssets | null>(null);

  // Floating bar controls
  const [sizeVal, setSizeVal] = useState(1);
  const [speedVal, setSpeedVal] = useState(1);
  const [roughnessVal, setRoughnessVal] = useState(0.5);
  const [selectedColor, setSelectedColor] = useState("");
  const [scribbleOn, setScribbleOn] = useState(false);
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [isWheelOpen, setIsWheelOpen] = useState(false);
  const [isCopyMenuOpen, setIsCopyMenuOpen] = useState(false);
  const compactFan = !useMinWidth("(min-width: 1024px)");

  // Copy feedback
  const [copiedStep1, setCopiedStep1] = useState(false);
  const [copiedStep2, setCopiedStep2] = useState(false);
  const [copiedFloatingPrompt, setCopiedFloatingPrompt] = useState(false);

  const methodDropdownRef = useRef<HTMLDivElement>(null);
  const colorDropdownRef = useRef<HTMLDivElement>(null);
  const copyDropdownRef = useRef<HTMLDivElement>(null);

  const activeMethod = INSTALL_CONFIGS[selectedMethod];
  // Which chip sits on top of the collapsed stack: scribble mode wins so
  // both the mode and the picked color stay readable at a glance.
  const collapsedTopIndex = scribbleOn
    ? COLOR_PRESETS.findIndex((p) => p.kind === "scribble")
    : selectedColor === ""
      ? COLOR_PRESETS.findIndex((p) => p.kind === "natural")
      : COLOR_PRESETS.findIndex((p) => p.kind === "wheel");

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
        setIsWheelOpen(false);
      }
      if (
        copyDropdownRef.current &&
        !copyDropdownRef.current.contains(e.target as Node)
      ) {
        setIsCopyMenuOpen(false);
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsColorPickerOpen(false);
        setIsWheelOpen(false);
        setIsMethodMenuOpen(false);
        setIsCopyMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Cursor packs live behind an origin-checked API instead of the public bundle.
  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/cursors/handy.json", {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error(`Cursor request failed: ${response.status}`);
        return response.json() as Promise<CursorAssets>;
      })
      .then((data) => {
        if (data && typeof data.states === "object") {
          setCursorAssets(data);
        }
      })
      .catch(() => {
        // Keep the empty preview if the pack cannot be loaded.
      });

    return () => controller.abort();
  }, []);

  // Keep the live cursor engine in sync with the floating controls.
  useEffect(() => {
    const apply = () => {
      const engine = getCursorEngine();
      if (!engine) return false;

      engine.setSize(sizeVal);
      engine.setSpeed(speedVal);
      engine.setColor(selectedColor);
      if (typeof engine.setRoughness === "function") {
        engine.setRoughness(roughnessVal);
      }
      if (typeof engine.setFill === "function") {
        engine.setFill(scribbleOn ? "scribble" : "solid");
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
  }, [sizeVal, speedVal, selectedColor, roughnessVal, scribbleOn, activeCursorState]);

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
  const roughnessAttr = roughnessVal > 0 ? ` data-roughness="${roughnessVal.toFixed(1)}"` : "";
  const colorParam = selectedColor ? `, color "${selectedColor}"` : "";
  const colorAttr = selectedColor ? ` data-color="${selectedColor}"` : "";
  const fillParam = scribbleOn ? `, fill "scribble"` : "";
  const fillAttr = scribbleOn ? ` data-fill="scribble"` : "";

  const agentPrompt = `Install Curases, the custom cursor engine, with the "Handy" preset, size ${sizeVal.toFixed(1)}x, speed ${speedVal.toFixed(1)}${colorParam}${fillParam}${roughnessParam}. Docs: https://curases.com/llms.txt`;
  const scriptTag = `<script src="https://www.curases.com/engine.js" data-cursor="Handy" data-size="${sizeVal.toFixed(1)}" data-speed="${speedVal.toFixed(1)}"${colorAttr}${fillAttr}${roughnessAttr} defer></script>`;
  
  const handleStateClick = (stateId: string) => {
    setActiveCursorState(stateId);
    getCursorEngine()?.state(stateId);
  };

  const resetCursorSettings = () => {
    setSizeVal(1);
    setSpeedVal(1);
    setSelectedColor("");
    setScribbleOn(false);
    setRoughnessVal(0.5);
    setIsColorPickerOpen(false);
    setIsWheelOpen(false);
    handleStateClick("normal");
  };

  return (
    <div className="min-h-screen bg-white pb-32 font-sans text-ink sm:pb-36">
      <div className="mx-auto flex w-full max-w-[576px] flex-col gap-6 px-6 pt-[50px]">
        <header className="flex h-fit items-center justify-between gap-4">
          <nav className="flex items-center gap-4" aria-label="Primary">
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
          <div className="flex items-center gap-3">
            <span className="font-body text-[11px] leading-4 font-[450] text-[#00000033] underline decoration-dotted decoration-[#00000033] underline-offset-2">
              v0.2.0
            </span>
            <a
              href="https://github.com/ABDELKABIR-KH/curases"
              target="_blank"
              rel="noreferrer"
              aria-label="View Curases on GitHub"
              title="View Curases on GitHub"
              className="inline-flex size-3 shrink-0 items-center justify-center text-[#00000033] transition-colors hover:text-ink"
            >
              <GitHubIcon className="size-3" />
            </a>
          </div>
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
                cursorName={cursorAssets?.name ?? "Handy"}
                cursorStates={cursorAssets?.states ?? EMPTY_CURSOR_STATES}
                hotspots={cursorAssets?.hotspots}
                activeState={activeCursorState}
                onStateChange={handleStateClick}
                size={sizeVal}
                speed={speedVal}
                color={selectedColor}
                roughness={roughnessVal}
                scribble={scribbleOn}
                onReset={resetCursorSettings}
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

        <footer className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t-[0.8px] border-[#00000012] pt-5 pb-8">
          <span className="font-wordmark text-[13px] leading-[18px] font-semibold text-[#666666]">
            Curases
          </span>

          <span className="font-body text-[12px] leading-4 text-[#666666]">
            Made by{" "}
            <a
              href="https://github.com/ABDELKABIR-KH"
              target="_blank"
              rel="noreferrer"
              className="underline decoration-1 underline-offset-2 transition-colors hover:text-ink"
            >
              Abdelkabir
            </a>
          </span>
        </footer>
      </div>

      <aside
        aria-label="Cursor controls"
        className="fixed bottom-[21px] left-1/2 z-50 flex w-max max-w-[calc(100vw-24px)] -translate-x-1/2 items-center justify-center gap-[6px] rounded-2xl bg-surface px-2 py-2 [outline:0.8px_solid_#0000000A] lg:gap-[10px]"
      >
        <div
          className={`relative flex h-[42px] shrink-0 items-center justify-center transition-[width] duration-300 ${
            isColorPickerOpen ? "w-[38px]" : "w-[38px] lg:w-[62px]"
          }`}
          ref={colorDropdownRef}
        >
          <button
            type="button"
            onClick={() => {
              if (isWheelOpen) {
                setIsWheelOpen(false);
                return;
              }
              setIsColorPickerOpen((open) => !open);
            }}
            aria-expanded={isColorPickerOpen || isWheelOpen}
            aria-label={
              isColorPickerOpen || isWheelOpen
                ? "Close cursor color picker"
                : "Choose cursor color"
            }
            title="Choose cursor color"
            className={`relative h-[38px] shrink-0 cursor-pointer transition-[width] duration-300 ${
              isColorPickerOpen ? "w-[38px]" : "w-[38px] lg:w-[62px]"
            }`}
          >
            {COLOR_PRESETS.map((preset, index) => {
              const isActive = index === collapsedTopIndex;
              const chipStyle = {
                "--chip-left": isColorPickerOpen
                  ? "0px"
                  : `${index * 10}px`,
                zIndex: isActive
                  ? 40
                  : COLOR_PRESETS.length - Math.abs(index - collapsedTopIndex),
              } as CSSProperties;

              return (
                <span
                  key={preset.kind}
                  aria-hidden="true"
                  className={`absolute top-0 left-0 size-[38px] overflow-hidden rounded-xl ease-out [outline:0.8px_solid_#D4D4D4] [outline-offset:0.8px] transition-all duration-300 lg:left-[var(--chip-left)] ${
                    !isActive && !isColorPickerOpen ? "max-lg:hidden" : ""
                  } ${
                    isColorPickerOpen && !isActive
                      ? "scale-75 opacity-0"
                      : "scale-100 opacity-100"
                  }`}
                  style={chipStyle}
                >
                  <ChipFace kind={preset.kind} color={selectedColor} />
                </span>
              );
            })}
          </button>

          <div
            role="group"
            aria-label="Cursor color presets"
            aria-hidden={!isColorPickerOpen}
            className="pointer-events-none absolute z-50 size-0"
            style={{
              left: compactFan ? "auto" : FAN_ORIGIN,
              right: compactFan ? 0 : "auto",
              top: compactFan ? COMPACT_FAN_TOP : FAN_ORIGIN,
            }}
          >
            {COLOR_PRESETS.map((preset, index) => {
              const selected =
                preset.kind === "scribble"
                  ? scribbleOn
                  : preset.kind === "natural"
                    ? selectedColor === ""
                    : selectedColor !== "";

              return (
                <ArcSwatch
                  key={preset.kind}
                  preset={preset}
                  color={selectedColor}
                  index={index}
                  total={COLOR_PRESETS.length}
                  open={isColorPickerOpen}
                  compact={compactFan}
                  selected={selected}
                  onSelect={() => {
                    if (preset.kind === "wheel") {
                      setIsColorPickerOpen(false);
                      setIsWheelOpen(true);
                      return;
                    }
                    if (preset.kind === "scribble") {
                      setScribbleOn((on) => !on);
                    } else {
                      setSelectedColor("");
                    }
                    setIsColorPickerOpen(false);
                  }}
                />
              );
            })}
          </div>

          {isWheelOpen && (
            <ColorWheelPopover
              color={selectedColor}
              onChange={setSelectedColor}
            />
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

        <button
          type="button"
          onClick={resetCursorSettings}
          aria-label="Reset cursor settings"
          title="Reset cursor settings"
          className="hidden h-[38px] shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-control px-2 text-muted transition-colors [outline:0.8px_solid_#00000005] hover:text-ink sm:flex lg:gap-2 lg:px-3.5"
        >
          <RotateCcw className="size-[18px]" strokeWidth={1.5} />
          <span className="hidden font-sans text-[13px] leading-[160%] font-medium lg:inline">
            Reset
          </span>
        </button>

        <span className="h-[30px] w-px shrink-0 bg-line" />

        <div
          className="flex shrink-0 items-center rounded-xl bg-black [outline:0.8px_solid_#00000005]"
          ref={copyDropdownRef}
        >
          <button
            type="button"
            onClick={() =>
              copyToClipboard(agentPrompt, setCopiedFloatingPrompt)
            }
            className="min-w-[72px] rounded-l-xl py-2 pr-1 pl-2 text-left font-sans text-[13px] leading-[160%] font-medium text-white transition-colors hover:text-white/70 lg:min-w-[78px] lg:pr-2 lg:pl-3.5 cursor-pointer"
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
              className="flex items-center rounded-r-xl py-2 pr-2 pl-1 text-white opacity-55 transition-opacity hover:opacity-100 lg:pr-3.5 cursor-pointer"
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
