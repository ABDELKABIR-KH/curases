# Curases

Dynamic, hardware-accelerated custom cursor engine for the web, React, and Next.js.

Live demo & catalog: [curases.com](https://curases.com)

---

## ⚡ Instant Setup with `npx` (Recommended)

Run this command inside any Next.js, React, Vite, or HTML project:

```bash
npx curases handy
# or pick from the interactive menu:
npx curases
```

The CLI automatically:
1. Detects your framework (Next.js App Router, Pages Router, Vite, or static HTML).
2. Installs the `curases` package via your preferred package manager (npm, pnpm, yarn, or bun).
3. Injects `<Curases cursor="Handy" />` into your layout file or HTML header.

---

## Manual Installation

```bash
npm install curases
# or yarn add curases / pnpm add curases / bun add curases
```

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
| `edgeDive` | `boolean \| object` | `true` | Predictive edge-dive / magnetic capture. Pass `false` to disable, or `{ edgeBuffer, outerMargin, magneticRadius, magneticStrength, exitThreshold, autoSuppressFlushSides, edges, scope }` to tune it |
| `hideNativeCursor` | `boolean` | `true` | Hides the default browser cursor via injected CSS |
| `cdnUrl` | `string` | `"https://www.curases.com"` | Custom engine CDN URL |

### Predictive edge dive & magnetic capture

By default the cursor predicts an imminent viewport exit and then behaves like
it is being pulled into a virtual dive horizon `18px` inside the nearest
boundary. An outer `48px` prediction zone (measured from the raw edge) adds
subtle pitch/scale anticipation, while a `32px` inner well applies an ease-out
magnetic lead that races the rendered cursor ahead of the physical pointer. The
cursor leans with `rotateZ` (up to `15deg`) plus forward pitch (up to `45deg`),
collapses to `scale = 0` exactly on the virtual horizon — roughly `18px`
**before** the pointer reaches the border — and blends X/Y vectors at corners so
diagonal exits dive into the vertex.

Parallel movement along an edge does not trigger capture because exit
confidence is weighted by the cosine of the trajectory against the outward edge
normal. Slow movement inside the buffer (without exit velocity) keeps the
cursor on the pointer so edge controls stay usable. Captured edges hold for
`120ms` (or until the pointer reverses inward) to prevent boundary flicker.
Re-entry from any edge spawns the cursor `6px` outside at `scale = 0`, pitched
`45deg` inward, holds it submerged while the pointer crosses the `18px` buffer,
then an underdamped spring (`stiffness: 320`, `damping: 20`) pops it back onto
the pointer.

When the active bounds fill the browser viewport width, left/right edge dives
are automatically suppressed (top/bottom remain active) so the cursor doesn't
fight the OS/browser edge. Partial-width containers keep all four edges
active. On suppressed sides, a fast impact triggers a tactile wall-bump
(squash, micro-shiver, and a brief procedural-boil pulse); slow slides stay
stable. Override with `autoSuppressFlushSides: false`, a per-edge `edges`
mask, or `wallBump: false` / `wallBumpIntensity`.

```tsx
<Curases
  cursor="Handy"
  edgeDive={{
    edgeBuffer: 18,        // virtual horizon inset from the raw edge
    outerMargin: 48,       // px prediction zone (from raw edge)
    magneticRadius: 32,    // px capture well (from raw edge)
    magneticStrength: 1,   // ease-out lead multiplier
    exitThreshold: 0.35,   // px/ms for full confidence
    autoSuppressFlushSides: true, // disable left/right when flush to viewport width
    // edges: { top: true, bottom: true, left: true, right: true },
    scope: "#stage",       // optional container boundary
  }}
/>
```

Pass `edgeDive={false}` to disable the effect.

---

## Zero-Install CDN Script Tag

For Webflow, Shopify, Framer, or static HTML sites without npm:

```html
<script src="https://www.curases.com/engine.js" data-cursor="Handy" defer></script>
```

---

## License

MIT © [Curases](https://curases.com)
