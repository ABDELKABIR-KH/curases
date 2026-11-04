import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  /* config options here */
  async headers() {
    const corsHeaders = [
      { key: "Access-Control-Allow-Origin", value: "*" },
      { key: "Access-Control-Allow-Methods", value: "GET, OPTIONS, HEAD" },
      { key: "Access-Control-Allow-Headers", value: "*" },
    ];

    // The engine itself must always revalidate so local edits (and new
    // releases) are picked up on a normal reload instead of being served
    // stale for an hour. Cursor packs can keep their longer asset cache.
    const engineCache =
      process.env.NODE_ENV === "production"
        ? "public, max-age=0, must-revalidate"
        : "no-store, max-age=0";

    return [
      {
        source: "/(engine.js|cursor-engine.js|llms.txt|llms-full.txt)",
        headers: [...corsHeaders, { key: "Cache-Control", value: engineCache }],
      },
      {
        source: "/(cursors/:path*|api/:path*)",
        headers: [
          ...corsHeaders,
          {
            key: "Cache-Control",
            value: "public, max-age=3600, stale-while-revalidate=86400",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
