
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";
import * as readline from "readline";

// Minimal ANSI colors without external dependencies
const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  magenta: "\x1b[35m",
};

const DEFAULT_CDN = "https://www.curases.com";

interface CliOptions {
  cursor?: string;
  size?: number;
  speed?: number;
  color?: string;
  help?: boolean;
  version?: boolean;
  list?: boolean;
}

function parseArgs(args: string[]): { command?: string; cursor?: string; options: CliOptions } {
  const options: CliOptions = {};
  const positional: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "-h" || arg === "--help") {
      options.help = true;
    } else if (arg === "-v" || arg === "--version") {
      options.version = true;
    } else if (arg === "-l" || arg === "--list") {
      options.list = true;
    } else if (arg.startsWith("--size=")) {
      options.size = parseFloat(arg.split("=")[1]);
    } else if (arg.startsWith("--speed=")) {
      options.speed = parseFloat(arg.split("=")[1]);
    } else if (arg.startsWith("--color=")) {
      options.color = arg.split("=")[1];
    } else if (!arg.startsWith("-")) {
      positional.push(arg);
    }
  }

  let command: string | undefined;
  let cursor: string | undefined;

  if (positional.length > 0) {
    if (["add", "install", "set"].includes(positional[0].toLowerCase())) {
      command = positional[0].toLowerCase();
      cursor = positional[1];
    } else {
      cursor = positional[0];
    }
  }

  return { command, cursor, options };
}

function printHelp() {
  console.log(`
${c.bold}${c.cyan}✨ Curases CLI${c.reset}
Add dynamic custom cursors to your project in seconds.

${c.bold}USAGE${c.reset}
  ${c.green}npx curases${c.reset} [cursor-name] [options]
  ${c.green}npx curases add${c.reset} <cursor-name> [options]

${c.bold}EXAMPLES${c.reset}
  ${c.dim}$${c.reset} npx curases handy
  ${c.dim}$${c.reset} npx curases add Handy --color="#2563eb"
  ${c.dim}$${c.reset} npx curases --list

${c.bold}OPTIONS${c.reset}
  ${c.yellow}-l, --list${c.reset}          List all available cursor presets
  ${c.yellow}--size=<number>${c.reset}    Cursor scale factor (default: 1.5)
  ${c.yellow}--speed=<number>${c.reset}   Smooth movement speed (default: 1)
  ${c.yellow}--color=<hex>${c.reset}      Color override (e.g. #2563eb)
  ${c.yellow}-h, --help${c.reset}          Show this help message
  ${c.yellow}-v, --version${c.reset}       Show CLI version

${c.dim}Catalog & Documentation: https://curases.com${c.reset}
`);
}

async function fetchAvailableCursors(): Promise<string[]> {
  try {
    const res = await fetch(`${DEFAULT_CDN}/cursors/manifest.json`);
    if (!res.ok) throw new Error("Failed to fetch manifest");
    const data = (await res.json()) as { cursors: Array<{ name: string; id: string }> };
    return data.cursors.map((c) => c.name || c.id);
  } catch {
    // Fallback if offline
    return ["Handy"];
  }
}

function promptUser(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function detectPackageManager(cwd: string): "npm" | "pnpm" | "yarn" | "bun" {
  if (existsSync(join(cwd, "bun.lockb")) || existsSync(join(cwd, "bun.lock"))) return "bun";
  if (existsSync(join(cwd, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(join(cwd, "yarn.lock"))) return "yarn";
  return "npm";
}

function installPackage(cwd: string, pm: "npm" | "pnpm" | "yarn" | "bun") {
  const pkgPath = join(cwd, "package.json");
  if (!existsSync(pkgPath)) return;

  try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    if (deps["curases"]) {
      console.log(`  ${c.dim}• curases package already installed in package.json${c.reset}`);
      return;
    }
  } catch {}

  console.log(`  ${c.cyan}📦 Installing curases via ${pm}...${c.reset}`);
  const cmd = pm === "yarn" ? "yarn add curases" : pm === "pnpm" ? "pnpm add curases" : pm === "bun" ? "bun add curases" : "npm install curases";

  try {
    execSync(cmd, { cwd, stdio: "pipe" });
    console.log(`  ${c.green}✔ Installed curases successfully${c.reset}`);
  } catch (err) {
    console.warn(`  ${c.yellow}⚠ Could not run ${cmd} automatically. Please run it manually.${c.reset}`);
  }
}

interface TargetFile {
  type: "next-app" | "next-pages" | "react" | "html";
  filePath: string;
}

function detectTargetFile(cwd: string): TargetFile | null {
  // 1. Next.js App Router layout
  const nextAppPaths = [
    "app/layout.tsx",
    "app/layout.jsx",
    "app/layout.js",
    "src/app/layout.tsx",
    "src/app/layout.jsx",
    "src/app/layout.js",
  ];
  for (const p of nextAppPaths) {
    if (existsSync(join(cwd, p))) return { type: "next-app", filePath: join(cwd, p) };
  }

  // 2. Next.js Pages Router
  const nextPagesPaths = [
    "pages/_app.tsx",
    "pages/_app.jsx",
    "src/pages/_app.tsx",
    "src/pages/_app.jsx",
  ];
  for (const p of nextPagesPaths) {
    if (existsSync(join(cwd, p))) return { type: "next-pages", filePath: join(cwd, p) };
  }

  // 3. React / Vite (App.tsx / main.tsx)
  const reactPaths = [
    "src/App.tsx",
    "src/App.jsx",
    "src/main.tsx",
    "src/main.jsx",
  ];
  for (const p of reactPaths) {
    if (existsSync(join(cwd, p))) return { type: "react", filePath: join(cwd, p) };
  }

  // 4. Plain HTML
  if (existsSync(join(cwd, "index.html"))) {
    return { type: "html", filePath: join(cwd, "index.html") };
  }

  return null;
}

function injectCursor(target: TargetFile, cursorName: string, options: CliOptions) {
  const content = readFileSync(target.filePath, "utf-8");
  const relPath = target.filePath.replace(process.cwd() + "/", "");

  const propParts = [`cursor="${cursorName}"`];
  if (options.size !== undefined) propParts.push(`size={${options.size}}`);
  if (options.speed !== undefined) propParts.push(`speed={${options.speed}}`);
  if (options.color) propParts.push(`color="${options.color}"`);
  const componentTag = `<Curases ${propParts.join(" ")} />`;

  if (target.type === "next-app") {
    // If already imported and has component
    if (content.includes("<Curases")) {
      // Replace existing component tag
      const updated = content.replace(/<Curases[^>]*\/>/g, componentTag);
      writeFileSync(target.filePath, updated, "utf-8");
      console.log(`  ${c.green}✔ Updated ${c.bold}${cursorName}${c.reset}${c.green} cursor in ${relPath}${c.reset}`);
      return;
    }

    let updated = content;

    // Add import
    const importStatement = `import { Curases } from "curases/react";\n`;
    if (!updated.includes('from "curases/react"')) {
      if (updated.startsWith('"use client"') || updated.startsWith("'use client'")) {
        const firstLineEnd = updated.indexOf("\n");
        updated = updated.slice(0, firstLineEnd + 1) + importStatement + updated.slice(firstLineEnd + 1);
      } else {
        updated = importStatement + updated;
      }
    }

    // Insert inside <body>
    if (updated.includes("<body")) {
      updated = updated.replace(/(<body[^>]*>)/i, `$1\n        ${componentTag}`);
    } else {
      updated += `\n// Note: Place ${componentTag} inside your root <body>\n`;
    }

    writeFileSync(target.filePath, updated, "utf-8");
    console.log(`  ${c.green}✔ Injected ${c.bold}${componentTag}${c.reset}${c.green} into ${relPath}${c.reset}`);
  } else if (target.type === "react" || target.type === "next-pages") {
    if (content.includes("<Curases")) {
      const updated = content.replace(/<Curases[^>]*\/>/g, componentTag);
      writeFileSync(target.filePath, updated, "utf-8");
      console.log(`  ${c.green}✔ Updated cursor to ${c.bold}${cursorName}${c.reset} in ${relPath}`);
      return;
    }

    let updated = content;
    const importStatement = `import { Curases } from "curases/react";\n`;
    if (!updated.includes('from "curases/react"')) {
      updated = importStatement + updated;
    }

    // Insert into root fragment or div if found
    if (updated.includes("return (")) {
      updated = updated.replace(/return\s*\(\s*(<[^>]+>)/, `return (\n    $1\n      ${componentTag}`);
    }

    writeFileSync(target.filePath, updated, "utf-8");
    console.log(`  ${c.green}✔ Injected ${c.bold}${componentTag}${c.reset}${c.green} into ${relPath}${c.reset}`);
  } else if (target.type === "html") {
    const scriptAttrs = [`data-cursor="${cursorName}"`];
    if (options.size !== undefined) scriptAttrs.push(`data-size="${options.size}"`);
    if (options.speed !== undefined) scriptAttrs.push(`data-speed="${options.speed}"`);
    if (options.color) scriptAttrs.push(`data-color="${options.color}"`);
    const scriptTag = `<script src="${DEFAULT_CDN}/engine.js" ${scriptAttrs.join(" ")} defer></script>`;

    if (content.includes("/engine.js")) {
      const updated = content.replace(/<script[^>]*\/engine\.js[^>]*><\/script>/g, scriptTag);
      writeFileSync(target.filePath, updated, "utf-8");
      console.log(`  ${c.green}✔ Updated CDN script in ${relPath}${c.reset}`);
      return;
    }

    let updated = content;
    if (updated.includes("</head>")) {
      updated = updated.replace("</head>", `  ${scriptTag}\n</head>`);
    } else {
      updated += `\n${scriptTag}\n`;
    }

    writeFileSync(target.filePath, updated, "utf-8");
    console.log(`  ${c.green}✔ Injected CDN script tag into ${relPath}${c.reset}`);
  }
}

async function main() {
  const { cursor: rawCursor, options } = parseArgs(process.argv.slice(2));

  if (options.help) {
    printHelp();
    process.exit(0);
  }

  if (options.version) {
    console.log("curases v0.2.0");
    process.exit(0);
  }

  console.log(`\n${c.bold}${c.cyan}✨ Curases CLI${c.reset}\n`);

  if (options.list) {
    const list = await fetchAvailableCursors();
    console.log(`${c.bold}Available Cursors:${c.reset}`);
    list.forEach((name) => console.log(`  • ${c.green}${name}${c.reset}`));
    console.log(`\nInstall any cursor with: ${c.dim}npx curases <name>${c.reset}\n`);
    process.exit(0);
  }

  let cursorName = rawCursor;

  if (!cursorName) {
    const available = await fetchAvailableCursors();
    console.log(`Available cursors: ${available.map((cName) => `${c.green}${cName}${c.reset}`).join(", ")}`);
    const answer = await promptUser(`? Which cursor would you like to use? [${c.cyan}Handy${c.reset}]: `);
    cursorName = answer || "Handy";
  }

  // Capitalize properly (e.g. handy -> Handy)
  cursorName = cursorName.charAt(0).toUpperCase() + cursorName.slice(1);

  const cwd = process.cwd();
  const target = detectTargetFile(cwd);

  if (!target) {
    console.log(`${c.yellow}⚠ Could not automatically detect a layout file or index.html in this directory.${c.reset}`);
    console.log(`\nYou can use it manually by running:`);
    console.log(`  ${c.cyan}npm install curases${c.reset}`);
    console.log(`\nAnd adding to your component:`);
    console.log(`  ${c.dim}import { Curases } from "curases/react";${c.reset}`);
    console.log(`  ${c.dim}<Curases cursor="${cursorName}" />${c.reset}\n`);
    process.exit(0);
  }

  const frameworkLabel = {
    "next-app": "Next.js (App Router)",
    "next-pages": "Next.js (Pages Router)",
    "react": "React / Vite",
    "html": "Static HTML",
  }[target.type];

  console.log(`  ${c.cyan}🔍 Detected project:${c.reset} ${c.bold}${frameworkLabel}${c.reset}`);

  // If node-based project, ensure curases is installed
  if (target.type !== "html") {
    const pm = detectPackageManager(cwd);
    installPackage(cwd, pm);
  }

  // Inject or update cursor in project
  injectCursor(target, cursorName, options);

  console.log(`\n${c.bold}${c.green}🚀 All set!${c.reset} Your ${c.bold}${cursorName}${c.reset} cursor is configured.`);
  console.log(`${c.dim}Catalog & preview: https://curases.com${c.reset}\n`);
}

main().catch((err) => {
  console.error(`\n${c.red}Error:${c.reset}`, err.message);
  process.exit(1);
});
