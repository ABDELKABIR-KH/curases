#!/usr/bin/env node
/**
 * Curases delivery check.
 *
 * Verifies that the engine, manifest, and cursor packs are reachable from a
 * foreign origin (the Framer/Webflow/custom-domain case) and that the CORS and
 * cache headers match the configured delivery policy.
 *
 * Usage:
 *   node scripts/check-delivery.mjs                 # http://localhost:3000
 *   node scripts/check-delivery.mjs https://www.curases.com
 *   node scripts/check-delivery.mjs --strict        # server uses an allow-list
 */
const args = process.argv.slice(2);
const strict = args.includes("--strict");
const baseUrl = (args.find((arg) => !arg.startsWith("--")) || "http://localhost:3000").replace(/\/$/, "");

const FOREIGN_ORIGIN = "https://gorge.framer.website";
const OTHER_ORIGIN = "https://example.com";

const results = [];

function header(headers, name) {
  return headers.get(name);
}

function hasCors(headers, origin) {
  const acao = header(headers, "access-control-allow-origin");
  return acao === "*" || acao === origin;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(path, init = {}) {
  const url = path.startsWith("http") ? path : `${baseUrl}${path}`;
  return fetch(url, { redirect: "manual", ...init });
}

async function check(name, fn) {
  const started = Date.now();
  try {
    const detail = await fn();
    results.push({ name, ok: true, detail, ms: Date.now() - started });
  } catch (error) {
    results.push({
      name,
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
      ms: Date.now() - started,
    });
  }
}

await check("engine.js is served cross-origin", async () => {
  const res = await request("/engine.js", {
    headers: { Origin: FOREIGN_ORIGIN },
  });
  assert(res.status === 200, `expected 200, got ${res.status}`);
  assert(
    (header(res.headers, "content-type") || "").includes("javascript"),
    "content-type is not javascript"
  );
  assert(hasCors(res.headers, FOREIGN_ORIGIN), "missing Access-Control-Allow-Origin");
  return `200, ACAO ${header(res.headers, "access-control-allow-origin")}`;
});

await check("engine.js blocks document navigation", async () => {
  const res = await request("/engine.js", {
    headers: {
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
    },
  });
  assert(
    res.status === 307 || res.status === 308 || res.status === 403,
    `expected redirect/403, got ${res.status}`
  );
  return `${res.status} ${header(res.headers, "location") || ""}`.trim();
});

await check("manifest is public", async () => {
  const res = await request("/cursors/manifest.json", {
    headers: { Origin: FOREIGN_ORIGIN },
  });
  assert(res.status === 200, `expected 200, got ${res.status}`);
  assert(hasCors(res.headers, FOREIGN_ORIGIN), "missing Access-Control-Allow-Origin");
  const body = await res.json();
  assert(Array.isArray(body.cursors) && body.cursors.length > 0, "manifest has no cursors");
  return `${body.cursors.length} cursor(s)`;
});

await check(`pack is readable from ${FOREIGN_ORIGIN}`, async () => {
  const res = await request("/api/cursors/handy.json", {
    headers: { Origin: FOREIGN_ORIGIN, Accept: "application/json" },
  });
  assert(res.status === 200, `expected 200, got ${res.status}`);
  assert(hasCors(res.headers, FOREIGN_ORIGIN), "missing Access-Control-Allow-Origin");
  const cache = header(res.headers, "cache-control") || "";
  assert(
    strict ? cache.includes("private") : cache.includes("public"),
    `unexpected cache-control: ${cache}`
  );
  const body = await res.json();
  assert(body && typeof body.states === "object", "pack has no states");
  assert(Boolean(body.states.normal), "pack has no normal state");
  return `200, ACAO ${header(res.headers, "access-control-allow-origin")}, ${cache}`;
});

await check("pack by cursor id (no extension)", async () => {
  const res = await request("/api/cursors/handy", {
    headers: { Origin: FOREIGN_ORIGIN },
  });
  assert(res.status === 200, `expected 200, got ${res.status}`);
  return "200";
});

if (strict) {
  await check(`pack is rejected for unlisted origin ${OTHER_ORIGIN}`, async () => {
    const res = await request("/api/cursors/handy.json", {
      headers: { Origin: OTHER_ORIGIN },
    });
    assert(res.status === 403, `expected 403, got ${res.status}`);
    assert(
      !hasCors(res.headers, OTHER_ORIGIN),
      "unexpected Access-Control-Allow-Origin on rejected origin"
    );
    return "403, no ACAO";
  });
} else {
  await check(`pack is readable from another origin ${OTHER_ORIGIN}`, async () => {
    const res = await request("/api/cursors/handy.json", {
      headers: { Origin: OTHER_ORIGIN },
    });
    assert(res.status === 200, `expected 200, got ${res.status}`);
    assert(hasCors(res.headers, OTHER_ORIGIN), "missing Access-Control-Allow-Origin");
    return "200";
  });

  await check("pack is readable for non-browser clients", async () => {
    const res = await request("/api/cursors/handy.json", {
      headers: { "Sec-Fetch-Site": "cross-site" },
    });
    assert(res.status === 200, `expected 200, got ${res.status}`);
    return "200";
  });
}

await check("pack blocks direct navigation", async () => {
  const res = await request("/api/cursors/handy.json", {
    headers: { "Sec-Fetch-Site": "none" },
  });
  assert(res.status === 403, `expected 403, got ${res.status}`);
  return "403";
});

await check("OPTIONS preflight is answered", async () => {
  const res = await request("/api/cursors/handy.json", {
    method: "OPTIONS",
    headers: {
      Origin: FOREIGN_ORIGIN,
      "Access-Control-Request-Method": "GET",
      "Access-Control-Request-Headers": "content-type",
    },
  });
  assert(res.status === 204, `expected 204, got ${res.status}`);
  assert(hasCors(res.headers, FOREIGN_ORIGIN), "missing Access-Control-Allow-Origin");
  const methods = header(res.headers, "access-control-allow-methods") || "";
  assert(methods.includes("GET"), `unexpected methods: ${methods}`);
  return `204, methods ${methods}`;
});

await check("unknown cursor returns 404 with CORS", async () => {
  const res = await request("/api/cursors/does-not-exist.json", {
    headers: { Origin: FOREIGN_ORIGIN },
  });
  assert(res.status === 404, `expected 404, got ${res.status}`);
  if (!strict) {
    assert(hasCors(res.headers, FOREIGN_ORIGIN), "404 is missing Access-Control-Allow-Origin");
  }
  return "404";
});

await check("path traversal is rejected", async () => {
  const res = await request("/api/cursors/%2e%2e%2f%2e%2e%2fpackage.json", {
    headers: { Origin: FOREIGN_ORIGIN },
  });
  assert(res.status === 400 || res.status === 404, `expected 400/404, got ${res.status}`);
  const text = await res.text();
  assert(!text.includes('"name": "curases"'), "path traversal leaked package.json");
  return `${res.status}`;
});

await check("registry is public", async () => {
  const res = await request("/api/registry", {
    headers: { Origin: FOREIGN_ORIGIN },
  });
  assert(res.status === 200, `expected 200, got ${res.status}`);
  assert(hasCors(res.headers, FOREIGN_ORIGIN), "missing Access-Control-Allow-Origin");
  const body = await res.json();
  assert(Array.isArray(body.cursors) && body.cursors.length > 0, "registry has no cursors");
  return `${body.cursors.length} cursor(s)`;
});

const failed = results.filter((result) => !result.ok);
const label = strict ? "strict" : "public";

console.log(`\nCurases delivery check (${label}) -> ${baseUrl}\n`);

for (const result of results) {
  const status = result.ok ? "PASS" : "FAIL";
  console.log(`  ${status}  ${result.name}  [${result.ms}ms]`);
  console.log(`        ${result.detail}`);
}

console.log(
  `\n${results.length - failed.length}/${results.length} checks passed\n`
);

if (failed.length > 0) process.exit(1);
