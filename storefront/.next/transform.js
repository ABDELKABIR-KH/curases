const CHUNK_PUBLIC_PATH = "transform.js";
const runtime = require("./build/chunks/[turbopack]_runtime.js");
runtime.loadChunk("build/chunks/apps_storefront_postcss_config_js_transform_ts_aa0b16cc._.js");
runtime.loadChunk("build/chunks/[root-of-the-server]__63e623d5._.js");
runtime.getOrInstantiateRuntimeModule("[turbopack-node]/globals.ts [postcss] (ecmascript)", CHUNK_PUBLIC_PATH);
runtime.getOrInstantiateRuntimeModule("[turbopack-node]/ipc/evaluate.ts/evaluate.js { INNER => \"[project]/apps/storefront/postcss.config.js/transform.ts { CONFIG => \\\"[project]/apps/storefront/postcss.config.js_.loader.mjs [postcss] (ecmascript)\\\" } [postcss] (ecmascript)\", RUNTIME => \"[turbopack-node]/ipc/evaluate.ts [postcss] (ecmascript)\" } [postcss] (ecmascript)", CHUNK_PUBLIC_PATH);
module.exports = runtime.getOrInstantiateRuntimeModule("[turbopack-node]/ipc/evaluate.ts/evaluate.js { INNER => \"[project]/apps/storefront/postcss.config.js/transform.ts { CONFIG => \\\"[project]/apps/storefront/postcss.config.js_.loader.mjs [postcss] (ecmascript)\\\" } [postcss] (ecmascript)\", RUNTIME => \"[turbopack-node]/ipc/evaluate.ts [postcss] (ecmascript)\" } [postcss] (ecmascript)", CHUNK_PUBLIC_PATH).exports;
