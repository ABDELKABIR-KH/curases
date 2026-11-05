import { mkdir, readFile, writeFile } from "fs/promises";
import { dirname, join, relative } from "path";
import JavaScriptObfuscator from "javascript-obfuscator";

const root = process.cwd();
const sourcePath = join(root, "src/engine/engine.source.js");
const outputs = [
  join(root, "public/engine.js"),
  join(root, "public/cursor-engine.js"),
];

const isDev = process.argv.includes("--dev");
const cspSafe = process.env.CURASES_ENGINE_CSP_SAFE === "true";
const debugProtection =
  !isDev && !cspSafe && process.env.CURASES_DEBUG_PROTECTION !== "false";
const selfDefending = !isDev && !cspSafe;

const options = {
  compact: true,
  controlFlowFlattening: !isDev,
  controlFlowFlatteningThreshold: 0.75,
  deadCodeInjection: !isDev,
  deadCodeInjectionThreshold: 0.25,
  debugProtection,
  debugProtectionInterval: debugProtection ? 4000 : 0,
  // Never disable console output globally: the engine runs on the customer's
  // page and must not silence their own logging.
  disableConsoleOutput: false,
  identifierNamesGenerator: "hexadecimal",
  log: false,
  numbersToExpressions: true,
  renameGlobals: false,
  selfDefending,
  simplify: true,
  splitStrings: true,
  splitStringsChunkLength: 10,
  stringArray: true,
  stringArrayCallsTransform: true,
  stringArrayCallsTransformThreshold: 0.75,
  stringArrayEncoding: ["base64"],
  stringArrayIndexShift: true,
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayWrappersCount: 2,
  stringArrayWrappersChainedCalls: true,
  stringArrayWrappersParametersMaxCount: 4,
  stringArrayWrappersType: "function",
  stringArrayThreshold: 0.75,
  target: "browser",
  // Keep object keys intact: the public window.Curases API and DOM attribute
  // names must remain stable for host sites.
  transformObjectKeys: false,
  unicodeEscapeSequence: false,
  sourceMap: false,
  seed: 20261105,
};

const source = await readFile(sourcePath, "utf-8");
const obfuscated = JavaScriptObfuscator.obfuscate(source, options)
  .getObfuscatedCode()
  .trim();

try {
  // Compile-only check. This does not execute the engine.
  new Function(obfuscated);
} catch (error) {
  throw new Error(
    `Obfuscated engine failed the syntax check: ${error instanceof Error ? error.message : String(error)}`
  );
}

for (const outputPath of outputs) {
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, obfuscated, "utf-8");
  console.log(
    `  engine: ${relative(root, outputPath)} (${Buffer.byteLength(obfuscated).toLocaleString()} bytes)`
  );
}

console.log(
  `  engine: ${isDev ? "dev" : "production"} build${
    selfDefending ? ", self-defending" : ""
  }${debugProtection ? ", debug-protected" : ""}`
);
