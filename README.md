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

# Build for production
npm run build
```

Deployed seamlessly to **Vercel** with automatic CORS headers on `/engine.js` and `/cursors/*`.
