# Curases — The Agentic Custom Cursor Engine for the Web

Curases is a zero-dependency, ultra-lightweight custom cursor engine designed for modern web applications and AI coding agents.

- **Website:** [https://curases.com](https://curases.com)
- **Engine CDN:** `https://curases.com/engine.js`
- **Agent Guide:** `https://curases.com/llms.txt`
- **Full Spec:** `https://curases.com/llms-full.txt`
- **Registry API:** `https://curases.com/api/registry`

---

## ⚡ Quickstart

### 1. HTML / CDN (Any Stack)
```html
<script 
  src="https://curases.com/engine.js" 
  data-cursor="Blue" 
  data-size="1.5" 
  data-speed="1.0" 
  defer>
</script>
```

### 2. Next.js (App Router `layout.tsx`)
```tsx
import Script from "next/script";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <Script
          src="https://curases.com/engine.js"
          strategy="afterInteractive"
          data-cursor="Blue"
          data-size="1.5"
          data-speed="1.0"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

### 3. AI Agent Ready Prompt
> "Install the Curases custom cursor engine in this project using the 'Blue' cursor style with size 1.5 and speed 1.0. Reference documentation from https://curases.com/llms.txt."

---

## 🛠 Local Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Rebuild the obfuscated engine after editing src/engine/engine.source.js
npm run engine:build

# Build for production (also rebuilds the obfuscated engine)
npm run build
```

Deployed seamlessly to **Vercel** with automatic CORS headers on `/engine.js` and the origin-gated `/api/cursors/*` endpoint.

---

## 🔒 Engine & Asset Protection

The shipped engine is generated from `src/engine/engine.source.js` by
`scripts/build-engine.mjs`. Production builds are obfuscated with identifier
mangling, string-array encryption, control-flow flattening, anti-debug traps,
and self-defending (anti-beautify) code.

Cursor packs are **not** in `public/`. They live in `src/data/cursors/` and are
only served through `GET /api/cursors/{file}`. The manifest stays public so the
engine can discover packs, but the SVG datasets are origin-gated.

Configure access with environment variables:

| Variable | Purpose |
| --- | --- |
| `CURASES_ALLOWED_ORIGINS` | Comma-separated full origins allowed to fetch cursor packs, e.g. `https://acme.com,https://app.acme.com`. `curases.com`, `www.curases.com`, and local dev origins are always allowed. |
| `CURASES_API_KEY` | Optional shared secret. When set, the engine must send `data-key="..."` on its script tag (or `window.__CURSOR_ASSET_KEY__`). |
| `CURASES_PUBLIC_CDN` | Set to `true` to allow every origin (legacy public-CDN mode). Direct navigation is still blocked. |
| `CURASES_ALLOW_SERVER_REQUESTS` | Set to `true` to allow non-browser clients with no `Origin`/`Referer` in production. |
| `CURASES_ENGINE_CSP_SAFE` | Set to `true` to disable the eval-based anti-debug/self-defending traps for strict CSP sites. |
| `CURASES_DEBUG_PROTECTION` | Set to `false` to disable the DevTools freeze trap. |

