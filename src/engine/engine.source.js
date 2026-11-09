// ================================================================
//  Custom Cursor Engine (Size + Speed + Color)
// ================================================================
(function () {
  if (window.__customCursorEngineLoaded) return;
  window.__customCursorEngineLoaded = true;

  // ------------------------------------------
  // localStorage cache key & helpers
  // ------------------------------------------
  const STORAGE_KEY = "curases-cursor-config";

  function saveSettingsToCache(id, opts) {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          id: id || "Blue",
          speed: opts.speed,
          size: opts.size,
          color: opts.color || "",
          roughness: opts.roughness || 0,
          boil: opts.boil !== undefined ? opts.boil : 0.3,
          outline: opts.outline || 0,
          edgeDive: opts.edgeDive
            ? {
                enabled: opts.edgeDive.enabled !== false,
                edgeBuffer: opts.edgeDive.edgeBuffer,
                outerMargin: opts.edgeDive.outerMargin,
                magneticRadius: opts.edgeDive.magneticRadius,
                magneticStrength: opts.edgeDive.magneticStrength,
                exitThreshold: opts.edgeDive.exitThreshold,
                autoSuppressFlushSides: opts.edgeDive.autoSuppressFlushSides,
                edges: opts.edgeDive.edges
                  ? {
                      top: opts.edgeDive.edges.top,
                      bottom: opts.edgeDive.edges.bottom,
                      left: opts.edgeDive.edges.left,
                      right: opts.edgeDive.edges.right,
                    }
                  : undefined,
                wallBump: opts.edgeDive.wallBump,
                wallBumpIntensity: opts.edgeDive.wallBumpIntensity,
                margin: opts.edgeDive.margin,
                lookahead: opts.edgeDive.lookahead,
              }
            : undefined,
        })
      );
    } catch (_) { /* quota / private-mode */ }
  }

  function loadSettingsFromCache() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  // ------------------------------------------
  // BASE URL (from plugin injection OR fallback)
  // ------------------------------------------
  const BASE =
    window.__CURSOR_ASSET_BASE__ ||
    (document.currentScript
      ? new URL(document.currentScript.src).origin
      : "https://curases.com");

  // Cursor packs are public, CORS-enabled assets. Keep the canonical CDN as a
  // fallback so a self-hosted, proxied, or stale deployment still renders.
  const FALLBACK_BASE = "https://www.curases.com";
  const BASES = BASE === FALLBACK_BASE ? [BASE] : [BASE, FALLBACK_BASE];
  const ASSET_PATH = "/api/cursors";
  const ASSET_KEY =
    window.__CURSOR_ASSET_KEY__ ||
    (document.currentScript &&
      document.currentScript.getAttribute("data-key")) ||
    "";

  function assetHeaders() {
    return ASSET_KEY ? { "x-curases-key": ASSET_KEY } : {};
  }

  // ------------------------------------------
  // Options (speed + size only)
  // ------------------------------------------
  // Base size in px – must match the Figma export frame (32 × 32).
  const BASE_SIZE = 32;

  const options = {
    visible: true,
    speed: 1,
    size: 1, // unitless scale multiplier (1 = 32px base size)
    color: "", // empty = natural SVG colors; non-empty = override fill
    roughness: 0, // 0 = solid/crisp; 0-2 = hand-drawn sketch wobble
    boil: 0.3, // 0 = static sketch; 0-1 = frame-to-frame pen flicker
    outline: 0, // 0 = default Figma outline; 0.5 - 3 = outer stroke thickness
    // Predictive edge-dive + magnetic capture. `true` enables the defaults
    // below; pass an object to tune the zones, pull, or scope the boundary to
    // a container.
    edgeDive: {
      enabled: true,
      // The virtual dive horizon sits `edgeBuffer` px inside every raw edge.
      // The cursor finishes at scale 0 here, before the pointer reaches the
      // actual DOM boundary.
      edgeBuffer: 18,
      // Detection zones are measured from the raw edge so they straddle the
      // buffer: the outer zone starts 30px before the horizon, and the inner
      // well engages 14px before it.
      outerMargin: 48,
      magneticRadius: 32,
      magneticStrength: 1,
      exitThreshold: 0.35,
      // When the active bounds fill the viewport width, suppress left/right
      // dives so the cursor doesn't fight the OS/browser edge.
      autoSuppressFlushSides: true,
      edges: { top: true, bottom: true, left: true, right: true },
      // Tactile micro-interaction when hitting a suppressed side wall.
      wallBump: true,
      wallBumpIntensity: 1,
      // Legacy alias retained for backwards compatibility. When `outerMargin`
      // is omitted, a supplied `margin` also becomes the outer prediction zone.
      margin: 28,
      lookahead: 42,
      scope: null,
      stiffness: 320,
      damping: 20,
    },
  };

  // Multiplies procedural sketch amplitudes while the cursor submerges so the
  // jitter does not clip against the boundary. 1 = full sketch, 0 = calm.
  let renderDamp = 1;

  // Deferred until a pack renders so a failed fetch never leaves the page
  // without any cursor at all.
  let hideNativeRequested = true;

  function clampRoughness(value) {
    return Math.min(2, Math.max(0, parseFloat(value) || 0));
  }

  function clampBoil(value) {
    return Math.min(1, Math.max(0, parseFloat(value) || 0));
  }

  function clampNumber(value, min, max, fallback) {
    const parsed = parseFloat(value);
    if (!isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
  }

  /**
   * Merge an `edgeDive` config value with the current settings.
   * Accepted shapes: boolean, or { enabled, edgeBuffer, outerMargin,
   * magneticRadius, magneticStrength, exitThreshold, autoSuppressFlushSides,
   * edges, wallBump, wallBumpIntensity, margin, lookahead, scope, stiffness,
   * damping }.
   */
  function normalizeEdgeDive(value, base) {
    const baseEdges = base && base.edges ? base.edges : {};
    const next = {
      enabled: base ? base.enabled : true,
      edgeBuffer: base ? base.edgeBuffer : 18,
      outerMargin: base ? base.outerMargin : 48,
      magneticRadius: base ? base.magneticRadius : 32,
      magneticStrength: base ? base.magneticStrength : 1,
      exitThreshold: base ? base.exitThreshold : 0.35,
      autoSuppressFlushSides: base ? base.autoSuppressFlushSides !== false : true,
      edges: {
        top: baseEdges.top !== false,
        bottom: baseEdges.bottom !== false,
        left: baseEdges.left !== false,
        right: baseEdges.right !== false,
      },
      wallBump: base ? base.wallBump !== false : true,
      wallBumpIntensity: base ? base.wallBumpIntensity : 1,
      margin: base ? base.margin : 28,
      lookahead: base ? base.lookahead : 42,
      scope: base ? base.scope : null,
      stiffness: base ? base.stiffness : 320,
      damping: base ? base.damping : 20,
    };

    if (value === false) {
      next.enabled = false;
      return next;
    }

    if (value === undefined || value === null || value === true) {
      next.enabled = true;
      return next;
    }

    if (typeof value === "object") {
      if (value.enabled !== undefined) next.enabled = !!value.enabled;
      if (value.edgeBuffer !== undefined) {
        next.edgeBuffer = clampNumber(value.edgeBuffer, 0, 120, next.edgeBuffer);
      }
      if (value.outerMargin !== undefined) {
        next.outerMargin = clampNumber(value.outerMargin, 4, 240, next.outerMargin);
      } else if (value.margin !== undefined) {
        next.outerMargin = clampNumber(value.margin, 4, 240, next.outerMargin);
      }
      if (value.magneticRadius !== undefined) {
        next.magneticRadius = clampNumber(value.magneticRadius, 2, 120, next.magneticRadius);
      }
      if (value.magneticStrength !== undefined) {
        next.magneticStrength = clampNumber(value.magneticStrength, 0, 3, next.magneticStrength);
      }
      if (value.exitThreshold !== undefined) {
        next.exitThreshold = clampNumber(value.exitThreshold, 0.01, 5, next.exitThreshold);
      }
      if (value.autoSuppressFlushSides !== undefined) {
        next.autoSuppressFlushSides = !!value.autoSuppressFlushSides;
      }
      if (value.edges && typeof value.edges === "object") {
        if (value.edges.top !== undefined) next.edges.top = !!value.edges.top;
        if (value.edges.bottom !== undefined) next.edges.bottom = !!value.edges.bottom;
        if (value.edges.left !== undefined) next.edges.left = !!value.edges.left;
        if (value.edges.right !== undefined) next.edges.right = !!value.edges.right;
      }
      if (value.wallBump !== undefined) next.wallBump = !!value.wallBump;
      if (value.wallBumpIntensity !== undefined) {
        next.wallBumpIntensity = clampNumber(
          value.wallBumpIntensity,
          0,
          3,
          next.wallBumpIntensity
        );
      }
      if (value.margin !== undefined) next.margin = clampNumber(value.margin, 4, 240, next.margin);
      if (value.lookahead !== undefined) next.lookahead = clampNumber(value.lookahead, 0, 240, next.lookahead);
      if (value.scope !== undefined) next.scope = value.scope || null;
      if (value.stiffness !== undefined) next.stiffness = clampNumber(value.stiffness, 10, 2000, next.stiffness);
      if (value.damping !== undefined) next.damping = clampNumber(value.damping, 1, 200, next.damping);
    }

    // Keep the inner capture well nested inside the outer prediction zone.
    if (next.magneticRadius > next.outerMargin) {
      next.magneticRadius = next.outerMargin;
    }

    // The virtual horizon must sit inside the capture well (and the outer
    // zone) so the normalization band and lead curve stay well defined.
    if (next.edgeBuffer > next.magneticRadius) {
      next.edgeBuffer = next.magneticRadius;
    }
    if (next.edgeBuffer > next.outerMargin) {
      next.edgeBuffer = next.outerMargin;
    }

    return next;
  }

  function parseEdgeDiveAttribute(raw) {
    if (raw === null || raw === undefined) return undefined;

    const normalized = String(raw).trim().toLowerCase();
    if (!normalized || normalized === "true" || normalized === "1" || normalized === "on") {
      return true;
    }
    if (normalized === "false" || normalized === "0" || normalized === "off") {
      return false;
    }

    try {
      return JSON.parse(raw);
    } catch (_) {
      return true;
    }
  }

  // ------------------------------------------
  // Edge-dive state (velocity, bounds, springs)
  // ------------------------------------------
  const EDGE_DIVE_PITCH = 45; // maximum deg of 3D forward pitch
  const EDGE_DIVE_ROLL = 15; // maximum deg of Z-axis nose alignment
  const EDGE_DIVE_SUBMERGE = 4; // minimum outward offset in px
  const EDGE_DIVE_SUBMERGE_MAX = 6; // outward offset at full proximity
  const EDGE_DIVE_CAPTURE_M = 0.85; // magnetic proximity that arms hysteresis
  const EDGE_DIVE_LOCK_MS = 120; // anti-flicker hold at the boundary
  const EDGE_DIVE_REVERSE_V = -0.15; // px/ms inward velocity that releases lock
  const EDGE_DIVE_ENTRY_INWARD_V = 0.02; // px/ms inward travel that holds a re-entry
  const EDGE_NAMES = ["top", "bottom", "left", "right"];
  const EDGE_NORMALS = {
    top: [0, -1],
    bottom: [0, 1],
    left: [-1, 0],
    right: [1, 0],
  };
  // Positive rotateZ leans toward the corresponding outward normal.
  const EDGE_ROLL_SIGN = { top: 1, bottom: -1, left: -1, right: 1 };

  let bounds = { left: 0, top: 0, width: 0, height: 0 };
  let boundsRaf = 0;
  let scopeEl = null;
  let scopeLayer = null;
  let observedScope = null;
  let scopeObserver = null;
  let pointerInside = false;
  let hideTimer = 0;
  let lastEnterAt = 0;

  let velocityX = 0; // px / ms
  let velocityY = 0;
  let lastMoveAt = 0;
  let lastPointerLocalX = 0;
  let lastPointerLocalY = 0;
  let hasLastPointer = false;
  let lastClientX = 0;
  let lastClientY = 0;

  let diveActive = false;
  let diveP = 0;
  let magneticActive = false;
  let targetScale = 1;
  let targetRotX = 0;
  let targetRotY = 0;
  let targetRotZ = 0;
  let targetOffsetX = 0;
  let targetOffsetY = 0;

  // Rendered position after magnetic pull. Falls back to the smoothed pointer.
  let renderX = 0;
  let renderY = 0;

  const springScale = { value: 1, velocity: 0 };
  const springRotX = { value: 0, velocity: 0 };
  const springRotY = { value: 0, velocity: 0 };
  const springRotZ = { value: 0, velocity: 0 };

  // Per-edge hysteresis so a captured corner keeps both axes submerged.
  const edgeLocks = {
    top: { until: 0, locked: false },
    bottom: { until: 0, locked: false },
    left: { until: 0, locked: false },
    right: { until: 0, locked: false },
  };

  // Active re-entry hold. While set, the glyph stays submerged until the
  // pointer crosses inward past the virtual dive horizon.
  let entryHoldEdge = null;

  let lastRoughDamp = 1;
  let lastBumpQ = 0;

  // Per-edge activation mask (updated with bounds). Auto-suppression disables
  // left/right when the active bounds fill the viewport width.
  let edgeMask = { top: true, bottom: true, left: true, right: true };

  // Wall-bump micro-interaction on suppressed side edges.
  const WALL_BUMP_COOLDOWN_MS = 180;
  const WALL_BUMP_DURATION_MS = 140;
  const WALL_BUMP_FLICKER_MS = 120;
  const WALL_BUMP_OPACITY_MS = 60;
  let wallBumpStart = 0;
  let wallBumpI = 0;
  let wallBumpSide = null; // "left" | "right"
  let wallBumpCooldownUntil = 0;
  let wallBumpBoost = 0; // procedural boil/roughness amplitude multiplier offset
  let wallContact = { left: false, right: false };
  const wallBumpScaleX = { value: 1, velocity: 0 };
  const wallBumpScaleY = { value: 1, velocity: 0 };

  // ------------------------------------------
  // Create cursor DOM instantly (no waiting)
  // ------------------------------------------
  const cursor = document.createElement("div");
  cursor.id = "custom-cursor";
  Object.assign(cursor.style, {
    position: "fixed",
    left: "0px",
    top: "0px",
    width: BASE_SIZE + "px",
    height: BASE_SIZE + "px",
    pointerEvents: "none",
    zIndex: "2147483647",
    willChange: "transform",
    display: "none",
  });

  if (document.body) {
    document.body.appendChild(cursor);
  } else {
    window.addEventListener("DOMContentLoaded", () => {
      document.body.appendChild(cursor);
    });
  }

  let activeSet = null;
  let activeState = "normal";

  let x = 0,
    y = 0,
    tx = 0,
    ty = 0;
  let hasMousePosition = false; // Track if we've received a valid mouse position

  // ----------------------------------------------------
  // Modify SVG size (scaling only)
  // ----------------------------------------------------
  function scaleSVG(svg, size) {
    if (!svg) return svg;

    let updated = svg;

    const newSize = BASE_SIZE * size;

    // Update width/height in SVG markup
    updated = updated.replace(/width="(\d+)(.*?)"/, `width="${newSize}"`);
    updated = updated.replace(/height="(\d+)(.*?)"/, `height="${newSize}"`);

    return updated;
  }

  // ----------------------------------------------------
  // Get hotspot for the current state.
  // JSON format:  "hotspots": { "normal": [0, 0], "resize-h": [16, 16] }
  // Falls back to [0, 0] (top-left / arrow tip).
  // ----------------------------------------------------
  function getHotspot() {
    if (!activeSet) return [0, 0];
    const hs = activeSet.hotspots?.[activeState]
      || activeSet.hotspots?.default
      || [0, 0];
    // Scale the hotspot by the current size multiplier
    return [hs[0] * options.size, hs[1] * options.size];
  }

  // ----------------------------------------------------
  // Hand-drawn / sketchy path renderer
  //
  // Each cursor path is sampled into points, jittered with a seeded PRNG,
  // and rebuilt as a path. Three "boil" frames are generated around a
  // shared base sketch and cycled with pure CSS, so the cursor breathes
  // like a fresh pen doodle instead of sitting under a static SVG filter.
  // ----------------------------------------------------
  const BOIL_FRAMES = 3;
  const BOIL_DURATION = 1200;

  // Compact seeded PRNG (mulberry32) so every redraw of a state is stable.
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hashString(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  // Sample the rendered path (handles arcs / curves / all path commands).
  function samplePath(pathEl, step) {
    let length = 0;
    try {
      length = pathEl.getTotalLength();
    } catch (_) {
      return null;
    }
    if (!isFinite(length) || length <= 0) return null;

    const count = Math.max(2, Math.ceil(length / step));
    const points = [];
    for (let i = 0; i <= count; i++) {
      const p = pathEl.getPointAtLength((length * i) / count);
      points.push([p.x, p.y]);
    }
    return points;
  }

  // Independent per-sample jitter, seeded so every redraw is stable.
  function jitterPoints(points, rand, amp) {
    return points.map(([x, y]) => [
      x + (rand() * 2 - 1) * amp,
      y + (rand() * 2 - 1) * amp,
    ]);
  }

  // Quadratic midpoint smoothing keeps curves soft while preserving wobble.
  function pointsToPath(points, close) {
    const first = points[0];
    let d = `M${first[0].toFixed(2)} ${first[1].toFixed(2)}`;

    for (let i = 1; i < points.length - 1; i++) {
      const [cx, cy] = points[i];
      const [nx, ny] = points[i + 1];
      d += `Q${cx.toFixed(2)} ${cy.toFixed(2)} ${((cx + nx) / 2).toFixed(2)} ${((cy + ny) / 2).toFixed(2)}`;
    }

    const last = points[points.length - 1];
    d += `L${last[0].toFixed(2)} ${last[1].toFixed(2)}`;
    if (close) d += "Z";
    return d;
  }

  function ensureRoughStyle() {
    if (document.getElementById("curases-rough-style")) return;

    const style = document.createElement("style");
    style.id = "curases-rough-style";
    style.textContent = `
      @property --curases-frame {
        syntax: "<integer>";
        inherits: true;
        initial-value: 0;
      }
      #custom-cursor svg {
        --curases-frame: 0;
        overflow: visible;
        animation: curases-boil ${BOIL_DURATION}ms step-end infinite;
      }
      @keyframes curases-boil {
        0% { --curases-frame: 0; }
        33.33% { --curases-frame: 1; }
        66.67% { --curases-frame: 2; }
      }
      .curases-sketch-frame {
        --curases-i: 0;
        opacity: clamp(0, 1 - (var(--curases-frame) - var(--curases-i)) * (var(--curases-frame) - var(--curases-i)), 1);
      }
      .curases-sketch-frame[data-i="1"] { --curases-i: 1; }
      .curases-sketch-frame[data-i="2"] { --curases-i: 2; }
      @media (prefers-reduced-motion: reduce) {
        #custom-cursor svg { animation: none; }
        .curases-sketch-frame { opacity: 0; }
        .curases-sketch-frame[data-i="0"] { opacity: 1; }
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function applyRoughness(svgEl) {
    ensureRoughStyle();

    const paths = Array.from(svgEl.querySelectorAll("path"));
    if (!paths.length) return;

    // Roughness is expressed in viewBox units so it scales with the cursor.
    // During an edge dive both amplitudes are damped toward 0 so the sketch
    // doesn't clip against the boundary. A wall-bump briefly spikes them.
    const bumpMul = 1 + Math.max(0, wallBumpBoost);
    const effectiveDamp = renderDamp * bumpMul;
    const amp = Math.max(0, options.roughness) * 0.55 * effectiveDamp;
    const boilAmp = clampBoil(options.boil) * 0.5 * effectiveDamp;
    const frameCount = boilAmp > 0 ? BOIL_FRAMES : 1;

    // A static sketch (boil 0) must not run the frame animation, otherwise
    // frame 0 fades out when the counter advances to the missing frames.
    svgEl.style.animation = boilAmp > 0 ? "" : "none";

    paths.forEach((pathEl) => {
      const d = pathEl.getAttribute("d") || "";
      if (!d) return;

      const isClosed = /[zZ]\s*$/.test(d);
      const points = samplePath(pathEl, 1.8);
      if (!points || points.length < 2) return;

      const seed = hashString(d);
      const rand = mulberry32(seed);

      // One shared base sketch, micro-wobbled per boil frame.
      const basePoints = jitterPoints(points, rand, amp);
      const parent = pathEl.parentNode;

      for (let frame = 0; frame < frameCount; frame++) {
        const frameRand = mulberry32(seed + (frame + 1) * 7919);
        const framePoints =
          boilAmp > 0
            ? jitterPoints(basePoints, frameRand, boilAmp)
            : basePoints;
        const rough = pointsToPath(framePoints, isClosed);

        const clone = pathEl.cloneNode(false);
        clone.setAttribute("d", rough);
        clone.setAttribute("data-i", String(frame));
        clone.setAttribute(
          "class",
          `${pathEl.getAttribute("class") || ""} curases-sketch-frame`.trim()
        );

        parent.insertBefore(clone, pathEl);
      }

      parent.removeChild(pathEl);
    });
  }

  // ----------------------------------------------------
  // Update cursor SVG inside DOM
  // ----------------------------------------------------
  function updateCursor() {
    if (!activeSet) return;

    const raw =
      activeSet.states[activeState] ||
      activeSet.states.normal ||
      "";

    cursor.innerHTML = scaleSVG(raw, options.size);

    // Anchor the 3D dive to the pointer hotspot so the cursor tip submerges
    // first instead of the whole glyph shrinking toward its center.
    const [hotspotX, hotspotY] = getHotspot();
    cursor.style.transformOrigin = `${hotspotX}px ${hotspotY}px`;

    // Apply color override: only tint inner body (white fills), leaving black outline intact
    let colorStyle = cursor.querySelector("style[data-cursor-color]");
    if (options.color) {
      cursor.style.color = options.color;
      if (!colorStyle) {
        colorStyle = document.createElement("style");
        colorStyle.setAttribute("data-cursor-color", "true");
        cursor.appendChild(colorStyle);
      }
      colorStyle.textContent = `
        #custom-cursor svg path[fill="white"],
        #custom-cursor svg path[fill="#ffffff"],
        #custom-cursor svg path[fill="#fff"],
        #custom-cursor svg path.curases-sketch-frame[fill="white"],
        #custom-cursor svg path.curases-sketch-frame[fill="#ffffff"],
        #custom-cursor svg path.curases-sketch-frame[fill="#fff"] {
          fill: currentColor !important;
        }
      `;
    } else {
      cursor.style.color = "";
      if (colorStyle) colorStyle.remove();
    }

    // Apply outline thickness override via SVG paint-order stroke expansion
    let outlineStyle = cursor.querySelector("style[data-cursor-outline]");
    if (options.outline > 0) {
      if (!outlineStyle) {
        outlineStyle = document.createElement("style");
        outlineStyle.setAttribute("data-cursor-outline", "true");
        cursor.appendChild(outlineStyle);
      }
      outlineStyle.textContent = `
        #custom-cursor svg path[fill="black"],
        #custom-cursor svg path[fill="#000000"],
        #custom-cursor svg path[fill="#000"],
        #custom-cursor svg path[fill="#1E1E1E"],
        #custom-cursor svg path.curases-sketch-frame[fill="black"],
        #custom-cursor svg path.curases-sketch-frame[fill="#000000"],
        #custom-cursor svg path.curases-sketch-frame[fill="#000"],
        #custom-cursor svg path.curases-sketch-frame[fill="#1E1E1E"] {
          stroke: #000000 !important;
          stroke-width: ${options.outline}px !important;
          stroke-linejoin: round !important;
          stroke-linecap: round !important;
          paint-order: stroke fill !important;
        }
      `;
    } else {
      if (outlineStyle) outlineStyle.remove();
    }

    // Redraw every path as a hand-drawn sketch (with boil frames).
    const svgEl = cursor.querySelector("svg");
    if (svgEl && options.roughness > 0) {
      applyRoughness(svgEl);
    }
  }

  // ----------------------------------------------------
  // Load manifest JSON
  // ----------------------------------------------------
  async function fetchJson(url, headers) {
    const res = await fetch(url, {
      cache: "no-cache",
      credentials: "omit",
      headers: headers || {},
    });

    if (!res.ok) throw new Error("HTTP " + res.status + " for " + url);

    return res.json();
  }

  async function loadManifest() {
    let lastError = null;

    for (const base of BASES) {
      try {
        return await fetchJson(`${base}/cursors/manifest.json`);
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError || new Error("manifest fetch failed");
  }

  async function loadPack(entry) {
    let lastError = null;

    for (const base of BASES) {
      try {
        return await fetchJson(
          `${base}${ASSET_PATH}/${encodeURIComponent(entry.file)}`,
          assetHeaders()
        );
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError || new Error("cursor fetch failed");
  }

  // ----------------------------------------------------
  // Load cursor JSON by ID (case-insensitive with fallback)
  // ----------------------------------------------------
  async function loadCursorSet(id) {
    try {
      const manifest = await loadManifest();
      const targetId = String(id || "Handy").trim().toLowerCase();

      const entry =
        manifest.cursors.find((c) => c.id.toLowerCase() === targetId) ||
        manifest.cursors[0];

      if (!entry) throw new Error("manifest contains no cursors");

      const json = await loadPack(entry);

      if (!json || typeof json.states !== "object") {
        throw new Error("cursor pack is malformed");
      }

      activeSet = json;

      // Only hide the native cursor once we can actually replace it.
      if (hideNativeRequested) injectNativeHideCSS();

      updateCursor();

      // Only show cursor if we have a valid mouse position (avoid top-left flash)
      if (hasMousePosition && options.visible) {
        cursor.style.display = "block";
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);

      // Never leave the page cursor-less. If a pack was never rendered the
      // native cursor stays (or comes back) visible; if a previous pack is
      // still on screen, keep it hidden so the two cursors don't stack.
      if (!activeSet) restoreNativeCursor();

      try {
        console.warn(
          `[Curases] Could not load cursor "${id || "default"}": ${detail}`
        );
      } catch (_) { /* console unavailable */ }

      try {
        window.dispatchEvent(
          new CustomEvent("curases:error", {
            detail: { id: id || null, error: detail },
          })
        );
      } catch (_) { /* CustomEvent unavailable */ }
    }
  }

  // ----------------------------------------------------
  // Cached bounds + scoped canvas layer
  // ----------------------------------------------------
  function resolveScope(value) {
    if (!value) return null;
    if (typeof value === "string") {
      try {
        return document.querySelector(value);
      } catch (_) {
        return null;
      }
    }
    if (typeof value === "object" && value.nodeType === 1) return value;
    return null;
  }

  function ensureScopeLayer() {
    if (scopeLayer) return scopeLayer;

    scopeLayer = document.createElement("div");
    scopeLayer.id = "curases-scope-layer";
    Object.assign(scopeLayer.style, {
      position: "fixed",
      overflow: "hidden",
      pointerEvents: "none",
      zIndex: "2147483647",
      contain: "layout paint style",
    });
    (document.body || document.documentElement).appendChild(scopeLayer);
    return scopeLayer;
  }

  function mountScopeLayer(rect) {
    const layer = ensureScopeLayer();

    if (cursor.parentNode !== layer) {
      layer.appendChild(cursor);
      cursor.style.position = "absolute";
    }

    layer.style.left = rect.left + "px";
    layer.style.top = rect.top + "px";
    layer.style.width = rect.width + "px";
    layer.style.height = rect.height + "px";
  }

  function removeScopeLayer() {
    if (!scopeLayer) return;

    if (cursor.parentNode === scopeLayer) {
      (document.body || document.documentElement).appendChild(cursor);
      cursor.style.position = "fixed";
    }

    if (scopeLayer.parentNode) scopeLayer.parentNode.removeChild(scopeLayer);
    scopeLayer = null;
  }

  function attachScopeEvents(el) {
    if (!el || typeof el.addEventListener !== "function") return;
    el.addEventListener("pointerenter", handlePointerEnter, { passive: true });
    el.addEventListener("mouseenter", handlePointerEnter, { passive: true });
    el.addEventListener("pointerleave", scheduleHide, { passive: true });
    el.addEventListener("mouseleave", scheduleHide, { passive: true });
  }

  function detachScopeEvents(el) {
    if (!el || typeof el.removeEventListener !== "function") return;
    el.removeEventListener("pointerenter", handlePointerEnter);
    el.removeEventListener("mouseenter", handlePointerEnter);
    el.removeEventListener("pointerleave", scheduleHide);
    el.removeEventListener("mouseleave", scheduleHide);
  }

  function observeScope(el) {
    if (observedScope === el) return;

    if (scopeObserver) {
      scopeObserver.disconnect();
      scopeObserver = null;
    }

    observedScope = el;

    if (el && typeof ResizeObserver !== "undefined") {
      scopeObserver = new ResizeObserver(scheduleBoundsRefresh);
      scopeObserver.observe(el);
    }
  }

  function refreshEdgeMask() {
    const config = options.edgeDive || {};
    const explicit = config.edges || {};
    const viewportW =
      window.innerWidth || document.documentElement?.clientWidth || 0;

    const isLeftFlush = bounds.left <= 2;
    const boundsRight = bounds.left + bounds.width;
    const isRightFlush = Math.abs(viewportW - boundsRight) <= 2;
    const isFullWidth =
      bounds.width > 0 && isLeftFlush && isRightFlush;

    let left = explicit.left !== false;
    let right = explicit.right !== false;
    const top = explicit.top !== false;
    const bottom = explicit.bottom !== false;

    if (config.autoSuppressFlushSides !== false && isFullWidth) {
      left = false;
      right = false;
    }

    edgeMask = { top, bottom, left, right };

    // Release any capture state on newly suppressed edges.
    for (let i = 0; i < EDGE_NAMES.length; i++) {
      const edge = EDGE_NAMES[i];
      if (!edgeMask[edge] && edgeLocks[edge]) {
        edgeLocks[edge].locked = false;
        edgeLocks[edge].until = 0;
      }
    }
    if (entryHoldEdge && !edgeMask[entryHoldEdge]) {
      entryHoldEdge = null;
    }
  }

  // Bounds are cached here and only refreshed on resize/scroll/scope resize.
  // render() never reads layout, so there is no per-frame layout thrashing.
  function refreshBounds() {
    const nextScope = resolveScope(options.edgeDive.scope);
    const viewportW =
      window.innerWidth || document.documentElement?.clientWidth || 0;
    const viewportH =
      window.innerHeight || document.documentElement?.clientHeight || 0;

    if (nextScope) {
      const rect = nextScope.getBoundingClientRect();
      bounds = {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      };
      mountScopeLayer(rect);
    } else {
      bounds = { left: 0, top: 0, width: viewportW, height: viewportH };
      removeScopeLayer();
    }

    if (nextScope !== scopeEl) {
      detachScopeEvents(scopeEl);
      scopeEl = nextScope;
      attachScopeEvents(scopeEl);
    }

    observeScope(nextScope);
    refreshEdgeMask();

    if (hasMousePosition) {
      x = lastClientX - bounds.left;
      y = lastClientY - bounds.top;
    }
  }

  function scheduleBoundsRefresh() {
    if (boundsRaf) return;
    boundsRaf = requestAnimationFrame(() => {
      boundsRaf = 0;
      refreshBounds();
    });
  }

  // ----------------------------------------------------
  // Edge-dive prediction + spring solver
  // ----------------------------------------------------
  function clamp01(value) {
    return value < 0 ? 0 : value > 1 ? 1 : value;
  }

  function isInsideBounds(px, py) {
    return px >= 0 && px <= bounds.width && py >= 0 && py <= bounds.height;
  }

  function triggerWallBump(side, intensity, now) {
    const dir = side === "left" ? 1 : -1; // inward, away from wall
    const squashX = Math.max(0.5, 1 - 0.18 * intensity);
    const stretchY = Math.min(1.5, 1 + 0.12 * intensity);

    wallBumpStart = now;
    wallBumpI = intensity;
    wallBumpSide = side;
    wallBumpCooldownUntil = now + WALL_BUMP_COOLDOWN_MS;

    // Start compressed; spring back to rest with a crisp rebound.
    wallBumpScaleX.value = squashX;
    wallBumpScaleY.value = stretchY;
    wallBumpScaleX.velocity = 8 * intensity * dir * 0; // rebound handled by spring
    wallBumpScaleY.velocity = -4 * intensity;
  }

  function updateWallBump(now, dt) {
    const config = options.edgeDive;
    wallBumpBoost = 0;

    if (!config || !config.enabled || config.wallBump === false) {
      wallContact.left = false;
      wallContact.right = false;
      wallBumpSide = null;
      wallBumpScaleX.value = 1;
      wallBumpScaleX.velocity = 0;
      wallBumpScaleY.value = 1;
      wallBumpScaleY.velocity = 0;
      return;
    }

    if (!bounds.width || !bounds.height) return;

    const intensityMul = clampNumber(config.wallBumpIntensity, 0, 3, 1);
    const sides = [
      { edge: "left", inContact: x <= 2, toward: velocityX < 0 },
      { edge: "right", inContact: x >= bounds.width - 2, toward: velocityX > 0 },
    ];

    for (let i = 0; i < sides.length; i++) {
      const s = sides[i];
      const suppressed = !edgeMask[s.edge];
      const inContact = suppressed && s.inContact;

      if (inContact && !wallContact[s.edge] && s.toward && now >= wallBumpCooldownUntil) {
        const vImpact = Math.abs(velocityX);
        if (vImpact > 0.25) {
          const I = clampNumber((vImpact - 0.25) / 1.5, 0.2, 1) * intensityMul;
          triggerWallBump(s.edge, I, now);
        }
      }
      wallContact[s.edge] = inContact;
    }

    // Spring squash/stretch back to rest during/after the impulse.
    stepSpringWith(wallBumpScaleX, 1, dt, 520, 18);
    stepSpringWith(wallBumpScaleY, 1, dt, 520, 18);

    if (wallBumpSide) {
      const tSec = Math.max(0, (now - wallBumpStart) / 1000);
      const decay = Math.exp(-tSec * 28);
      wallBumpBoost = 1.5 * wallBumpI * decay;

      if (now - wallBumpStart > WALL_BUMP_DURATION_MS && decay < 0.02 &&
          Math.abs(wallBumpScaleX.value - 1) < 0.002 &&
          Math.abs(wallBumpScaleY.value - 1) < 0.002) {
        wallBumpSide = null;
        wallBumpI = 0;
        wallBumpBoost = 0;
      }
    }
  }

  function getWallBump(now) {
    if (!wallBumpSide) {
      return { offsetX: 0, tiltZ: 0, scaleX: wallBumpScaleX.value, scaleY: wallBumpScaleY.value, opacity: 1 };
    }

    const tMs = Math.max(0, now - wallBumpStart);
    const tSec = tMs / 1000;
    const decay = Math.exp(-tSec * 28);
    const I = wallBumpI;
    const inward = wallBumpSide === "left" ? 1 : -1;

    let offsetX = 0;
    let tiltZ = 0;
    if (tMs <= WALL_BUMP_FLICKER_MS) {
      // Inward-only shiver: never pushes the cursor outside the viewport.
      offsetX = Math.abs(Math.sin(tSec * 95)) * (3.5 * I) * decay * inward;
      tiltZ = Math.sin(tSec * 85) * (6 * I) * decay;
    }

    let opacity = 1;
    if (tMs <= WALL_BUMP_OPACITY_MS) {
      const pulse = 0.5 - 0.5 * Math.cos((tMs / WALL_BUMP_OPACITY_MS) * 4 * Math.PI);
      opacity = 1 - 0.28 * pulse;
    }

    return {
      offsetX,
      tiltZ,
      scaleX: wallBumpScaleX.value,
      scaleY: wallBumpScaleY.value,
      opacity,
    };
  }

  function nearestEdge(px, py) {
    const dTop = py;
    const dBottom = bounds.height - py;
    const dLeft = px;
    const dRight = bounds.width - px;

    let edge = "top";
    let distance = dTop;

    if (dBottom < distance) {
      edge = "bottom";
      distance = dBottom;
    }
    if (dLeft < distance) {
      edge = "left";
      distance = dLeft;
    }
    if (dRight < distance) {
      edge = "right";
      distance = dRight;
    }

    return { edge, distance };
  }

  function stepSpring(spring, target, dt) {
    const stiffness = options.edgeDive.stiffness;
    const damping = options.edgeDive.damping;
    stepSpringWith(spring, target, dt, stiffness, damping);
  }

  function stepSpringWith(spring, target, dt, stiffness, damping) {
    const force =
      -stiffness * (spring.value - target) - damping * spring.velocity;

    spring.velocity += force * dt;
    spring.value += spring.velocity * dt;

    if (
      Math.abs(spring.value - target) < 0.0005 &&
      Math.abs(spring.velocity) < 0.0005
    ) {
      spring.value = target;
      spring.velocity = 0;
    }
  }

  function edgeDistance(edge, px, py) {
    if (edge === "top") return py;
    if (edge === "bottom") return bounds.height - py;
    if (edge === "left") return px;
    return bounds.width - px;
  }

  function submergeOffset(m) {
    const eased = clamp01(m);
    return (
      (EDGE_DIVE_SUBMERGE +
        (EDGE_DIVE_SUBMERGE_MAX - EDGE_DIVE_SUBMERGE) * eased) *
      Math.min(1, eased * 8)
    );
  }

  function resetEdgeLocks() {
    for (let i = 0; i < EDGE_NAMES.length; i++) {
      const lock = edgeLocks[EDGE_NAMES[i]];
      lock.until = 0;
      lock.locked = false;
    }
  }

  function updateDive(now) {
    targetScale = 1;
    targetRotX = 0;
    targetRotY = 0;
    targetRotZ = 0;
    targetOffsetX = 0;
    targetOffsetY = 0;
    diveActive = false;
    diveP = 0;
    magneticActive = false;
    renderX = tx;
    renderY = ty;

    const config = options.edgeDive;
    if (!config.enabled || !hasMousePosition) return;
    if (!bounds.width || !bounds.height || !isInsideBounds(x, y)) return;

    const present = isFinite(now) ? now : lastFrameAt;
    const buffer = config.edgeBuffer;
    // Width of the lead band between the virtual horizon and the inner well.
    const band = Math.max(1, config.magneticRadius - buffer);
    const speed = Math.hypot(velocityX, velocityY);
    const predX = x + velocityX * config.lookahead;
    const predY = y + velocityY * config.lookahead;

    function horizonPos(edge) {
      if (edge === "top") return buffer;
      if (edge === "bottom") return bounds.height - buffer;
      if (edge === "left") return buffer;
      return bounds.width - buffer;
    }

    // Resolve a pending re-entry hold. Keep the glyph submerged while the
    // pointer is still crossing the outer buffer, then release once it crosses
    // inward past the virtual horizon with positive inward velocity.
    if (entryHoldEdge && !edgeMask[entryHoldEdge]) {
      entryHoldEdge = null;
    }
    if (entryHoldEdge) {
      const holdNormal = EDGE_NORMALS[entryHoldEdge];
      const inwardSpeed =
        -(velocityX * holdNormal[0] + velocityY * holdNormal[1]);
      const holdDistance = edgeDistance(entryHoldEdge, x, y);

      if (holdDistance >= buffer || inwardSpeed <= EDGE_DIVE_ENTRY_INWARD_V) {
        entryHoldEdge = null;
        // Seed the underdamped spring so the pop stays crisp even after the
        // cursor has been parked at scale 0 through the buffer.
        springScale.velocity = Math.max(
          springScale.velocity,
          Math.min(14, 4 + Math.max(0, inwardSpeed) * 8)
        );
      } else {
        targetScale = 0;
        targetRotX = 0;
        targetRotY = 0;
        targetRotZ = 0;
        targetOffsetX = 0;
        targetOffsetY = 0;
        diveActive = true;
        diveP = 1;
        renderX = tx;
        renderY = ty;
        return;
      }
    }

    let pitchXTarget = 0; // rotateX (top/bottom)
    let pitchYTarget = 0; // rotateY (left/right)
    let rollTarget = 0; // rotateZ nose alignment
    let prepScale = 1;
    let pullX = 0;
    let pullY = 0;
    const magneticEdges = [];

    for (let i = 0; i < EDGE_NAMES.length; i++) {
      const edge = EDGE_NAMES[i];
      if (!edgeMask[edge]) {
        if (edgeLocks[edge]) {
          edgeLocks[edge].locked = false;
          edgeLocks[edge].until = 0;
        }
        continue;
      }
      const rawDistance = edgeDistance(edge, x, y);
      if (rawDistance < 0) continue;

      const normal = EDGE_NORMALS[edge];
      const vNormal = velocityX * normal[0] + velocityY * normal[1];
      const alignment =
        speed > 1e-6 ? clamp01(vNormal / speed) : clamp01(vNormal * 1000);
      const confidence =
        clamp01(vNormal / config.exitThreshold) * alignment;

      const willCross =
        (edge === "top" && predY < 0) ||
        (edge === "bottom" && predY > bounds.height) ||
        (edge === "left" && predX < 0) ||
        (edge === "right" && predX > bounds.width);

      const lock = edgeLocks[edge];

      // Release a captured edge when the hold expires or the pointer clearly
      // reverses back into the canvas.
      if (lock.locked && (present > lock.until || vNormal < EDGE_DIVE_REVERSE_V)) {
        lock.locked = false;
      }

      // Effective distance to the virtual horizon. It goes negative when the
      // pointer has already crossed the horizon, but still sits inside the
      // real DOM boundary.
      const effectiveDist = rawDistance - buffer;
      const mRaw = clamp01(1 - effectiveDist / band);
      const outerProximity = clamp01(1 - rawDistance / config.outerMargin);

      // Outer-zone scale preparation applies continuously, even for edges
      // that are also inside the magnetic well, so crossing the well boundary
      // does not pop the scale back to 1.
      if (
        rawDistance < config.outerMargin &&
        confidence > 0.3 &&
        willCross
      ) {
        const prepIntensity = clamp01(outerProximity * confidence);
        prepScale = Math.min(prepScale, 1 - 0.25 * prepIntensity * prepIntensity);
      }

      // Arm the anti-flicker lock while fully inside the capture well.
      if (mRaw > EDGE_DIVE_CAPTURE_M && confidence > 0.45) {
        lock.locked = true;
        lock.until = present + EDGE_DIVE_LOCK_MS;
      }

      const magnetic =
        lock.locked ||
        (rawDistance < config.magneticRadius && confidence > 0.45);

      if (magnetic) {
        // Captured edges keep a strong pull even if the pointer trembles and
        // momentarily drops below the confidence gate.
        const m = lock.locked ? Math.max(mRaw, EDGE_DIVE_CAPTURE_M) : mRaw;
        const c = lock.locked ? Math.max(confidence, 0.45) : confidence;
        // Ease-out lead curve: the rendered cursor races ahead of the
        // pointer and settles on the virtual horizon.
        const leadFactor = 1 - Math.pow(1 - m, 3);
        const pull = clamp01(
          leadFactor * c * config.magneticStrength
        );
        const intensity = clamp01(Math.max(outerProximity, m));

        magneticActive = true;
        magneticEdges.push(edge);

        const offset = submergeOffset(m);
        targetOffsetX += normal[0] * offset;
        targetOffsetY += normal[1] * offset;

        if (edge === "top") {
          pitchXTarget = Math.max(pitchXTarget, EDGE_DIVE_PITCH * intensity);
        } else if (edge === "bottom") {
          pitchXTarget = Math.min(pitchXTarget, -EDGE_DIVE_PITCH * intensity);
        } else if (edge === "right") {
          pitchYTarget = Math.max(pitchYTarget, EDGE_DIVE_PITCH * intensity);
        } else {
          pitchYTarget = Math.min(pitchYTarget, -EDGE_DIVE_PITCH * intensity);
        }

        rollTarget +=
          EDGE_ROLL_SIGN[edge] * EDGE_DIVE_ROLL * intensity;

        if (pull > 0) {
          const target = horizonPos(edge);
          if (edge === "left" || edge === "right") {
            pullX += (target - tx) * pull;
          } else {
            pullY += (target - ty) * pull;
          }
        }
      } else if (
        rawDistance < config.outerMargin &&
        confidence > 0.3 &&
        willCross
      ) {
        // Outer prediction zone: subtle lean only. Scale preparation is
        // handled above so it stays continuous across the capture boundary.
        const intensity = clamp01(outerProximity * confidence);

        if (edge === "top") {
          pitchXTarget = Math.max(pitchXTarget, EDGE_DIVE_PITCH * intensity);
        } else if (edge === "bottom") {
          pitchXTarget = Math.min(pitchXTarget, -EDGE_DIVE_PITCH * intensity);
        } else if (edge === "right") {
          pitchYTarget = Math.max(pitchYTarget, EDGE_DIVE_PITCH * intensity);
        } else {
          pitchYTarget = Math.min(pitchYTarget, -EDGE_DIVE_PITCH * intensity);
        }

        rollTarget +=
          EDGE_ROLL_SIGN[edge] * EDGE_DIVE_ROLL * intensity;
      }
    }

    renderX = tx + pullX;
    renderY = ty + pullY;

    let scale = prepScale;

    if (magneticActive) {
      // Scale collapse follows the rendered distance to the virtual horizon,
      // so the glyph reaches scale 0 exactly at the dive line rather than the
      // raw DOM boundary.
      for (let i = 0; i < magneticEdges.length; i++) {
        const edge = magneticEdges[i];
        const renderedEffective = Math.max(
          0,
          edgeDistance(edge, renderX, renderY) - buffer
        );
        const mRender = clamp01(1 - renderedEffective / band);
        const edgeScale = 1 - Math.pow(mRender, 1.8);
        scale = Math.min(scale, edgeScale);
      }
    }

    targetScale = clamp01(scale);
    targetRotX = clampNumber(pitchXTarget, -EDGE_DIVE_PITCH, EDGE_DIVE_PITCH, 0);
    targetRotY = clampNumber(pitchYTarget, -EDGE_DIVE_PITCH, EDGE_DIVE_PITCH, 0);
    targetRotZ = clampNumber(rollTarget, -EDGE_DIVE_ROLL, EDGE_DIVE_ROLL, 0);

    diveActive = magneticActive || targetScale < 0.999;
    diveP = clamp01(1 - targetScale);
  }

  function updateSketchDamp() {
    const damp = diveActive ? clamp01(1 - diveP) : 1;
    const hasSketch = options.roughness > 0 || clampBoil(options.boil) > 0;

    if (!activeSet || !hasSketch) {
      renderDamp = damp;
      return;
    }

    // Rebuilding procedural paths is expensive, so dampen in four visual
    // steps rather than every frame.
    const quantized = Math.round(damp * 4) / 4;
    const bumpQ = Math.round(Math.min(2, Math.max(0, wallBumpBoost)) * 4) / 4;
    if (quantized !== lastRoughDamp || bumpQ !== lastBumpQ) {
      lastRoughDamp = quantized;
      lastBumpQ = bumpQ;
      renderDamp = quantized;
      updateCursor();
    } else {
      renderDamp = damp;
    }
  }

  function updateVelocity(px, py, now) {
    if (!hasLastPointer) {
      lastPointerLocalX = px;
      lastPointerLocalY = py;
      lastMoveAt = now;
      hasLastPointer = true;
      return;
    }

    let dt = now - lastMoveAt;
    const dx = px - lastPointerLocalX;
    const dy = py - lastPointerLocalY;

    lastPointerLocalX = px;
    lastPointerLocalY = py;
    lastMoveAt = now;

    if (!isFinite(dt) || dt <= 0) return;
    if (dt > 500) {
      velocityX = 0;
      velocityY = 0;
      return;
    }

    if (dt < 1) dt = 1;

    const rawVx = dx / dt;
    const rawVy = dy / dt;

    // Exponential moving average keeps the projection from jittering.
    velocityX += (rawVx - velocityX) * 0.4;
    velocityY += (rawVy - velocityY) * 0.4;
  }

  function decayVelocity(dt, now) {
    if (!lastMoveAt) return;
    if (now - lastMoveAt <= 24) return;

    const decay = Math.exp(-dt * 14);
    velocityX *= decay;
    velocityY *= decay;
  }

  function cancelHide() {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = 0;
    }
  }

  function scheduleHide() {
    pointerInside = false;
    cancelHide();
    hideTimer = setTimeout(() => {
      hideTimer = 0;
      cursor.style.display = "none";
    }, 140);
  }

  // Reverse dive: the cursor came back through a boundary. Start it small
  // and pitched into the edge, then let the spring pop it back to rest.
  function initializeEntry(e, now) {
    if (!options.edgeDive.enabled) return false;

    if (!bounds.width || !bounds.height) refreshBounds();
    if (!bounds.width || !bounds.height) return false;

    const clientX =
      e && typeof e.clientX === "number" ? e.clientX : lastClientX;
    const clientY =
      e && typeof e.clientY === "number" ? e.clientY : lastClientY;

    const localX = clientX - bounds.left;
    const localY = clientY - bounds.top;
    if (!isInsideBounds(localX, localY)) return false;

    // Decay stale velocity when the pointer has been outside for a while.
    if (lastMoveAt && now - lastMoveAt > 40) {
      const age = Math.min(1, (now - lastMoveAt) / 1000);
      const decay = Math.exp(-age * 12);
      velocityX *= decay;
      velocityY *= decay;
    }

    const entrySpeed = Math.hypot(velocityX, velocityY);
    const nearest = nearestEdge(localX, localY);

    // Spawn just outside the crossed boundary so the spring visibly "breaks
    // free" from the magnetic tension instead of appearing on top of the
    // pointer.
    const spawnOffset = EDGE_DIVE_SUBMERGE_MAX;
    let spawnX = localX;
    let spawnY = localY;
    if (nearest.edge === "top") spawnY = -spawnOffset;
    else if (nearest.edge === "bottom") spawnY = bounds.height + spawnOffset;
    else if (nearest.edge === "left") spawnX = -spawnOffset;
    else spawnX = bounds.width + spawnOffset;

    lastClientX = clientX;
    lastClientY = clientY;
    x = localX;
    y = localY;
    tx = spawnX;
    ty = spawnY;
    hasMousePosition = true;
    pointerInside = true;
    hasLastPointer = true;
    lastPointerLocalX = x;
    lastPointerLocalY = y;
    lastMoveAt = now;

    resetEdgeLocks();
    // Keep the glyph submerged until the pointer crosses the buffer inward.
    entryHoldEdge = nearest.edge;

    springScale.value = 0;
    // Outward magnetic impulse scales with entry speed. The target scale is
    // 1, so this accelerates the glyph out of the invisible spawn state.
    springScale.velocity = Math.min(12, entrySpeed * 4);

    springRotX.value =
      nearest.edge === "top"
        ? EDGE_DIVE_PITCH
        : nearest.edge === "bottom"
          ? -EDGE_DIVE_PITCH
          : 0;
    springRotY.value =
      nearest.edge === "right"
        ? EDGE_DIVE_PITCH
        : nearest.edge === "left"
          ? -EDGE_DIVE_PITCH
          : 0;
    springRotZ.value = 0;

    // Clear any residual velocity from a previous dive axis before
    // injecting this entry's kick.
    springRotX.velocity = 0;
    springRotY.velocity = 0;
    springRotZ.velocity = 0;

    // Inject entry speed toward the resting pose so fast entries overshoot
    // and pop, while slow entries ease back gently.
    const pitchKick = Math.min(360, entrySpeed * 180);
    if (springRotX.value !== 0) {
      springRotX.velocity = -Math.sign(springRotX.value) * pitchKick;
    }
    if (springRotY.value !== 0) {
      springRotY.velocity = -Math.sign(springRotY.value) * pitchKick;
    }

    renderX = tx;
    renderY = ty;
    renderDamp = 1;

    cancelHide();
    if (options.visible && activeSet) cursor.style.display = "block";
    return true;
  }

  function handlePointerEnter(e) {
    const now =
      e && typeof e.timeStamp === "number"
        ? e.timeStamp
        : typeof performance !== "undefined"
          ? performance.now()
          : Date.now();

    // document + scope listeners can both fire on the same entry.
    if (now - lastEnterAt < 90) return;
    lastEnterAt = now;

    initializeEntry(e || {}, now);
  }

  function handlePointerMove(e) {
    const now =
      e && typeof e.timeStamp === "number"
        ? e.timeStamp
        : typeof performance !== "undefined"
          ? performance.now()
          : Date.now();

    const clientX = e.clientX;
    const clientY = e.clientY;

    if (!bounds.width && !bounds.height) refreshBounds();

    const localX = clientX - bounds.left;
    const localY = clientY - bounds.top;
    const wasInside = pointerInside;
    const hadPosition = hasMousePosition;

    lastClientX = clientX;
    lastClientY = clientY;
    x = localX;
    y = localY;
    pointerInside = isInsideBounds(localX, localY);

    updateVelocity(localX, localY, now);
    cancelHide();

    // Check if cursor is over an interactive sandbox (e.g. preview frame)
    const target = e.target;
    const isOverSandbox = Boolean(
      target &&
        typeof target.closest === "function" &&
        target.closest("[data-curases-sandbox], .preview-window")
    );

    if (isOverSandbox) {
      cursor.style.display = "none";
      return;
    }

    // On first mouse move, immediately set position without animation
    if (!hadPosition) {
      hasMousePosition = true;
      tx = x;
      ty = y;
      hasLastPointer = true;
      lastPointerLocalX = x;
      lastPointerLocalY = y;
      lastMoveAt = now;
      const [hx, hy] = getHotspot();
      cursor.style.transform = `translate3d(${tx - hx}px, ${ty - hy}px, 0)`;
    } else if (!wasInside && pointerInside && now - lastEnterAt >= 90) {
      // Fallback for scoped canvases where pointerenter may have been
      // consumed by an ancestor before the scope was configured.
      lastEnterAt = now;
      initializeEntry(e, now);
    }

    if (options.visible && activeSet) cursor.style.display = "block";
  }

  // ----------------------------------------------------
  // Smooth movement + spring loop
  // ----------------------------------------------------
  let lastFrameAt = 0;

  function render(frameTime) {
    const now =
      typeof frameTime === "number"
        ? frameTime
        : typeof performance !== "undefined"
          ? performance.now()
          : Date.now();

    let dt = lastFrameAt ? (now - lastFrameAt) / 1000 : 1 / 60;
    lastFrameAt = now;

    if (!isFinite(dt) || dt <= 0) dt = 1 / 60;
    if (dt > 0.05) dt = 0.05;

    decayVelocity(dt, now);

    // Only update position if we have a valid mouse position
    if (hasMousePosition) {
      tx += (x - tx) * options.speed;
      ty += (y - ty) * options.speed;

      updateDive(now);

      // During magnetic capture the scale must track the rendered distance
      // exactly so the glyph reaches 0 on the virtual horizon, even on fast
      // flicks. Outside capture the underdamped spring handles recovery/pop.
      if (magneticActive) {
        springScale.value = targetScale;
        springScale.velocity = 0;
      } else {
        stepSpring(springScale, targetScale, dt);
      }
      stepSpring(springRotX, targetRotX, dt);
      stepSpring(springRotY, targetRotY, dt);
      stepSpring(springRotZ, targetRotZ, dt);

      updateWallBump(now, dt);
      const bump = getWallBump(now);

      const [hx, hy] = getHotspot();
      const baseX = renderX + bump.offsetX - hx;
      const baseY = renderY - hy;
      let transform = `translate3d(${baseX}px, ${baseY}px, 0)`;

      const scale = Math.max(0, springScale.value);
      const scaleX = Math.max(0, scale * bump.scaleX);
      const scaleY = Math.max(0, scale * bump.scaleY);
      const rotZ = springRotZ.value + bump.tiltZ;
      const hasTransform =
        scaleX !== 1 ||
        scaleY !== 1 ||
        springRotX.value !== 0 ||
        springRotY.value !== 0 ||
        rotZ !== 0 ||
        targetOffsetX !== 0 ||
        targetOffsetY !== 0;

      if (hasTransform) {
        const scaleStr =
          Math.abs(scaleX - scaleY) < 0.0001
            ? `scale(${scaleX.toFixed(4)})`
            : `scale(${scaleX.toFixed(4)}, ${scaleY.toFixed(4)})`;
        transform +=
          ` perspective(400px) rotateX(${springRotX.value.toFixed(3)}deg)` +
          ` rotateY(${springRotY.value.toFixed(3)}deg)` +
          ` rotateZ(${rotZ.toFixed(3)}deg)` +
          ` ${scaleStr}` +
          ` translate3d(${targetOffsetX.toFixed(2)}px, ${targetOffsetY.toFixed(2)}px, 0)`;
      }

      cursor.style.transform = transform;
      cursor.style.opacity = bump.opacity === 1 ? "" : String(bump.opacity);

      updateSketchDamp();
    } else {
      cursor.style.opacity = "";
    }

    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);

  // Track pointer. Prefer pointermove; fall back to mousemove in older
  // browsers (and in the DOM-stub test harness).
  const MOVE_EVENT =
    typeof window.PointerEvent !== "undefined" ? "pointermove" : "mousemove";

  window.addEventListener(MOVE_EVENT, handlePointerMove, { passive: true });

  // Re-entry / exit. The short hide delay lets the submerge animation read
  // before the custom cursor is removed at the viewport boundary.
  document.addEventListener("pointerenter", handlePointerEnter);
  document.addEventListener("mouseenter", handlePointerEnter);
  document.addEventListener("pointerleave", scheduleHide);
  document.addEventListener("mouseleave", scheduleHide);

  window.addEventListener("resize", scheduleBoundsRefresh, { passive: true });
  window.addEventListener("scroll", scheduleBoundsRefresh, {
    passive: true,
    capture: true,
  });
  document.addEventListener("fullscreenchange", scheduleBoundsRefresh);
  document.addEventListener("webkitfullscreenchange", scheduleBoundsRefresh);

  refreshBounds();

  // ----------------------------------------------------
  // AUTOMATIC STATE DETECTION
  // Detects cursor state based on element under cursor
  // ----------------------------------------------------
  let isMouseDown = false;
  let focusedInput = null;

  // Helper: Check if element is interactive (clickable)
  function isInteractive(el) {
    if (!el || el === document.body || el === document.documentElement) return false;

    const tag = el.tagName?.toLowerCase();
    const role = el.getAttribute?.("role");

    // Common interactive elements
    if (["a", "button", "select", "option"].includes(tag)) return true;
    if (tag === "input" && el.type !== "hidden") return true;
    if (tag === "textarea") return true;
    if (tag === "label" && el.htmlFor) return true;

    // ARIA roles
    if (["button", "link", "menuitem", "tab", "checkbox", "radio", "switch"].includes(role)) return true;

    // Elements with click handlers or tabindex
    if (el.onclick || el.getAttribute?.("tabindex") !== null) return true;

    // Check for pointer cursor in computed styles
    const style = window.getComputedStyle(el);
    if (style.cursor === "pointer") return true;

    return false;
  }

  // Helper: Check if element is a text input
  function isTextInput(el) {
    if (!el) return false;
    const tag = el.tagName?.toLowerCase();
    if (tag === "textarea") return true;
    if (tag === "input") {
      const type = el.type?.toLowerCase();
      return ["text", "password", "email", "search", "tel", "url", "number"].includes(type);
    }
    if (el.isContentEditable) return true;
    return false;
  }

  // Helper: Check if element is disabled
  function isDisabled(el) {
    if (!el) return false;
    if (el.disabled) return true;
    if (el.getAttribute?.("aria-disabled") === "true") return true;
    const style = window.getComputedStyle(el);
    if (style.pointerEvents === "none") return true;
    return false;
  }

  // Helper: Get cursor state from CSS cursor property
  function getCSSCursorState(el) {
    if (!el) return null;
    const style = window.getComputedStyle(el);
    const cssCursor = style.cursor;

    // Map CSS cursor values to our states
    const cursorMap = {
      "ew-resize": "resize-h",
      "col-resize": "resize-h",
      "ns-resize": "resize-v",
      "row-resize": "resize-v",
      "nwse-resize": "resize-h",
      "nesw-resize": "resize-h",
      "move": "move",
      "grab": "move",
      "grabbing": "drag",
      "not-allowed": "not-allowed",
      "no-drop": "not-allowed",
      "text": "typing",
      "vertical-text": "typing",
    };

    return cursorMap[cssCursor] || null;
  }

  // Determine the correct cursor state
  function detectState(e) {
    // If mouse is down, show click or drag state
    if (isMouseDown) {
      return activeSet?.states?.click ? "click" : "normal";
    }

    // If a text input is focused, show typing state
    if (focusedInput && isTextInput(focusedInput)) {
      return activeSet?.states?.typing ? "typing" : "normal";
    }

    const target =
      e?.target ||
      document.elementFromPoint(lastClientX || x, lastClientY || y);
    if (!target) return "normal";

    // Check if disabled
    if (isDisabled(target)) {
      return activeSet?.states?.["not-allowed"] ? "not-allowed" : "normal";
    }

    // Check CSS cursor for special states
    const cssState = getCSSCursorState(target);
    if (cssState && activeSet?.states?.[cssState]) {
      return cssState;
    }

    // Check if hovering over interactive element
    if (isInteractive(target)) {
      return activeSet?.states?.hover ? "hover" : "normal";
    }

    // Walk up the DOM tree to find interactive parents
    let parent = target.parentElement;
    while (parent && parent !== document.body) {
      if (isInteractive(parent)) {
        return activeSet?.states?.hover ? "hover" : "normal";
      }
      parent = parent.parentElement;
    }

    return "normal";
  }

  // Update state on mouse move
  function updateStateFromEvent(e) {
    const newState = detectState(e);
    if (newState !== activeState) {
      activeState = newState;
      updateCursor();
    }
  }

  // Mouse events for state detection
  window.addEventListener("mousemove", updateStateFromEvent, { passive: true });

  window.addEventListener("mousedown", () => {
    isMouseDown = true;
    activeState = activeSet?.states?.click ? "click" : "normal";
    updateCursor();
  }, { passive: true });

  window.addEventListener("mouseup", (e) => {
    isMouseDown = false;
    updateStateFromEvent(e);
  }, { passive: true });

  // Focus events for typing state
  document.addEventListener("focusin", (e) => {
    if (isTextInput(e.target)) {
      focusedInput = e.target;
      if (activeSet?.states?.typing) {
        activeState = "typing";
        updateCursor();
      }
    }
  }, { passive: true });

  document.addEventListener("focusout", (e) => {
    if (focusedInput === e.target) {
      focusedInput = null;
      activeState = "normal";
      updateCursor();
    }
  }, { passive: true });

  // ----------------------------------------------------
  // PUBLIC API & UNIVERSAL WEB BINDINGS
  // ----------------------------------------------------
  function injectNativeHideCSS() {
    if (document.getElementById("curases-hide-native")) return;
    const style = document.createElement("style");
    style.id = "curases-hide-native";
    style.textContent = "html, body, * { cursor: none !important; }";
    (document.head || document.documentElement).appendChild(style);
  }

  function restoreNativeCursor() {
    const style = document.getElementById("curases-hide-native");
    if (style) style.remove();
  }

  function configureEdgeDive(value) {
    options.edgeDive = normalizeEdgeDive(value, options.edgeDive);
    refreshEdgeMask();
    scheduleBoundsRefresh();
  }

  function getScriptDataset() {
    const s = document.currentScript;
    if (!s) return {};

    let edgeDive = parseEdgeDiveAttribute(s.getAttribute("data-edge-dive"));
    const margin = s.hasAttribute("data-edge-margin")
      ? parseFloat(s.getAttribute("data-edge-margin") || "")
      : undefined;
    const edgeBuffer = s.hasAttribute("data-edge-buffer")
      ? parseFloat(s.getAttribute("data-edge-buffer") || "")
      : undefined;
    const outerMargin = s.hasAttribute("data-edge-outer-margin")
      ? parseFloat(s.getAttribute("data-edge-outer-margin") || "")
      : undefined;
    const magneticRadius = s.hasAttribute("data-edge-magnetic-radius")
      ? parseFloat(s.getAttribute("data-edge-magnetic-radius") || "")
      : undefined;
    const magneticStrength = s.hasAttribute("data-edge-magnetic-strength")
      ? parseFloat(s.getAttribute("data-edge-magnetic-strength") || "")
      : undefined;
    const exitThreshold = s.hasAttribute("data-edge-exit-threshold")
      ? parseFloat(s.getAttribute("data-edge-exit-threshold") || "")
      : undefined;
    const lookahead = s.hasAttribute("data-edge-lookahead")
      ? parseFloat(s.getAttribute("data-edge-lookahead") || "")
      : undefined;
    const scope =
      s.getAttribute("data-edge-scope") || s.getAttribute("data-scope") || undefined;

    if (
      margin !== undefined ||
      edgeBuffer !== undefined ||
      outerMargin !== undefined ||
      magneticRadius !== undefined ||
      magneticStrength !== undefined ||
      exitThreshold !== undefined ||
      lookahead !== undefined ||
      scope !== undefined
    ) {
      const base =
        edgeDive && typeof edgeDive === "object"
          ? edgeDive
          : edgeDive === false
            ? { enabled: false }
            : {};
      edgeDive = { ...base };
      if (margin !== undefined && isFinite(margin)) edgeDive.margin = margin;
      if (edgeBuffer !== undefined && isFinite(edgeBuffer)) {
        edgeDive.edgeBuffer = edgeBuffer;
      }
      if (outerMargin !== undefined && isFinite(outerMargin)) {
        edgeDive.outerMargin = outerMargin;
      }
      if (magneticRadius !== undefined && isFinite(magneticRadius)) {
        edgeDive.magneticRadius = magneticRadius;
      }
      if (magneticStrength !== undefined && isFinite(magneticStrength)) {
        edgeDive.magneticStrength = magneticStrength;
      }
      if (exitThreshold !== undefined && isFinite(exitThreshold)) {
        edgeDive.exitThreshold = exitThreshold;
      }
      if (lookahead !== undefined && isFinite(lookahead)) {
        edgeDive.lookahead = lookahead;
      }
      if (scope !== undefined) edgeDive.scope = scope;
    }

    const dataset = {
      id: s.getAttribute("data-cursor") || s.getAttribute("data-id") || undefined,
      size: s.hasAttribute("data-size") ? parseFloat(s.getAttribute("data-size") || "1") : undefined,
      speed: s.hasAttribute("data-speed") ? parseFloat(s.getAttribute("data-speed") || "1") : undefined,
      color: s.getAttribute("data-color") || undefined,
      roughness: s.hasAttribute("data-roughness") ? parseFloat(s.getAttribute("data-roughness") || "0") : undefined,
      boil: s.hasAttribute("data-boil") ? parseFloat(s.getAttribute("data-boil") || "0.3") : undefined,
      outline: s.hasAttribute("data-outline") ? parseFloat(s.getAttribute("data-outline") || "0") : undefined,
      hideNative: s.getAttribute("data-hide-native") !== "false",
      edgeDive,
    };

    // Drop unset attributes so they don't overwrite injected/cached settings.
    Object.keys(dataset).forEach((key) => {
      if (dataset[key] === undefined) delete dataset[key];
    });

    return dataset;
  }

  const api = {
    init(config = {}) {
      if (config.speed !== undefined) options.speed = config.speed;
      if (config.size !== undefined) { options.size = config.size; updateCursor(); }
      if (config.color !== undefined) { options.color = config.color || ""; updateCursor(); }
      if (config.roughness !== undefined) { options.roughness = clampRoughness(config.roughness); updateCursor(); }
      if (config.boil !== undefined) { options.boil = clampBoil(config.boil); updateCursor(); }
      if (config.edgeDive !== undefined) configureEdgeDive(config.edgeDive);
      hideNativeRequested = config.hideNative !== false;
      if (!hideNativeRequested) restoreNativeCursor();
      const targetId = config.cursor || config.id;
      if (targetId) {
        loadCursorSet(targetId);
        saveSettingsToCache(targetId, options);
      }
    },
    load(id) {
      loadCursorSet(id);
      saveSettingsToCache(id, options);
    },
    setCursor(id) {
      this.load(id);
    },
    speed(v) {
      options.speed = v;
      saveSettingsToCache(null, options);
    },
    setSpeed(v) {
      this.speed(v);
    },
    size(v) {
      options.size = v;
      updateCursor();
      saveSettingsToCache(null, options);
    },
    setSize(v) {
      this.size(v);
    },
    color(v) {
      options.color = v || "";
      updateCursor();
      saveSettingsToCache(null, options);
    },
    setColor(v) {
      this.color(v);
    },
    roughness(v) {
      options.roughness = clampRoughness(v);
      updateCursor();
      saveSettingsToCache(null, options);
    },
    setRoughness(v) {
      this.roughness(v);
    },
    boil(v) {
      options.boil = clampBoil(v);
      updateCursor();
      saveSettingsToCache(null, options);
    },
    setBoil(v) {
      this.boil(v);
    },
    outline(v) {
      options.outline = Math.max(0, parseFloat(v) || 0);
      updateCursor();
      saveSettingsToCache(null, options);
    },
    setOutline(v) {
      this.outline(v);
    },
    edgeDive(v) {
      configureEdgeDive(v);
      saveSettingsToCache(null, options);
    },
    setEdgeDive(v) {
      this.edgeDive(v);
    },
    state(s) {
      activeState = s;
      updateCursor();
    },
    visibility(v) {
      options.visible = !!v;
      cursor.style.display = v && activeSet ? "block" : "none";
    },
    show() {
      this.visibility(true);
    },
    hide() {
      this.visibility(false);
    },
    /** Apply a full settings object and persist to cache */
    applySettings(settings) {
      if (!settings) return;
      if (settings.speed !== undefined) options.speed = settings.speed;
      if (settings.size !== undefined) { options.size = settings.size; updateCursor(); }
      if (settings.color !== undefined) { options.color = settings.color || ""; updateCursor(); }
      if (settings.roughness !== undefined) { options.roughness = clampRoughness(settings.roughness); updateCursor(); }
      if (settings.boil !== undefined) { options.boil = clampBoil(settings.boil); updateCursor(); }
      if (settings.outline !== undefined) { options.outline = Math.max(0, parseFloat(settings.outline) || 0); updateCursor(); }
      if (settings.edgeDive !== undefined) configureEdgeDive(settings.edgeDive);
      saveSettingsToCache(settings.id, options);
      if (settings.id) loadCursorSet(settings.id);
    },
  };

  window.Curases = api;
  window.CustomCursor = api;

  // ----------------------------------------------------
  // BOOTSTRAP INITIAL SETTINGS
  // ----------------------------------------------------
  function bootstrap() {
    const dataset = getScriptDataset();
    const injected = window.__CURSOR_SETTINGS__ || null;
    const cached = loadSettingsFromCache();

    // Priority: dataset (direct CDN attribute) > injected (Framer plugin) > cached > defaults
    const effective = {
      ...(cached || {}),
      ...(injected || {}),
      ...(dataset || {}),
    };

    // Hide the native cursor only after a pack has rendered. When the engine
    // is loaded as a plain script the default is to hide it; bundle users opt
    // in through Curases.init().
    if (Object.keys(dataset).length > 0) {
      hideNativeRequested = dataset.hideNative !== false;
    } else {
      hideNativeRequested = false;
    }

    if (!hideNativeRequested) restoreNativeCursor();

    if (effective.speed !== undefined) options.speed = effective.speed;
    if (effective.size !== undefined) options.size = effective.size;
    if (effective.color !== undefined) options.color = effective.color;
    if (effective.roughness !== undefined) options.roughness = clampRoughness(effective.roughness);
    if (effective.boil !== undefined) options.boil = clampBoil(effective.boil);
    if (effective.outline !== undefined) options.outline = Math.max(0, parseFloat(effective.outline) || 0);
    if (effective.edgeDive !== undefined) configureEdgeDive(effective.edgeDive);

    const initialId = effective.id || effective.cursor || "Blue";
    loadCursorSet(initialId);
  }

  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", bootstrap);
  } else {
    bootstrap();
  }

  // ----------------------------------------------------
  // Optional message listener (cross-window/iframe)
  // ----------------------------------------------------
  window.addEventListener(
    "message",
    (ev) => {
      const data = ev.data?.pluginMessage || ev.data;
      if (!data) return;

      if (data.type === "cursor-load") {
        if (data.id) loadCursorSet(data.id);
        if (data.options?.speed !== undefined)
          options.speed = data.options.speed;
      }
    },
    false
  );
})();
