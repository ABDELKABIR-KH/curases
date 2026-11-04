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
  onReset?: () => void;
  onToggleBoil?: () => void;
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

export default function PreviewCard({
  cursorStates,
  hotspots,
  activeState,
  onStateChange,
  size = 1.25,
  speed = 1,
  color = "",
  roughness = 0,
  boil = 0.3,
  outline = 0,
  onReset,
  onToggleBoil,
}: PreviewCardProps) {
  const hasCustomColor = Boolean(color);

  // Process all states in real time with roughness and boil
  const processedStates = useMemo(() => {
    if (roughness <= 0) return cursorStates;
    const result: Record<string, string> = {};
    for (const [key, svg] of Object.entries(cursorStates)) {
      result[key] = processRoughnessSvg(svg, roughness, boil);
    }
    return result;
  }, [cursorStates, roughness, boil]);

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
          title="Reset state to normal"
          aria-label="Reset state to normal"
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
          style={hasCustomColor ? { color } : undefined}
          dangerouslySetInnerHTML={{ __html: renderedActiveSvg }}
        />
      )}

      {/* Idle cursor that runs its own demo while the pointer is away */}
      {isIdle && renderedIdleSvg && (
        <motion.div
          className={`preview-idle-cursor${
            hasCustomColor ? " color-custom" : ""
          }`}
          style={hasCustomColor ? { color } : undefined}
          animate={idleControls}
          dangerouslySetInnerHTML={{ __html: renderedIdleSvg }}
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
                      style={hasCustomColor ? { color } : undefined}
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
                      dangerouslySetInnerHTML={{ __html: state.icon }}
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
