export interface CurasesEdgeDiveOptions {
  /**
   * Enable the predictive edge-dive / magnetic capture interaction.
   * @default true
   */
  enabled?: boolean;

  /**
   * Virtual dive horizon, in pixels, inset from every raw edge. The cursor
   * finishes collapsing to `scale = 0` here, before the pointer reaches the
   * actual DOM boundary.
   * @default 18
   */
  edgeBuffer?: number;

  /**
   * Outer prediction zone, in pixels from the raw edge. Inside this distance
   * the cursor begins subtle pitch and scale preparation once an exit is
   * projected.
   * @default 48
   */
  outerMargin?: number;

  /**
   * Inner magnetic capture well, in pixels from the raw edge. Inside this
   * distance a confident exit pulls the cursor toward the virtual horizon.
   * @default 32
   */
  magneticRadius?: number;

  /**
   * Multiplier for the ease-out lead curve. `0` disables the positional pull
   * while leaving the rotational anticipation intact.
   * @default 1
   */
  magneticStrength?: number;

  /**
   * Velocity toward an edge, in px/ms, needed for full exit confidence.
   * @default 0.35
   */
  exitThreshold?: number;

  /**
   * When the active bounds fill the viewport width, automatically suppress
   * left/right edge dives so the cursor doesn't fight the browser/OS edge.
   * Top and bottom remain active.
   * @default true
   */
  autoSuppressFlushSides?: boolean;

  /**
   * Per-edge enable mask. Combined with `autoSuppressFlushSides` (explicit
   * `false` on an edge disables it; auto-suppression may also disable
   * left/right when flush).
   */
  edges?: {
    top?: boolean;
    bottom?: boolean;
    left?: boolean;
    right?: boolean;
  };

  /**
   * Tactile wall-bump micro-interaction on suppressed left/right edges.
   * A fast impact produces a brief squash, shiver, and boil pulse.
   * @default true
   */
  wallBump?: boolean;

  /**
   * Multiplier for wall-bump squash, shiver, and boil intensity.
   * @default 1
   */
  wallBumpIntensity?: number;

  /**
   * Legacy alias for `outerMargin`. When `outerMargin` is omitted, a supplied
   * `margin` also becomes the outer prediction zone.
   * @default 28
   */
  margin?: number;

  /**
   * Lookahead projection time in milliseconds.
   * @default 42
   */
  lookahead?: number;

  /**
   * Optional container selector or element used as the active boundary.
   * When omitted the viewport (`window`) is used. Scoped containers are
   * clipped with `overflow: hidden` while the cursor is inside them.
   */
  scope?: string | HTMLElement | null;

  /**
   * Spring stiffness for the scale/pitch recovery solver.
   * @default 320
   */
  stiffness?: number;

  /**
   * Spring damping for the scale/pitch recovery solver.
   * @default 20
   */
  damping?: number;
}

export type CurasesEdgeDive = boolean | CurasesEdgeDiveOptions;

export interface CurasesOptions {
  /**
   * Cursor identifier or preset name (e.g. "Handy").
   * @default "Handy"
   */
  cursor?: string;

  /**
   * Size scaling factor (1 = 32px base size).
   * @default 1.5
   */
  size?: number;

  /**
   * Smooth movement lerp factor (1 = instant 1:1 hardware, lower = smooth fluid trailing).
   * @default 1
   */
  speed?: number;

  /**
   * Optional color override for cursor vectors (e.g. "#2563eb"). Empty string keeps natural SVG colors.
   * @default ""
   */
  color?: string;

  /**
   * Predictive edge-dive physics. Pass `false` to disable, or an object to
   * tune the trigger margin, lookahead, spring, and optional container scope.
   * @default true
   */
  edgeDive?: CurasesEdgeDive;

  /**
   * Whether to inject global CSS hiding the default system cursor.
   * @default true
   */
  hideNativeCursor?: boolean;

  /**
   * The CDN base URL serving the cursor engine and assets.
   * @default "https://www.curases.com"
   */
  cdnUrl?: string;
}

export interface CurasesInstance {
  setCursor: (id: string) => void;
  setSize: (size: number) => void;
  setSpeed: (speed: number) => void;
  setColor: (color: string) => void;
  setEdgeDive: (edgeDive: CurasesEdgeDive) => void;
  setVisibility: (visible: boolean) => void;
  destroy: () => void;
}

declare global {
  interface Window {
    __CURSOR_ASSET_BASE__?: string;
    __CURSOR_SETTINGS__?: {
      id?: string;
      size?: number;
      speed?: number;
      color?: string;
      edgeDive?: CurasesEdgeDive;
    };
    __customCursorEngineLoaded?: boolean;
    CustomCursor?: {
      load: (id: string) => void;
      speed: (speed: number) => void;
      size: (size: number) => void;
      color: (color: string) => void;
      edgeDive?: (edgeDive: CurasesEdgeDive) => void;
      state: (state: string) => void;
      visibility: (visible: boolean) => void;
      applySettings: (settings: { id?: string; size?: number; speed?: number; color?: string; edgeDive?: CurasesEdgeDive }) => void;
    };
  }
}

const DEFAULT_CDN = "https://www.curases.com";
const STYLE_ID = "curases-native-cursor-hide";
const ENGINE_SCRIPT_ID = "curases-remote-engine";

export function initCurases(options: CurasesOptions = {}): Promise<CurasesInstance> {
  // Safe no-op for Server-Side Rendering (Next.js, Remix, Astro)
  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.resolve({
      setCursor: () => {},
      setSize: () => {},
      setSpeed: () => {},
      setColor: () => {},
      setEdgeDive: () => {},
      setVisibility: () => {},
      destroy: () => {},
    });
  }

  const {
    cursor = "Handy",
    size = 1.5,
    speed = 1,
    color = "",
    edgeDive = true,
    hideNativeCursor = true,
    cdnUrl = DEFAULT_CDN,
  } = options;

  // 1. Manage native cursor visibility style
  if (hideNativeCursor && !document.getElementById(STYLE_ID)) {
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = "* { cursor: none !important; } html, body { cursor: none !important; }";
    document.head.appendChild(style);
  }

  // 2. Configure engine parameters on window
  window.__CURSOR_ASSET_BASE__ = cdnUrl;
  window.__CURSOR_SETTINGS__ = {
    id: cursor,
    size,
    speed,
    color,
    edgeDive,
  };

  // 3. If engine is already loaded on page, apply immediately
  if (window.CustomCursor) {
    window.CustomCursor.applySettings(window.__CURSOR_SETTINGS__);
    return Promise.resolve(createInstance());
  }

  // 4. Inject remote engine script if not already present
  return new Promise((resolve, reject) => {
    let script = document.getElementById(ENGINE_SCRIPT_ID) as HTMLScriptElement | null;

    if (!script) {
      script = document.createElement("script");
      script.id = ENGINE_SCRIPT_ID;
      script.src = `${cdnUrl.replace(/\/$/, "")}/engine.js`;
      script.async = true;
      script.crossOrigin = "anonymous";

      script.onload = () => resolve(createInstance());
      script.onerror = () => {
        reject(new Error(`[Curases] Failed to load cursor engine from ${script?.src}`));
      };

      document.head.appendChild(script);
    } else {
      // Script tag exists, wait for CustomCursor ready
      const checkInterval = setInterval(() => {
        if (window.CustomCursor) {
          clearInterval(checkInterval);
          window.CustomCursor.applySettings(window.__CURSOR_SETTINGS__!);
          resolve(createInstance());
        }
      }, 50);

      setTimeout(() => {
        clearInterval(checkInterval);
        resolve(createInstance());
      }, 3000);
    }
  });
}

export function destroyCurases(): void {
  if (typeof document === "undefined") return;

  const cursorEl = document.getElementById("custom-cursor");
  if (cursorEl) cursorEl.remove();

  const scopeLayer = document.getElementById("curases-scope-layer");
  if (scopeLayer) scopeLayer.remove();

  const styleEl = document.getElementById(STYLE_ID);
  if (styleEl) styleEl.remove();

  const engineScript = document.getElementById(ENGINE_SCRIPT_ID);
  if (engineScript) engineScript.remove();

  if (typeof window !== "undefined") {
    delete window.__customCursorEngineLoaded;
    delete window.CustomCursor;
  }
}

function createInstance(): CurasesInstance {
  return {
    setCursor: (id: string) => window.CustomCursor?.load(id),
    setSize: (size: number) => window.CustomCursor?.size(size),
    setSpeed: (speed: number) => window.CustomCursor?.speed(speed),
    setColor: (color: string) => window.CustomCursor?.color(color),
    setEdgeDive: (edgeDive: CurasesEdgeDive) => window.CustomCursor?.edgeDive?.(edgeDive),
    setVisibility: (visible: boolean) => window.CustomCursor?.visibility(visible),
    destroy: destroyCurases,
  };
}
