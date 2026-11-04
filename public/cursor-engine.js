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

  console.log("cursor-engine: loaded");

  // ------------------------------------------
  // BASE URL (from plugin injection OR fallback)
  // ------------------------------------------
  const BASE =
    window.__CURSOR_ASSET_BASE__ ||
    (document.currentScript
      ? new URL(document.currentScript.src).origin
      : window.location.origin);

  console.log("cursor-engine: BASE =", BASE);

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
  };

  function clampRoughness(value) {
    return Math.min(2, Math.max(0, parseFloat(value) || 0));
  }

  function clampBoil(value) {
    return Math.min(1, Math.max(0, parseFloat(value) || 0));
  }

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
    const amp = Math.max(0, options.roughness) * 0.55;
    const boilAmp = clampBoil(options.boil) * 0.5;
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
  async function loadManifest() {
    const url = `${BASE}/cursors/manifest.json`;
    const res = await fetch(url, { cache: "no-cache" });

    if (!res.ok) throw new Error("manifest fetch failed: " + res.status);

    return res.json();
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

      if (!entry) {
        console.warn("cursor-engine: cursor not found:", id);
        return;
      }

      const jsonUrl = `${BASE}/cursors/${entry.file}`;
      const json = await fetch(jsonUrl, { cache: "no-cache" }).then((r) =>
        r.json()
      );

      activeSet = json;
      updateCursor();

      // Only show cursor if we have a valid mouse position (avoid top-left flash)
      if (hasMousePosition && options.visible) {
        cursor.style.display = "block";
      }

      console.log("cursor-engine: loaded cursor", entry.id);
    } catch (err) {
      console.error("cursor-engine:", err);
    }
  }

  // ----------------------------------------------------
  // Smooth movement loop
  // ----------------------------------------------------
  function render() {
    // Only update position if we have a valid mouse position
    if (hasMousePosition) {
      tx += (x - tx) * options.speed;
      ty += (y - ty) * options.speed;
      const [hx, hy] = getHotspot();
      cursor.style.transform = `translate3d(${tx - hx}px, ${ty - hy}px, 0)`;
    }
    requestAnimationFrame(render);
  }
  render();

  // Track mouse
  window.addEventListener(
    "mousemove",
    (e) => {
      x = e.clientX;
      y = e.clientY;

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
      if (!hasMousePosition) {
        hasMousePosition = true;
        tx = x;
        ty = y;
        const [hx, hy] = getHotspot();
        cursor.style.transform = `translate3d(${tx - hx}px, ${ty - hy}px, 0)`;
      }

      if (options.visible && activeSet) cursor.style.display = "block";
    },
    { passive: true }
  );

  document.addEventListener("mouseleave", () => {
    cursor.style.display = "none";
  });

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

    const target = e?.target || document.elementFromPoint(x, y);
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

  function getScriptDataset() {
    const s = document.currentScript;
    if (!s) return {};
    return {
      id: s.getAttribute("data-cursor") || s.getAttribute("data-id") || undefined,
      size: s.hasAttribute("data-size") ? parseFloat(s.getAttribute("data-size") || "1") : undefined,
      speed: s.hasAttribute("data-speed") ? parseFloat(s.getAttribute("data-speed") || "1") : undefined,
      color: s.getAttribute("data-color") || undefined,
      roughness: s.hasAttribute("data-roughness") ? parseFloat(s.getAttribute("data-roughness") || "0") : undefined,
      boil: s.hasAttribute("data-boil") ? parseFloat(s.getAttribute("data-boil") || "0.3") : undefined,
      outline: s.hasAttribute("data-outline") ? parseFloat(s.getAttribute("data-outline") || "0") : undefined,
      hideNative: s.getAttribute("data-hide-native") !== "false",
    };
  }

  const api = {
    init(config = {}) {
      if (config.speed !== undefined) options.speed = config.speed;
      if (config.size !== undefined) { options.size = config.size; updateCursor(); }
      if (config.color !== undefined) { options.color = config.color || ""; updateCursor(); }
      if (config.roughness !== undefined) { options.roughness = clampRoughness(config.roughness); updateCursor(); }
      if (config.boil !== undefined) { options.boil = clampBoil(config.boil); updateCursor(); }
      if (config.hideNative !== false) injectNativeHideCSS();
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

    if (dataset.hideNative) {
      injectNativeHideCSS();
    }

    if (effective.speed !== undefined) options.speed = effective.speed;
    if (effective.size !== undefined) options.size = effective.size;
    if (effective.color !== undefined) options.color = effective.color;
    if (effective.roughness !== undefined) options.roughness = clampRoughness(effective.roughness);
    if (effective.boil !== undefined) options.boil = clampBoil(effective.boil);
    if (effective.outline !== undefined) options.outline = Math.max(0, parseFloat(effective.outline) || 0);

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
