"use client";

import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useLayoutEffect,
  useMemo,
} from "react";
import useEmblaCarousel from "embla-carousel-react";
import { motion, useAnimationControls } from "framer-motion";
import { RotateCcw } from "lucide-react";
import "./PreviewCard.css";

const IDLE_EASE = [0.22, 1, 0.36, 1] as const;

export type CursorState = {
  name: string;
  icon: string;
};

interface PreviewCardProps {
  cursorName?: string;
  cursorStates: Record<string, string>;
  hotspots?: Record<string, [number, number]>;
  activeState: string;
  onStateChange: (state: string) => void;
  size?: number;
  speed?: number;
  color?: string;
  roughness?: number;
  boil?: number;
  outline?: number;
  scribble?: boolean;
  onReset?: () => void;
}

// PRNG for roughness jitter (mulberry32)
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function samplePath(pathEl: SVGPathElement, step = 1.8): [number, number][] | null {
  let length = 0;
  try {
    length = pathEl.getTotalLength();
  } catch {
    return null;
  }
  if (!isFinite(length) || length <= 0) return null;
  const count = Math.max(2, Math.ceil(length / step));
  const points: [number, number][] = [];
  for (let i = 0; i <= count; i++) {
    const p = pathEl.getPointAtLength((length * i) / count);
    points.push([p.x, p.y]);
  }
  return points;
}

function jitterPoints(
  points: [number, number][],
  rand: () => number,
  amp: number
): [number, number][] {
  return points.map(([x, y]) => [
    x + (rand() * 2 - 1) * amp,
    y + (rand() * 2 - 1) * amp,
  ]);
}

function pointsToPath(points: [number, number][], close: boolean): string {
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

function processRoughnessSvg(
  svgString: string,
  roughness: number,
  boil: number
): string {
  if (typeof window === "undefined" || !svgString || roughness <= 0) {
    return svgString;
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, "image/svg+xml");
    const svgEl = doc.querySelector("svg");
    if (!svgEl) return svgString;

    const paths = Array.from(svgEl.querySelectorAll("path"));
    if (!paths.length) return svgString;

    const amp = Math.max(0, roughness) * 0.55;
    const boilAmp = Math.min(1, Math.max(0, boil)) * 0.5;
    const frameCount = boilAmp > 0 ? 3 : 1;

    let tempContainer: HTMLDivElement | null = null;
    let tempSvg: SVGSVGElement | null = null;
    if (typeof document !== "undefined") {
      tempContainer = document.createElement("div");
      tempContainer.style.position = "absolute";
      tempContainer.style.visibility = "hidden";
      tempContainer.style.pointerEvents = "none";
      tempContainer.style.top = "-9999px";
      tempContainer.style.left = "-9999px";
      document.body.appendChild(tempContainer);
      tempContainer.innerHTML = svgString;
      tempSvg = tempContainer.querySelector("svg");
    }

    const tempPaths = tempSvg ? Array.from(tempSvg.querySelectorAll("path")) : null;

    paths.forEach((pathEl, idx) => {
      const d = pathEl.getAttribute("d") || "";
      if (!d) return;

      const isClosed = /[zZ]\s*$/.test(d);
      const measurePath = (tempPaths && tempPaths[idx]) || pathEl;
      const points = samplePath(measurePath as SVGPathElement, 1.8);
      if (!points || points.length < 2) return;

      const seed = hashString(d);
      const rand = mulberry32(seed);
      const basePoints = jitterPoints(points, rand, amp);
      const parent = pathEl.parentNode;
      if (!parent) return;

      for (let frame = 0; frame < frameCount; frame++) {
        const frameRand = mulberry32(seed + (frame + 1) * 7919);
        const framePoints =
          boilAmp > 0 ? jitterPoints(basePoints, frameRand, boilAmp) : basePoints;
        const rough = pointsToPath(framePoints, isClosed);

        const clone = pathEl.cloneNode(false) as SVGPathElement;
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

    if (tempContainer && tempContainer.parentNode) {
      tempContainer.parentNode.removeChild(tempContainer);
    }

    return new XMLSerializer().serializeToString(svgEl);
  } catch (err) {
    console.error("Error processing SVG roughness:", err);
    return svgString;
  }
}

// =========================================================
// Scribble fill (mirrors the engine's applyScribble)
//
// Replaces the solid body fill with one continuous zigzag pen
// stroke per glyph, clipped to the jittered outline. Strokes use
// currentColor so the container color tints them.
// =========================================================
const SCRIBBLE_BODY_FILLS = ["white", "#ffffff", "#fff", "#f8f8f8"];
const SCRIBBLE_CLIP_PREFIX = "curases-scribble-clip";
let scribbleClipSeq = 0;

function isScribbleBodyFill(pathEl: Element): boolean {
  const fill = (pathEl.getAttribute("fill") || "").toLowerCase();
  return SCRIBBLE_BODY_FILLS.includes(fill);
}

function buildScribbleStroke(
  bbox: { minX: number; minY: number; maxX: number; maxY: number },
  strokeWidth: number,
  rand: () => number,
  boilRand: () => number,
  boilAmp: number,
  amp: number
): string {
  const tilt = -0.32;
  const ux = Math.cos(tilt),
    uy = Math.sin(tilt);
  const vx = -Math.sin(tilt),
    vy = Math.cos(tilt);
  const cx = (bbox.minX + bbox.maxX) / 2;
  const cy = (bbox.minY + bbox.maxY) / 2;
  const w = bbox.maxX - bbox.minX;
  const h = bbox.maxY - bbox.minY;

  // Rotated rows must still cover the whole bbox, so sweep the
  // circumscribed square (clipped to the glyph anyway).
  const halfSpan = Math.sqrt(w * w + h * h) / 2 + strokeWidth * 2;
  const spacing = Math.max(strokeWidth * 1.75, 2.1);
  const step = Math.max(strokeWidth * 1.6, 2.2);

  const points: [number, number][] = [];
  let row = 0;
  for (let s = -halfSpan; s <= halfSpan + 0.01; s += spacing, row++) {
    const dir = row % 2 === 0 ? 1 : -1;
    const from = -halfSpan * dir;
    const to = halfSpan * dir;
    const count = Math.max(2, Math.ceil((halfSpan * 2) / step));
    for (let i = 0; i <= count; i++) {
      const t = from + ((to - from) * i) / count;
      points.push([cx + ux * t + vx * s, cy + uy * t + vy * s]);
    }
  }

  const base = jitterPoints(points, rand, amp);
  const framePoints = boilAmp > 0 ? jitterPoints(base, boilRand, boilAmp) : base;
  return pointsToPath(framePoints, false);
}

function processScribbleSvg(
  svgString: string,
  roughness: number,
  boil: number
): string {
  if (typeof window === "undefined" || !svgString) return svgString;

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, "image/svg+xml");
    const svgEl = doc.querySelector("svg");
    if (!svgEl) return svgString;

    const paths = Array.from(svgEl.querySelectorAll("path"));
    if (!paths.length) return svgString;

    const bodies = paths.filter(isScribbleBodyFill);
    if (!bodies.length) return svgString;

    // Offscreen measurement copy (same trick as the roughness pass).
    let tempContainer: HTMLDivElement | null = null;
    let tempSvg: SVGSVGElement | null = null;
    if (typeof document !== "undefined") {
      tempContainer = document.createElement("div");
      tempContainer.style.position = "absolute";
      tempContainer.style.visibility = "hidden";
      tempContainer.style.pointerEvents = "none";
      tempContainer.style.top = "-9999px";
      tempContainer.style.left = "-9999px";
      document.body.appendChild(tempContainer);
      tempContainer.innerHTML = svgString;
      tempSvg = tempContainer.querySelector("svg");
    }

    const amp = Math.max(0.3, Math.max(0, roughness) * 0.55);
    const boilAmp = Math.min(1, Math.max(0, boil)) * 0.5;
    const frameCount = boilAmp > 0 ? 3 : 1;

    // After the roughness pass each body path exists as one clone per
    // boil frame (carrying data-i); otherwise the static path stands in
    // for every frame.
    const sketched = bodies.some((p) => p.getAttribute("data-i") !== null);

    const svgNS = "http://www.w3.org/2000/svg";
    const mk = (tag: string) =>
      doc.createElementNS(svgNS, tag) as unknown as SVGElement;
    const defs = mk("defs");

    bodies.forEach((pathEl) => {
      const parent = pathEl.parentNode;
      if (!parent) return;

      const d = pathEl.getAttribute("d") || "";
      if (!d) return;

      const strokeWidth = Math.max(
        0.75,
        parseFloat(pathEl.getAttribute("stroke-width") || "") || 1.5
      );

      // Measure via the attached copy so sampling works.
      const idx = paths.indexOf(pathEl);
      const tempPaths = tempSvg
        ? Array.from(tempSvg.querySelectorAll("path"))
        : null;
      const measurePath =
        (tempPaths && tempPaths[idx]) || (pathEl as unknown as SVGPathElement);
      const points = samplePath(measurePath as SVGPathElement, 1.8);
      if (!points || points.length < 2) return;

      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      for (const [x, y] of points) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
      const pad = strokeWidth + 0.5;
      const bbox = {
        minX: minX - pad,
        minY: minY - pad,
        maxX: maxX + pad,
        maxY: maxY + pad,
      };

      const frames = sketched
        ? [
            {
              el: pathEl,
              frame: parseInt(pathEl.getAttribute("data-i") || "0", 10) || 0,
              d,
            },
          ]
        : Array.from({ length: frameCount }, (_, frame) => ({
            el: pathEl,
            frame,
            d,
          }));

      frames.forEach(({ el, frame, d: frameD }) => {
        const seed = hashString(frameD + "::scribble");
        const baseRand = mulberry32(seed);
        const frameRand = mulberry32(seed + (frame + 1) * 7919);
        const scribbleD = buildScribbleStroke(
          bbox,
          strokeWidth,
          baseRand,
          frameRand,
          boilAmp,
          amp
        );

        // Clip to this frame's outline so the fill follows the wobbly ink.
        const clipId = `${SCRIBBLE_CLIP_PREFIX}-${++scribbleClipSeq}`;
        const clip = mk("clipPath");
        clip.setAttribute("id", clipId);
        const clipShape = mk("path");
        clipShape.setAttribute("d", frameD);
        clip.appendChild(clipShape);
        defs.appendChild(clip);

        const g = mk("g");
        g.setAttribute("class", "curases-sketch-frame");
        g.setAttribute("data-i", String(frame));
        g.setAttribute("clip-path", `url(#${clipId})`);

        const scribble = mk("path");
        scribble.setAttribute("d", scribbleD);
        scribble.setAttribute("fill", "none");
        scribble.setAttribute("stroke", "currentColor");
        scribble.setAttribute("stroke-width", String(strokeWidth));
        scribble.setAttribute("stroke-linecap", "round");
        scribble.setAttribute("stroke-linejoin", "round");
        g.appendChild(scribble);

        parent.insertBefore(g, el);
      });

      // The solid body gives way to the scribble.
      pathEl.setAttribute("fill", "none");
    });

    if (tempContainer && tempContainer.parentNode) {
      tempContainer.parentNode.removeChild(tempContainer);
    }

    if (defs.children.length) svgEl.appendChild(defs);

    return new XMLSerializer().serializeToString(svgEl);
  } catch (err) {
    console.error("Error processing SVG scribble:", err);
    return svgString;
  }
}

// The same processed state string is injected into several containers
// (active window, idle window, 20 carousel clones), so clip-path ids
// are re-salted per site to keep every reference unique in the DOM.
function withUniqueClipIds(svg: string, salt: string): string {
  if (!svg.includes(SCRIBBLE_CLIP_PREFIX)) return svg;
  return svg.replace(
    new RegExp(`${SCRIBBLE_CLIP_PREFIX}-(\\d+)`, "g"),
    `${SCRIBBLE_CLIP_PREFIX}-$1-${salt}`
  );
}

export default function PreviewCard({
  cursorStates,
  hotspots,
  activeState,
  onStateChange,
  size = 1.25,
  speed = 1,
  color = "",
  roughness = 0,
  boil = 0,
  outline = 0,
  scribble = false,
  onReset,
}: PreviewCardProps) {
  const hasCustomColor = Boolean(color);

  // Scribble strokes are currentColor; without a tint they fall back to ink.
  const effectiveColor = scribble ? color || "#050505" : color;

  // Process all states in real time with roughness, boil, and scribble fill
  const processedStates = useMemo(() => {
    const result: Record<string, string> = {};
    for (const [key, svg] of Object.entries(cursorStates)) {
      let processed = svg;
      if (roughness > 0) processed = processRoughnessSvg(processed, roughness, boil);
      if (scribble) processed = processScribbleSvg(processed, roughness, boil);
      result[key] = processed;
    }
    return result;
  }, [cursorStates, roughness, boil, scribble]);

  // Setup original states
  const originalStates = useMemo(() => {
    return Object.entries(processedStates).map(([name, icon]) => ({
      name,
      icon,
    }));
  }, [processedStates]);

  // The 20-copy infinite clone secret (fills the screen completely, 0 gaps)
  const slides = useMemo(() => {
    if (originalStates.length === 0) return [];
    return new Array(20).fill(originalStates).flat();
  }, [originalStates]);

  const [tooltip, setTooltip] = useState<{
    text: string;
    x: number;
    y: number;
  } | null>(null);

  // Track the centered snap so only one clone of a repeated state is marked
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  // Idle demo: when the pointer leaves the sandbox, the cursor runs its own
  // loop and browses the carousel until the user comes back.
  const [isIdle, setIsIdle] = useState(false);
  const [idleStateName, setIdleStateName] = useState("normal");
  const idleControls = useAnimationControls();
  const idlePosRef = useRef({ x: 0, y: 0 });
  const idleWasActiveRef = useRef(false);
  const processedStatesRef = useRef<Record<string, string>>({});

  // Embla Engine with centered alignment and infinite loop
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: true,
    align: "center",
    containScroll: false,
    dragFree: false, // Snaps to center
    startIndex: slides.length > 0 ? Math.floor(slides.length / 2) : 0,
  });

  // Sync state on carousel drag/scroll
  const onSelect = useCallback(() => {
    if (!emblaApi || slides.length === 0) return;
    const index = emblaApi.selectedScrollSnap();
    setSelectedIndex(index);
    const selectedSlide = slides[index];
    if (selectedSlide && selectedSlide.name !== activeState) {
      onStateChange(selectedSlide.name);
    }
  }, [emblaApi, slides, activeState, onStateChange]);

  // Embla initializes before the slides exist, so `startIndex` is ignored.
  // Centre the strip on the middle clone of the active state once on mount.
  const hasCentered = useRef(false);
  useEffect(() => {
    if (!emblaApi || slides.length === 0 || hasCentered.current) return;
    hasCentered.current = true;

    const middle = Math.floor(slides.length / 2);
    let target = -1;
    let best = Infinity;
    slides.forEach((slide, idx) => {
      if (slide.name !== activeState) return;
      const distance = Math.abs(idx - middle);
      if (distance < best) {
        best = distance;
        target = idx;
      }
    });

    if (target !== -1) {
      emblaApi.scrollTo(target, true);
      setSelectedIndex(target);
    }
  }, [emblaApi, slides, activeState]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
      emblaApi.off("reInit", onSelect);
    };
  }, [emblaApi, onSelect]);

  // When activeState changes externally, scroll to the nearest matching clone
  useEffect(() => {
    if (!emblaApi || slides.length === 0) return;
    const currentIndex = emblaApi.selectedScrollSnap();
    if (slides[currentIndex]?.name === activeState) return;

    let bestIndex = -1;
    let minDistance = Infinity;

    slides.forEach((slide, idx) => {
      if (slide.name === activeState) {
        const dist = Math.abs(idx - currentIndex);
        if (dist < minDistance) {
          minDistance = dist;
          bestIndex = idx;
        }
      }
    });

    if (bestIndex !== -1) {
      emblaApi.scrollTo(bestIndex);
      setSelectedIndex(bestIndex);
    }
  }, [emblaApi, slides, activeState]);

  const handleCardClick = useCallback(
    (index: number) => {
      if (emblaApi) emblaApi.scrollTo(index);
    },
    [emblaApi]
  );

  // Mini cursor tracking & physics inside the frame
  const previewRef = useRef<HTMLDivElement | null>(null);
  const mouseX = useRef(0);
  const mouseY = useRef(0);
  const smoothX = useRef(0);
  const smoothY = useRef(0);
  const requestRef = useRef<number>(0);

  const getHotspotFor = useCallback(
    (stateName: string): [number, number] => {
      const hs = hotspots?.[stateName] || hotspots?.default || [0, 0];
      return [hs[0] * size, hs[1] * size];
    },
    [hotspots, size],
  );

  const getHotspot = useCallback(
    (): [number, number] => getHotspotFor(activeState),
    [getHotspotFor, activeState],
  );

  useLayoutEffect(() => {
    if (previewRef.current) {
      const rect = previewRef.current.getBoundingClientRect();
      mouseX.current = rect.width / 2;
      mouseY.current = rect.height / 2;
      smoothX.current = rect.width / 2;
      smoothY.current = rect.height / 2;
    }
  }, [cursorStates, size]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = previewRef.current?.getBoundingClientRect();
    if (!rect) return;
    mouseX.current = e.clientX - rect.left;
    mouseY.current = e.clientY - rect.top;
  };

  const handleMouseEnter = () => {
    setIsIdle(false);
    // Hide outside global engine cursor when entering the sandbox
    window.Curases?.hide();
  };

  const handleLeave = () => {
    setTooltip(null);
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!reduceMotion) setIsIdle(true);
    // Restore outside global engine cursor when leaving the sandbox
    window.Curases?.show();
  };

  useEffect(() => {
    return () => {
      window.Curases?.show();
    };
  }, []);

  useEffect(() => {
    const animate = () => {
      smoothX.current += (mouseX.current - smoothX.current) * speed;
      smoothY.current += (mouseY.current - smoothY.current) * speed;
      const box = previewRef.current;
      if (box) {
        const cursorEl = box.querySelector(
          ".preview-mini-cursor"
        ) as HTMLElement | null;
        if (cursorEl) {
          const [hx, hy] = getHotspot();
          cursorEl.style.transform = `translate3d(${smoothX.current - hx}px, ${smoothY.current - hy}px, 0) scale(${size})`;
        }
      }
      requestRef.current = requestAnimationFrame(animate);
    };
    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, [speed, size, getHotspot]);

  useEffect(() => {
    processedStatesRef.current = processedStates;
  }, [processedStates]);

  // Let the demo play on its own when the pointer is not on the card, so the
  // cursor is alive on first load even before the user hovers the sandbox.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.matchMedia?.("(hover: hover) and (pointer: fine)").matches) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const el = previewRef.current;
    if (!el) return;

    const timer = window.setTimeout(() => {
      if (!el.matches(":hover")) setIsIdle(true);
    }, 1400);

    return () => window.clearTimeout(timer);
  }, []);

  // Hand the cursor back to the pointer when the demo ends.
  useEffect(() => {
    if (idleWasActiveRef.current && !isIdle) {
      const [hx, hy] = getHotspotFor(activeState);
      smoothX.current = idlePosRef.current.x + hx;
      smoothY.current = idlePosRef.current.y + hy;
      idleWasActiveRef.current = false;
    }
    if (isIdle) idleWasActiveRef.current = true;
  }, [isIdle, activeState, getHotspotFor]);

  // Simple idle motion
  useLayoutEffect(() => {
    if (!isIdle || typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    let cancelled = false;
    const wait = (ms: number) =>
      new Promise<void>((resolve) => window.setTimeout(resolve, ms));

    const run = async () => {
      const states = processedStatesRef.current;
      const restState = states.hover ? "hover" : activeState;

      const [shx, shy] = getHotspotFor(activeState);
      idlePosRef.current = {
        x: smoothX.current - shx,
        y: smoothY.current - shy,
      };
      idleControls.set({
        x: idlePosRef.current.x,
        y: idlePosRef.current.y,
        scale: size,
        opacity: 1,
      });
      setIdleStateName(restState);

      await wait(300);

      while (!cancelled) {
        const box = previewRef.current?.getBoundingClientRect();
        if (!box) break;

        const x = box.width * 0.3 + Math.random() * (box.width * 0.4);
        const y = 60 + Math.random() * (box.height * 0.3);

        const [hx, hy] = getHotspotFor(restState);
        idlePosRef.current = { x: x - hx, y: y - hy };
        await idleControls.start({
          x: idlePosRef.current.x,
          y: idlePosRef.current.y,
          transition: { duration: 1.5, ease: IDLE_EASE },
        });
        await wait(1000);
      }
    };

    run();

    return () => {
      cancelled = true;
      idleControls.stop();
    };
  }, [isIdle, activeState, size, getHotspotFor, idleControls]);

  // Active SVG with live roughness and boil applied
  const renderedActiveSvg =
    processedStates[activeState] || processedStates.normal || "";
  const renderedIdleSvg =
    processedStates[idleStateName] || renderedActiveSvg;

  return (
    <div
      className={`preview-window${boil <= 0 ? " boil-off" : ""}${
        isIdle ? " is-idle" : ""
      }`}
      data-curases-sandbox="true"
      ref={previewRef}
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleLeave}
    >
      {/* Torn-paper sandbox sheet that fades into the white page */}
      <svg className="preview-paper-defs" aria-hidden="true" focusable="false">
        <defs>
          <filter
            id="preview-paper-torn"
            x="-10%"
            y="-10%"
            width="120%"
            height="120%"
          >
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.045 0.07"
              numOctaves="4"
              seed="8"
              result="tornNoise"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="tornNoise"
              scale="18"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>
      <span className="preview-paper-sheet" aria-hidden="true" />

      {/* Top Status Badge */}
      <div className="preview-status-badge">
        <span className="preview-status-text">Sandbox</span>
      </div>

      {/* Top Reset Button */}
      {onReset && (
        <button
          type="button"
          onClick={onReset}
          className="preview-reset-btn"
          title="Reset cursor settings"
          aria-label="Reset cursor settings"
        >
          <RotateCcw className="size-3.5" />
        </button>
      )}



      {/* Floating Tooltip */}
      {tooltip && (
        <div
          className="preview-state-tooltip"
          style={{
            left: `${tooltip.x}px`,
            top: `${tooltip.y}px`,
          }}
        >
          {tooltip.text}
        </div>
      )}

      {/* Interactive Mini-Cursor Tracking Mouse */}
      {renderedActiveSvg && (
        <div
          className={`preview-mini-cursor${
            hasCustomColor ? " color-custom" : ""
          }`}
          style={effectiveColor ? { color: effectiveColor } : undefined}
          dangerouslySetInnerHTML={{
            __html: withUniqueClipIds(renderedActiveSvg, "mini"),
          }}
        />
      )}

      {/* Idle cursor that runs its own demo while the pointer is away */}
      {isIdle && renderedIdleSvg && (
        <motion.div
          className={`preview-idle-cursor${
            hasCustomColor ? " color-custom" : ""
          }`}
          style={effectiveColor ? { color: effectiveColor } : undefined}
          animate={idleControls}
          dangerouslySetInnerHTML={{
            __html: withUniqueClipIds(renderedIdleSvg, "idle"),
          }}
        />
      )}

      {/* Bottom Draggable Embla Carousel */}
      {slides.length > 0 && (
        <div className="preview-embla-wrapper">
          <div className="preview-embla-viewport" ref={emblaRef}>
            <div className="preview-embla-container">
              {slides.map((state, index) => {
                const isActive = selectedIndex === index;
                return (
                  <div
                    key={`${state.name}-${index}`}
                    className="preview-embla-slide"
                  >
                    <div
                      className={`preview-state-card ${
                        isActive ? "active" : ""
                      }${hasCustomColor ? " color-custom" : ""}`}
                      style={effectiveColor ? { color: effectiveColor } : undefined}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCardClick(index);
                      }}
                      onMouseEnter={(e) => {
                        const rect = (
                          e.currentTarget as HTMLElement
                        ).getBoundingClientRect();
                        const parentRect =
                          previewRef.current?.getBoundingClientRect();
                        if (parentRect) {
                          setTooltip({
                            text: state.name,
                            x: rect.left - parentRect.left + rect.width / 2,
                            y: rect.top - parentRect.top - 8,
                          });
                        }
                      }}
                      onMouseLeave={() => setTooltip(null)}
                      dangerouslySetInnerHTML={{
                        __html: withUniqueClipIds(state.icon, `card-${index}`),
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
