<p align="start">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/logo-dark.svg">
    <img src="assets/logo-light.svg" alt="Curases" width="640">
  </picture>
</p>

<p align="start">
  <a href="https://www.npmjs.com/package/curases">
    <img src="https://img.shields.io/npm/v/curases?style=flat-square&color=2563eb" alt="npm version">
  </a>
  <a href="https://www.npmjs.com/package/curases">
    <img src="https://img.shields.io/npm/dt/curases?style=flat-square&color=2563eb" alt="npm downloads">
  </a>
</p>

<p align="start">
  <a href="https://curases.com"><strong>Curases</strong></a> is a zero-dependency, ultra-lightweight custom cursor engine designed for modern web applications and AI coding agents.
</p>

## Quickstart

### npm

```bash
npm install curases
```

```tsx
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

### CDN

```html
<script src="https://curases.com/engine.js" data-cursor="Handy" defer></script>
```

Full documentation and cursor catalog: [curases.com](https://curases.com)

---

<details>
<summary>Local development</summary>

```bash
npm install
npm run dev
npm run build
```

</details>

## License

MIT © [Curases](https://curases.com)
