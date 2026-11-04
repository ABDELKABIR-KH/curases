# Curases

Dynamic, hardware-accelerated custom cursor engine for the web, React, and Next.js.

Live demo & catalog: [curases.com](https://curases.com)

---

## Installation

```bash
npm install curases
# or
yarn add curases
# or
pnpm add curases
# or
bun add curases
```

---

## Usage

### Next.js (App Router) & React

Drop `<Curases />` into your root layout:

```tsx
// app/layout.tsx
import { Curases } from "curases/react";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Curases cursor="Handy" size={1.5} speed={1} />
        {children}
      </body>
    </html>
  );
}
```

### Vanilla JavaScript / Vite / Astro

```ts
import { initCurases } from "curases";

const curases = await initCurases({
  cursor: "Handy",
  size: 1.5,
  speed: 1,
  color: "#2563eb",
});

// Runtime API controls:
curases.setColor("#ef4444");
curases.setSize(2);
curases.destroy();
```

---

## Configuration Options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `cursor` | `string` | `"Handy"` | Cursor preset name from the Curases catalog |
| `size` | `number` | `1.5` | Size scale multiplier (`1` = 32px base size) |
| `speed` | `number` | `1` | Smooth lerp speed (`1` = instant 1:1, `< 1` = fluid trail) |
| `color` | `string` | `""` | Hex color code override (empty keeps natural colors) |
| `hideNativeCursor` | `boolean` | `true` | Hides the default browser cursor via injected CSS |
| `cdnUrl` | `string` | `"https://www.curases.com"` | Custom engine CDN URL |

---

## Alternative: Zero-Install CDN Script Tag

For Webflow, Shopify, Framer, or static HTML sites without npm:

```html
<script src="https://www.curases.com/engine.js" data-cursor="Handy" defer></script>
```

---

## License

MIT © [Curases](https://curases.com)
