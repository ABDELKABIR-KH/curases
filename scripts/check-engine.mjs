#!/usr/bin/env node
/**
 * Engine behaviour check.
 *
 * Runs src/engine/engine.source.js against a minimal DOM stub to verify:
 *   1. a successful pack renders and hides the native cursor;
 *   2. a failed pack keeps the native cursor visible, warns, and emits
 *      curases:error instead of failing silently;
 *   3. the canonical CDN is used as a fallback host.
 *
 * No browser or dependencies required.
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = await readFile(join(root, "src/engine/engine.source.js"), "utf-8");
const pack = JSON.parse(await readFile(join(root, "src/data/cursors/handy.json"), "utf-8"));

const warnings = [];
const originalWarn = console.warn;
console.warn = (...args) => warnings.push(args.join(" "));

function createElement(tagName, registry) {
  const element = {
    tagName: String(tagName).toUpperCase(),
    id: "",
    style: {},
    children: [],
    parentNode: null,
    textContent: "",
    innerHTML: "",
    attrs: {},
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
    addEventListener() {},
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

function runEngine({ base, failing }) {
  const registry = [];
  const listeners = {};
  const calls = [];
  const events = [];

  const head = createElement("head", registry);
  const body = createElement("body", registry);
  const documentElement = createElement("html", registry);

  const document = {
    readyState: "complete",
    currentScript: {
      src: "https://www.curases.com/engine.js",
      getAttribute: () => null,
      hasAttribute: () => false,
    },
    head,
    body,
    documentElement,
    createElement: (tag) => createElement(tag, registry),
    getElementById: (id) => registry.find((element) => element.id === id) || null,
    addEventListener() {},
    elementFromPoint: () => null,
  };

  const window = {
    __CURSOR_ASSET_BASE__: base,
    addEventListener(type, handler) {
      (listeners[type] ||= []).push(handler);
    },
    dispatchEvent(event) {
      events.push(event);
      (listeners[event.type] || []).forEach((handler) => handler(event));
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
    calls.push(String(url));

    if (failing) return makeResponse({ error: "Forbidden" }, 403);
    if (String(url).endsWith("/cursors/manifest.json")) {
      return makeResponse({ cursors: [{ id: "Handy", name: "Handy Cursor", file: "handy.json" }] }, 200);
    }
    if (String(url).endsWith("/api/cursors/handy.json")) {
      return makeResponse(pack, 200);
    }
    return makeResponse({ error: "Not found" }, 404);
  };

  const execute = new Function(
    "window",
    "document",
    "localStorage",
    "fetch",
    "requestAnimationFrame",
    source
  );
  execute(window, document, localStorage, fetch, () => 0);

  const cursor = registry.find((element) => element.id === "custom-cursor");

  return {
    cursor,
    get hideStyle() {
      return registry.find((element) => element.id === "curases-hide-native") || null;
    },
    calls,
    events,
    listeners,
    move(x, y) {
      const target = {
        tagName: "DIV",
        getAttribute: () => null,
        closest: () => null,
        parentElement: null,
      };
      const event = { clientX: x, clientY: y, target };
      (listeners.mousemove || []).forEach((handler) => handler(event));
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

await check("successful pack renders and hides the native cursor", async () => {
  const run = runEngine({ base: "https://www.curases.com", failing: false });
  await new Promise((resolve) => setTimeout(resolve, 50));

  assert(run.cursor, "cursor element was not created");
  assert(run.cursor.innerHTML.includes("<svg"), "cursor SVG was not rendered");
  assert(run.hideStyle, "native cursor was not hidden after a successful render");

  run.move(40, 40);
  assert(run.cursor.style.display === "block", "cursor was not shown after mousemove");
  assert(run.calls.length === 2, `expected 2 fetches, got ${run.calls.length}`);
});

await check("failed pack keeps the native cursor and reports the error", async () => {
  const warnStart = warnings.length;
  const run = runEngine({ base: "https://www.curases.com", failing: true });
  await new Promise((resolve) => setTimeout(resolve, 50));

  assert(!run.hideStyle, "native cursor was hidden even though the pack failed");
  assert(run.cursor && run.cursor.innerHTML === "", "cursor rendered without a pack");
  assert(
    warnings.slice(warnStart).some((warning) => warning.includes("[Curases]")),
    "no console warning was emitted"
  );
  assert(
    run.events.some((event) => event.type === "curases:error"),
    "no curases:error event was dispatched"
  );
});

await check("failed host falls back to the canonical CDN", async () => {
  const run = runEngine({ base: "https://broken.example", failing: true });
  await new Promise((resolve) => setTimeout(resolve, 50));

  assert(
    run.calls.some((url) => url.startsWith("https://broken.example")),
    "primary host was not tried"
  );
  assert(
    run.calls.some((url) => url.startsWith("https://www.curases.com")),
    "canonical CDN fallback was not tried"
  );
});

console.warn = originalWarn;

console.log("\nCurases engine check\n");
for (const result of results) {
  console.log(`  ${result.ok ? "PASS" : "FAIL"}  ${result.name}`);
  if (!result.ok) console.log(`        ${result.detail}`);
}
const failed = results.filter((result) => !result.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed\n`);
if (failed > 0) process.exit(1);
