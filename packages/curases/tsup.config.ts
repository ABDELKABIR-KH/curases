import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["src/index.ts", "src/react.tsx"],
    format: ["cjs", "esm"],
    dts: true,
    clean: true,
    minify: true,
    sourcemap: true,
    external: ["react", "react-dom"],
  },
  {
    entry: ["src/cli.ts"],
    format: ["cjs"],
    minify: true,
    banner: {
      js: "#!/usr/bin/env node",
    },
    clean: false,
  },
]);
