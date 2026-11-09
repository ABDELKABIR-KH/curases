#!/usr/bin/env node
/**
 * Predictive edge-dive behaviour check.
 *
 * Runs the engine against a small DOM/RAF stub and verifies:
 *   1. slowly approaching an edge without crossing does not dive;
 *   2. flicking toward an edge pitches, scales down, and submerges;
 *   3. re-entry starts from scale 0.1 / 35deg and springs back to rest;
 *   4. a scoped container is read once (not per frame) and clipped by a layer.
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = await readFile(join(root, "src/engine/engine.source.js"), "utf-8");
const pack = JSON.parse(await readFile(join(root, "src/data/cursors/handy.json"), "utf-8"));

function createElement(tagName, registry) {
  const element = {
    nodeType: 1,
    tagName: String(tagName).toUpperCase(),
    id: "",
    style: {},
    children: [],
    parentNode: null,
    textContent: "",
    innerHTML: "",
    attrs: {},
    listeners: {},
    layoutReads: 0,
    appendChild(child) {
      this.children.push(child);
      child.parentNode = this;
      return child;
    },
    insertBefore(child) {
      this.children.push(child);
      child.parentNode = this;
      return child;
    },
    removeChild(child) {
      this.children = this.children.filter((entry) => entry !== child);
      child.parentNode = null;
      return child;
    },
    remove() {
      if (this.parentNode) this.parentNode.removeChild(this);
    },
    setAttribute(name, value) {
      this.attrs[name] = String(value);
    },
    getAttribute(name) {
      return Object.prototype.hasOwnProperty.call(this.attrs, name) ? this.attrs[name] : null;
    },
    hasAttribute(name) {
      return Object.prototype.hasOwnProperty.call(this.attrs, name);
    },
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
    closest() {
      return null;
    },
    addEventListener(type, handler) {
      (this.listeners[type] ||= []).push(handler);
    },
    removeEventListener(type, handler) {
      this.listeners[type] = (this.listeners[type] || []).filter((entry) => entry !== handler);
    },
    getBoundingClientRect() {
      this.layoutReads += 1;
      return this.rect || { left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0 };
    },
    getTotalLength() {
      return 0;
    },
  };

  registry.push(element);
  return element;
}

function makeResponse(body, status) {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function runEngine() {
  const registry = [];
  const windowListeners = {};
  const documentListeners = {};
  const rafQueue = [];
  let frameTime = 0;

  const head = createElement("head", registry);
  const body = createElement("body", registry);
  const documentElement = createElement("html", registry);
  documentElement.clientWidth = 1000;
  documentElement.clientHeight = 800;

  const document = {
    readyState: "complete",
    currentScript: null,
    head,
    body,
    documentElement,
    createElement: (tag) => createElement(tag, registry),
    getElementById: (id) => registry.find((element) => element.id === id) || null,
    querySelector: () => null,
    addEventListener(type, handler) {
      (documentListeners[type] ||= []).push(handler);
    },
    removeEventListener(type, handler) {
      documentListeners[type] = (documentListeners[type] || []).filter((entry) => entry !== handler);
    },
    elementFromPoint: () => null,
  };

  const window = {
    __CURSOR_ASSET_BASE__: "https://www.curases.com",
    innerWidth: 1000,
    innerHeight: 800,
    addEventListener(type, handler) {
      (windowListeners[type] ||= []).push(handler);
    },
    removeEventListener(type, handler) {
      windowListeners[type] = (windowListeners[type] || []).filter((entry) => entry !== handler);
    },
    dispatchEvent(event) {
      const type = event && event.type;
      (windowListeners[type] || []).forEach((handler) => handler(event));
      return true;
    },
    getComputedStyle: () => ({ cursor: "auto", pointerEvents: "auto" }),
  };

  const localStorage = {
    store: new Map(),
    getItem(key) {
      return this.store.has(key) ? this.store.get(key) : null;
    },
    setItem(key, value) {
      this.store.set(key, String(value));
    },
  };

  const fetch = async (url) => {
    if (String(url).endsWith("/cursors/manifest.json")) {
      return makeResponse({ cursors: [{ id: "Handy", name: "Handy Cursor", file: "handy.json" }] }, 200);
    }
    if (String(url).endsWith("/api/cursors/handy.json")) {
      return makeResponse(pack, 200);
    }
    return makeResponse({ error: "Not found" }, 404);
  };

  const requestAnimationFrame = (cb) => {
    rafQueue.push(cb);
    return rafQueue.length;
  };

  const execute = new Function(
    "window",
    "document",
    "localStorage",
    "fetch",
    "requestAnimationFrame",
    source
  );
  execute(window, document, localStorage, fetch, requestAnimationFrame);

  function tick(ms = 16) {
    frameTime += ms;
    const pending = rafQueue.splice(0, rafQueue.length);
    pending.forEach((cb) => cb(frameTime));
  }

  function move(clientX, clientY, timeStamp) {
    const event = {
      clientX,
      clientY,
      timeStamp,
      target: {
        tagName: "DIV",
        getAttribute: () => null,
        closest: () => null,
        parentElement: null,
      },
    };
    (windowListeners.mousemove || []).forEach((handler) => handler(event));
  }

  function enter(clientX, clientY, timeStamp) {
    const event = { clientX, clientY, timeStamp };
    (documentListeners.pointerenter || []).forEach((handler) => handler(event));
  }

  function leave(timeStamp) {
    const event = { timeStamp };
    (documentListeners.pointerleave || []).forEach((handler) => handler(event));
  }

  const cursor = registry.find((element) => element.id === "custom-cursor");

  return {
    window,
    document,
    registry,
    cursor,
    tick,
    move,
    enter,
    leave,
    get transform() {
      return cursor.style.transform || "";
    },
  };
}

const results = [];
function assert(condition, message) {
  if (!condition) throw new Error(message);
}
async function check(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
  } catch (error) {
    results.push({ name, ok: false, detail: error instanceof Error ? error.message : String(error) });
  }
}

function baseTranslate(transform) {
  const match = transform.match(/translate3d\((-?[\d.]+)px, (-?[\d.]+)px, 0\)/);
  if (!match) throw new Error(`missing base translate: ${transform}`);
  return { x: parseFloat(match[1]), y: parseFloat(match[2]) };
}

await check("slow movement inside the buffer keeps the cursor visible", async () => {
  const run = runEngine();
  await new Promise((resolve) => setTimeout(resolve, 30));

  // 1px every 20ms = 0.05 px/ms, far below the exit-confidence threshold.
  let t = 1000;
  for (let y = 60; y >= 6; y -= 1) {
    run.move(500, y, t);
    run.tick(20);
    t += 20;
  }

  // Settle inside the 18px buffer without any outward velocity.
  for (let i = 0; i < 4; i++) {
    t += 20;
    run.tick(20);
  }

  assert(run.transform.includes("translate3d"), "cursor transform was not applied");
  assert(!run.transform.includes("perspective"), `slow movement dived: ${run.transform}`);

  const base = baseTranslate(run.transform);
  // Hotspot is 1px; the cursor must still sit on the pointer even though the
  // pointer is deep inside the buffer.
  assert(
    Math.abs(base.y - (6 - 1)) < 0.6,
    `cursor lost its position inside the buffer: ${base.y}`
  );
});

await check("fast flick toward the top edge dives with pitch and scale", async () => {
  const run = runEngine();
  await new Promise((resolve) => setTimeout(resolve, 30));

  let t = 1000;
  run.move(500, 400, t);
  run.tick(16);
  t += 16;
  run.move(500, 120, t);
  run.tick(16);
  t += 16;
  run.move(500, 40, t);
  run.tick(16);
  t += 16;
  run.move(500, 12, t);
  run.tick(16);

  for (let i = 0; i < 3; i++) {
    t += 16;
    run.move(500, 8, t);
    run.tick(16);
  }

  assert(run.transform.includes("perspective(400px)"), `missing perspective: ${run.transform}`);
  assert(/rotateX\((-?[\d.]+)deg\)/.test(run.transform), `missing rotateX: ${run.transform}`);
  assert(/scale\(([\d.]+)\)/.test(run.transform), `missing scale: ${run.transform}`);
  assert(run.transform.includes("translate3d(0.00px, -"), `missing upward submerge: ${run.transform}`);

  const match = run.transform.match(/rotateX\((-?[\d.]+)deg\)/);
  assert(match && parseFloat(match[1]) > 0, `top edge should pitch positively: ${run.transform}`);
  const scaleMatch = run.transform.match(/scale\(([\d.]+)\)/);
  assert(scaleMatch && parseFloat(scaleMatch[1]) < 0.9, `cursor did not scale down: ${run.transform}`);
});

await check("re-entry starts small, pitched, then springs back to rest", async () => {
  const run = runEngine();
  await new Promise((resolve) => setTimeout(resolve, 30));

  let t = 1000;
  run.move(500, 300, t);
  run.tick(16);

  t += 2500;
  run.enter(500, 2, t);
  run.tick(16);

  assert(/scale\(([0-1]\.\d+)\)/.test(run.transform), `entry did not shrink: ${run.transform}`);
  const entryScale = parseFloat(run.transform.match(/scale\(([\d.]+)\)/)[1]);
  assert(entryScale < 0.35, `entry scale too large: ${entryScale}`);
  assert(/rotateX\(([\d.]+)deg\)/.test(run.transform), `entry did not pitch from edge: ${run.transform}`);

  // Move inward to kill outward velocity, then let the spring settle.
  run.move(500, 40, t + 16);
  for (let i = 0; i < 120; i++) {
    t += 16;
    run.tick(16);
  }

  const settledScaleMatch = run.transform.match(/scale\(([\d.]+)\)/);
  assert(!settledScaleMatch || parseFloat(settledScaleMatch[1]) > 0.999, `spring did not settle: ${run.transform}`);
  assert(!run.transform.includes("rotateX(0.000deg)"), "stale pitch transform left behind");
});

await check("scoped container caches bounds and clips through a layer", async () => {
  const run = runEngine();
  await new Promise((resolve) => setTimeout(resolve, 30));

  const canvas = createElement("canvas", run.registry);
  canvas.rect = { left: 100, top: 100, width: 300, height: 200, right: 400, bottom: 300 };
  run.document.querySelector = (selector) => (selector === "#stage" ? canvas : null);

  run.window.Curases.setEdgeDive({ scope: "#stage" });
  run.tick(16);
  run.tick(16);

  const layer = run.registry.find((element) => element.id === "curases-scope-layer");
  assert(layer, "scope layer was not created");
  assert(run.cursor.parentNode === layer, "cursor was not moved into the clipping layer");
  assert(run.cursor.style.position === "absolute", "scoped cursor should be absolutely positioned");
  assert(layer.style.width === "300px" && layer.style.height === "200px", "layer did not match scope bounds");

  const readsBefore = canvas.layoutReads;
  let t = 2000;
  run.move(250, 250, t);
  run.tick(16);
  for (let i = 0; i < 20; i++) {
    t += 16;
    run.move(250, 250, t);
    run.tick(16);
  }
  assert(canvas.layoutReads === readsBefore, "scope bounds were read during the render loop");

  t += 16;
  run.move(250, 105, t);
  run.tick(16);
  for (let i = 0; i < 8; i++) {
    t += 16;
    run.move(250, 102, t);
    run.tick(16);
  }
  assert(run.transform.includes("perspective(400px)"), `scoped dive did not trigger: ${run.transform}`);
});

await check("all four edges dive on the correct axis and direction", async () => {
  const edges = [
    { name: "top", from: [500, 400], to: [500, 8], axis: "rotateX", sign: 1, offset: /translate3d\(0\.00px, -[\d.]+px, 0\)/ },
    { name: "bottom", from: [500, 400], to: [500, 792], axis: "rotateX", sign: -1, offset: /translate3d\(0\.00px, [\d.]+px, 0\)/ },
    { name: "left", from: [500, 400], to: [8, 400], axis: "rotateY", sign: -1, offset: /translate3d\(-[\d.]+px, 0\.00px, 0\)/ },
    { name: "right", from: [500, 400], to: [992, 400], axis: "rotateY", sign: 1, offset: /translate3d\([\d.]+px, 0\.00px, 0\)/ },
  ];

  for (const edge of edges) {
    const run = runEngine();
    await new Promise((resolve) => setTimeout(resolve, 30));
    run.window.Curases.setEdgeDive({ autoSuppressFlushSides: false });

    let t = 1000;
    run.move(edge.from[0], edge.from[1], t);
    run.tick(16);
    t += 16;
    run.move(edge.to[0], edge.to[1], t);
    run.tick(16);
    t += 16;
    run.move(edge.to[0], edge.to[1], t);
    run.tick(16);

    const angleMatch = run.transform.match(new RegExp(`${edge.axis}\\((-?[\\d.]+)deg\\)`));
    assert(angleMatch, `${edge.name}: missing ${edge.axis}: ${run.transform}`);
    assert(
      Math.sign(parseFloat(angleMatch[1])) === edge.sign,
      `${edge.name}: wrong pitch direction: ${run.transform}`
    );
    assert(edge.offset.test(run.transform), `${edge.name}: wrong submerge direction: ${run.transform}`);
  }
});

await check("parallel motion near any edge stays locked to the pointer", async () => {
  const edges = [
    { name: "top", fixed: { axis: "y", value: 6 }, move: "x", start: 500, step: 8 },
    { name: "bottom", fixed: { axis: "y", value: 794 }, move: "x", start: 500, step: 8 },
    { name: "left", fixed: { axis: "x", value: 6 }, move: "y", start: 400, step: 8 },
    { name: "right", fixed: { axis: "x", value: 994 }, move: "y", start: 400, step: 8 },
  ];

  for (const edge of edges) {
    const run = runEngine();
    await new Promise((resolve) => setTimeout(resolve, 30));
    run.window.Curases.setEdgeDive({ autoSuppressFlushSides: false });

    const point = (moving) =>
      edge.fixed.axis === "y"
        ? [moving, edge.fixed.value]
        : [edge.fixed.value, moving];

    let t = 1000;
    let moving = edge.start;
    run.move(...point(moving), t);
    run.tick(16);

    for (let i = 0; i < 12; i++) {
      t += 16;
      moving += edge.step;
      run.move(...point(moving), t);
      run.tick(16);
    }

    assert(
      !run.transform.includes("perspective"),
      `${edge.name}: parallel movement triggered a dive: ${run.transform}`
    );

    const base = baseTranslate(run.transform);
    const normalValue = edge.fixed.axis === "y" ? base.y : base.x;
    const tangentValue = edge.fixed.axis === "y" ? base.x : base.y;
    const expectedNormal = edge.fixed.value - 1;
    const expectedTangent = moving - 1;

    assert(
      Math.abs(normalValue - expectedNormal) < 0.6,
      `${edge.name}: parallel movement was pulled off the boundary axis: ${normalValue}`
    );
    assert(
      Math.abs(tangentValue - expectedTangent) < 1.5,
      `${edge.name}: parallel movement did not track the pointer: ${tangentValue}`
    );
  }
});

await check("magnetic lead carries the cursor ahead of the pointer", async () => {
  const run = runEngine();
  await new Promise((resolve) => setTimeout(resolve, 30));

  let t = 1000;
  run.move(500, 400, t);
  run.tick(16);
  t += 16;
  run.move(500, 200, t);
  run.tick(16);
  t += 16;
  run.move(500, 100, t);
  run.tick(16);
  t += 16;
  run.move(500, 40, t);
  run.tick(16);
  t += 16;
  run.move(500, 25, t);
  run.tick(16);

  assert(run.transform.includes("perspective(400px)"), `magnetic dive missing: ${run.transform}`);
  const base = baseTranslate(run.transform);
  const pointerY = 25;
  // The rendered cursor must lead the physical pointer toward the edge.
  assert(base.y < pointerY - 1 - 2, `cursor did not lead the pointer: ${base.y}`);
  // ...without overshooting the virtual horizon at 18px (hotspot 1px).
  assert(base.y >= 18 - 1 - 0.75, `cursor overshot the horizon: ${base.y}`);

  const roll = run.transform.match(/rotateZ\((-?[\d.]+)deg\)/);
  assert(roll && Math.abs(parseFloat(roll[1])) > 0.5, `missing Z nose alignment: ${run.transform}`);
});

await check("dive reaches scale 0 at the virtual horizon, before the raw edge", async () => {
  const run = runEngine();
  await new Promise((resolve) => setTimeout(resolve, 30));

  let t = 1000;
  run.move(500, 400, t);
  run.tick(16);
  t += 16;
  run.move(500, 200, t);
  run.tick(16);
  t += 16;
  run.move(500, 100, t);
  run.tick(16);
  t += 16;
  run.move(500, 40, t);
  run.tick(16);
  t += 16;
  run.move(500, 20, t);
  run.tick(16);

  assert(run.transform.includes("perspective(400px)"), `dive missing: ${run.transform}`);
  const scaleMatch = run.transform.match(/scale\(([\d.]+)\)/);
  assert(scaleMatch, `missing scale: ${run.transform}`);
  // The pointer is still 20px from the raw border, but the cursor should have
  // collapsed against the virtual horizon at 18px.
  assert(parseFloat(scaleMatch[1]) < 0.1, `dive completed too late: ${scaleMatch[1]}`);

  const base = baseTranslate(run.transform);
  assert(
    Math.abs(base.y - (18 - 1)) < 1.5,
    `cursor did not rest on the horizon: ${base.y}`
  );
});

await check("diagonal corner exit blends both magnetic axes", async () => {
  const run = runEngine();
  await new Promise((resolve) => setTimeout(resolve, 30));
  run.window.Curases.setEdgeDive({ autoSuppressFlushSides: false });

  let t = 1000;
  run.move(500, 400, t);
  run.tick(16);
  t += 16;
  run.move(800, 200, t);
  run.tick(16);
  t += 16;
  run.move(988, 20, t);
  run.tick(16);

  for (let i = 0; i < 5; i++) {
    t += 16;
    run.move(992, 8, t);
    run.tick(16);
  }

  const rotX = run.transform.match(/rotateX\((-?[\d.]+)deg\)/);
  const rotY = run.transform.match(/rotateY\((-?[\d.]+)deg\)/);
  assert(rotX && parseFloat(rotX[1]) > 1, `corner missing top pitch: ${run.transform}`);
  assert(rotY && parseFloat(rotY[1]) > 1, `corner missing right pitch: ${run.transform}`);
  assert(
    /translate3d\([\d.]+px, -[\d.]+px, 0\)/.test(run.transform),
    `corner should submerge up and right: ${run.transform}`
  );
});

await check("captured edges hold through tremors then release after the lock", async () => {
  const run = runEngine();
  await new Promise((resolve) => setTimeout(resolve, 30));

  let t = 1000;
  run.move(500, 400, t);
  run.tick(16);

  // Approach just fast enough to capture without building a huge velocity.
  for (let y = 30; y >= 1; y -= 3) {
    t += 16;
    run.move(500, y, t);
    run.tick(16);
  }

  assert(run.transform.includes("perspective(400px)"), `capture never armed: ${run.transform}`);

  // Nudge inward by 1.5px. Raw confidence falls below the 0.45 gate, so only
  // the hysteresis lock can keep the cursor submerged.
  t += 16;
  run.move(500, 2.5, t);
  run.tick(16);

  assert(run.transform.includes("perspective(400px)"), `lock did not hold: ${run.transform}`);
  const heldScale = run.transform.match(/scale\(([\d.]+)\)/);
  assert(
    heldScale && parseFloat(heldScale[1]) < 0.9,
    `captured cursor popped early: ${run.transform}`
  );

  // Let the 120ms lock expire, then let the spring settle.
  for (let i = 0; i < 14; i++) {
    t += 16;
    run.tick(16);
  }
  for (let i = 0; i < 120; i++) {
    t += 16;
    run.tick(16);
  }

  assert(
    !run.transform.includes("perspective(400px)"),
    `cursor stayed locked after expiry: ${run.transform}`
  );
});

await check("re-entry from all four edges pops out with a spring", async () => {
  const edges = [
    { name: "top", x: 500, y: 2, axis: "rotateX", sign: 1 },
    { name: "bottom", x: 500, y: 798, axis: "rotateX", sign: -1 },
    { name: "left", x: 2, y: 400, axis: "rotateY", sign: -1 },
    { name: "right", x: 998, y: 400, axis: "rotateY", sign: 1 },
  ];

  for (const edge of edges) {
    const run = runEngine();
    await new Promise((resolve) => setTimeout(resolve, 30));
    run.window.Curases.setEdgeDive({ autoSuppressFlushSides: false });

    let t = 1000;
    run.move(500, 400, t);
    run.tick(16);

    t += 2500;
    run.enter(edge.x, edge.y, t);
    run.tick(16);

    const scaleMatch = run.transform.match(/scale\(([\d.]+)\)/);
    assert(scaleMatch, `${edge.name}: entry did not shrink: ${run.transform}`);
    assert(parseFloat(scaleMatch[1]) < 0.35, `${edge.name}: entry scale too large: ${scaleMatch[1]}`);

    const angleMatch = run.transform.match(new RegExp(`${edge.axis}\\((-?[\\d.]+)deg\\)`));
    assert(angleMatch, `${edge.name}: entry missing ${edge.axis}: ${run.transform}`);
    assert(
      Math.sign(parseFloat(angleMatch[1])) === edge.sign,
      `${edge.name}: entry pitched the wrong way: ${run.transform}`
    );

    // Move back inside and let the underdamped spring settle.
    run.move(500, 400, t + 16);
    for (let i = 0; i < 120; i++) {
      t += 16;
      run.tick(16);
    }

    const settled = run.transform.match(/scale\(([\d.]+)\)/);
    assert(
      !settled || parseFloat(settled[1]) > 0.999,
      `${edge.name}: entry spring did not settle: ${run.transform}`
    );
  }
});

await check("re-entry stays submerged through the buffer then pops", async () => {
  const run = runEngine();
  await new Promise((resolve) => setTimeout(resolve, 30));

  let t = 1000;
  run.move(500, 400, t);
  run.tick(16);

  // Enter from the top and travel inward, but stay inside the 18px buffer.
  run.enter(500, 2, t + 2500);
  t += 2500;
  run.move(500, 10, t + 16);
  t += 16;
  run.tick(16);

  const heldScale = run.transform.match(/scale\(([\d.]+)\)/);
  assert(heldScale, `re-entry hold missing scale: ${run.transform}`);
  assert(
    parseFloat(heldScale[1]) < 0.05,
    `cursor popped while still inside the buffer: ${heldScale[1]}`
  );

  // Cross the virtual horizon: the spring should now pop the cursor out.
  run.move(500, 30, t + 16);
  t += 16;
  run.tick(16);

  const poppedScale = run.transform.match(/scale\(([\d.]+)\)/);
  assert(poppedScale, `pop missing scale: ${run.transform}`);
  assert(
    parseFloat(poppedScale[1]) > 0.02,
    `cursor did not pop after crossing the buffer: ${poppedScale[1]}`
  );
});

await check("flush viewport width suppresses left/right while keeping top/bottom", async () => {
  const run = runEngine();
  await new Promise((resolve) => setTimeout(resolve, 30));

  const sides = [
    { name: "left", from: [500, 400], to: [8, 400] },
    { name: "right", from: [500, 400], to: [992, 400] },
  ];
  for (const side of sides) {
    let t = 1000;
    run.move(side.from[0], side.from[1], t);
    run.tick(16);
    for (let i = 0; i < 12; i++) {
      t += 16;
      run.move(side.to[0], side.to[1], t);
      run.tick(16);
    }
    assert(
      !run.transform.includes("perspective"),
      `${side.name}: flush side should have no dive: ${run.transform}`
    );
    const base = baseTranslate(run.transform);
    const expectedX = side.to[0] - 1; // Handy hotspot x = 1
    assert(
      Math.abs(base.x - expectedX) < 1.5,
      `${side.name}: cursor should stay on the pointer: ${base.x}`
    );
  }

  // Top and bottom must still dive (default viewport is full-width => flush).
  const verticals = [
    { name: "top", from: [500, 400], to: [500, 20], axis: "rotateX", sign: 1 },
    { name: "bottom", from: [500, 400], to: [500, 780], axis: "rotateX", sign: -1 },
  ];
  for (const edge of verticals) {
    const vRun = runEngine();
    await new Promise((resolve) => setTimeout(resolve, 30));

    let t = 5000;
    vRun.move(edge.from[0], edge.from[1], t);
    vRun.tick(16);
    t += 16;
    vRun.move(edge.to[0], edge.to[1], t);
    vRun.tick(16);
    t += 16;
    vRun.move(edge.to[0], edge.to[1], t);
    vRun.tick(16);

    const angleMatch = vRun.transform.match(new RegExp(`${edge.axis}\\((-?[\\d.]+)deg\\)`));
    assert(angleMatch, `${edge.name}: vertical edge should still dive: ${vRun.transform}`);
    assert(
      Math.sign(parseFloat(angleMatch[1])) === edge.sign,
      `${edge.name}: wrong vertical pitch: ${vRun.transform}`
    );
  }
});

await check("partial-width container keeps all four edge dives active", async () => {
  const run = runEngine();
  await new Promise((resolve) => setTimeout(resolve, 30));

  const canvas = createElement("canvas", run.registry);
  canvas.rect = { left: 120, top: 80, width: 760, height: 640, right: 880, bottom: 720 };
  run.document.querySelector = (selector) => (selector === "#stage" ? canvas : null);
  run.window.Curases.setEdgeDive({ scope: "#stage" });
  run.tick(16);

  const checks = [
    { name: "top", from: [500, 400], to: [500, 88], axis: "rotateX" },
    { name: "bottom", from: [500, 400], to: [500, 712], axis: "rotateX" },
    { name: "left", from: [500, 400], to: [128, 400], axis: "rotateY" },
    { name: "right", from: [500, 400], to: [872, 400], axis: "rotateY" },
  ];

  for (const edge of checks) {
    let t = 10000;
    run.move(edge.from[0], edge.from[1], t);
    run.tick(16);
    t += 16;
    run.move(edge.to[0], edge.to[1], t);
    run.tick(16);
    t += 16;
    run.move(edge.to[0], edge.to[1], t);
    run.tick(16);
    assert(
      run.transform.includes("perspective(400px)"),
      `${edge.name}: partial container should allow dives: ${run.transform}`
    );
  }
});

await check("resize dynamically re-evaluates flush-side suppression", async () => {
  const run = runEngine();
  await new Promise((resolve) => setTimeout(resolve, 30));

  const canvas = createElement("canvas", run.registry);
  canvas.rect = { left: 0, top: 0, width: 1000, height: 800, right: 1000, bottom: 800 };
  run.document.querySelector = (selector) => (selector === "#full" ? canvas : null);
  run.window.Curases.setEdgeDive({ scope: "#full" });
  run.tick(16); // applies bounds + mask

  let t = 1000;
  run.move(500, 400, t);
  run.tick(16);
  t += 16;
  run.move(992, 400, t);
  run.tick(16);
  t += 16;
  run.move(992, 400, t);
  run.tick(16);
  assert(!run.transform.includes("perspective"), `right side should be suppressed when flush: ${run.transform}`);

  // Make the container inset from the right edge (no longer full-width).
  canvas.rect = { left: 0, top: 0, width: 900, height: 800, right: 900, bottom: 800 };
  run.window.dispatchEvent({ type: "resize" });
  run.tick(16); // processes scheduled bounds refresh

  t += 100;
  run.move(500, 400, t);
  run.tick(16);
  t += 16;
  run.move(892, 400, t);
  run.tick(16);
  t += 16;
  run.move(892, 400, t);
  run.tick(16);
  assert(
    run.transform.includes("perspective(400px)"),
    `right side should dive after resize removes flushness: ${run.transform}`
  );
});

await check("edge config can override auto flush-side suppression", async () => {
  const run = runEngine();
  await new Promise((resolve) => setTimeout(resolve, 30));

  run.window.Curases.setEdgeDive({
    autoSuppressFlushSides: true,
    edges: { right: true, left: true },
  });
  // Force left/right back on despite flush viewport.
  run.window.Curases.setEdgeDive({ autoSuppressFlushSides: false });

  let t = 1000;
  run.move(500, 400, t);
  run.tick(16);
  t += 16;
  run.move(992, 400, t);
  run.tick(16);
  t += 16;
  run.move(992, 400, t);
  run.tick(16);

  assert(
    run.transform.includes("perspective(400px)"),
    `override should allow right dive: ${run.transform}`
  );
});

await check("slow slide on a suppressed side wall causes no bump", async () => {
  const run = runEngine();
  await new Promise((resolve) => setTimeout(resolve, 30));

  let t = 1000;
  run.move(40, 400, t);
  run.tick(16);

  // Approach and slide along the left wall slowly (<= 0.06 px/ms) so impact
  // velocity never crosses the 0.25 px/ms threshold.
  let y = 400;
  let x = 40;
  while (x > 1) {
    t += 20;
    x = Math.max(1, x - 1);
    y += 0.2;
    run.move(x, y, t);
    run.tick(20);
  }
  for (let i = 0; i < 20; i++) {
    t += 20;
    y += 0.2;
    run.move(1, y, t);
    run.tick(20);
  }

  assert(
    !/scale\([^,]+,/.test(run.transform),
    `slow slide should not squash: ${run.transform}`
  );
  assert(
    !run.cursor.style.opacity,
    `slow slide should not pulse opacity: ${run.cursor.style.opacity}`
  );
  assert(
    !run.transform.includes("perspective(400px) rotateX") ||
      /rotateZ\(0\.000deg\)/.test(run.transform),
    `slow slide should not produce a bump transform: ${run.transform}`
  );
});

await check("fast flick into a suppressed side wall triggers a tactile bump", async () => {
  const run = runEngine();
  await new Promise((resolve) => setTimeout(resolve, 30));

  let t = 1000;
  run.move(500, 400, t);
  run.tick(16);

  // Slam into the left wall: large negative vx at contact (x <= 2).
  t += 16;
  run.move(1, 400, t);
  run.tick(16);
  t += 16;
  run.tick(16); // impulse frame

  assert(
    /scale\([^,]+,[^)]+\)/.test(run.transform),
    `wall bump should squash/stretch: ${run.transform}`
  );
  assert(
    run.cursor.style.opacity && parseFloat(run.cursor.style.opacity) < 0.95,
    `wall bump should pulse opacity: ${run.cursor.style.opacity} ${run.transform}`
  );

  // Let the impulse settle (140ms + spring).
  for (let i = 0; i < 60; i++) {
    t += 16;
    run.tick(16);
  }

  // Settled: no meaningful squash/stretch remains.
  const settled = run.transform.match(/scale\(([\d.]+)(?:,\s*([\d.]+))?\)/);
  if (settled) {
    const sx = parseFloat(settled[1]);
    const sy = parseFloat(settled[2] || settled[1]);
    assert(Math.abs(sx - 1) < 0.01, `scaleX did not settle: ${sx} ${run.transform}`);
    assert(Math.abs(sy - 1) < 0.01, `scaleY did not settle: ${sy} ${run.transform}`);
    assert(Math.abs(sx - sy) < 0.01, `scales should be uniform after settle: ${run.transform}`);
  }
  assert(
    !run.cursor.style.opacity,
    `opacity should settle: ${run.cursor.style.opacity}`
  );
});

await check("stronger wall flicks produce a more pronounced bump", async () => {
  async function impactByVelocity(targetVx) {
    const run = runEngine();
    await new Promise((resolve) => setTimeout(resolve, 30));
    let t = 1000;
    // Build up leftward velocity with controlled moves, ending at contact.
    let x = 200;
    run.move(x, 400, t);
    run.tick(16);
    t += 16;
    // Accelerate toward wall.
    const step = Math.max(6, targetVx * 16);
    while (x > 20) {
      x = Math.max(20, x - step);
      run.move(x, 400, t);
      run.tick(16);
      t += 16;
    }
    // Final impact into contact.
    run.move(1, 400, t);
    run.tick(16);
    t += 16;
    run.tick(16);
    return run.transform;
  }

  const gentle = await impactByVelocity(0.5);
  const strong = await impactByVelocity(2.0);

  const scalePair = (transform) => {
    const m = transform.match(/scale\(([\d.]+)(?:,\s*([\d.]+))?\)/);
    if (!m) return null;
    return { x: parseFloat(m[1]), y: parseFloat(m[2] || m[1]) };
  };

  const g = scalePair(gentle);
  const s = scalePair(strong);
  assert(g && g.x !== g.y, `gentle tap should produce squash: ${gentle}`);
  assert(s && s.x !== s.y, `strong flick should produce squash: ${strong}`);
  assert(s.x < g.x, `strong flick should squash more: gentle=${g.x} strong=${s.x}`);
  assert(s.y > g.y, `strong flick should stretch more: gentle=${g.y} strong=${s.y}`);
});

await check("wall bump flicker stays inside the viewport", async () => {
  const run = runEngine();
  await new Promise((resolve) => setTimeout(resolve, 30));

  let t = 1000;
  run.move(500, 400, t);
  run.tick(16);
  t += 16;
  run.move(1, 400, t); // left wall impact
  run.tick(16);

  // Sample during the 120ms flicker window.
  let minBaseX = Infinity;
  for (let i = 0; i < 12; i++) {
    t += 10;
    run.tick(10);
    const base = baseTranslate(run.transform);
    minBaseX = Math.min(minBaseX, base.x);
  }

  // Cursor hotspot is 1px; pointer was at x=1. Base translate is renderX-hx + bump.
  // Inward-only flicker must never push it outside the viewport left.
  assert(minBaseX >= -0.01, `wall bump pushed cursor outside viewport: ${minBaseX}`);
});

console.log("\nCurases edge-dive check\n");
for (const result of results) {
  console.log(`  ${result.ok ? "PASS" : "FAIL"}  ${result.name}`);
  if (!result.ok) console.log(`        ${result.detail}`);
}
const failed = results.filter((result) => !result.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed\n`);
if (failed > 0) process.exit(1);
