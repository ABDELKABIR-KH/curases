"use client";

import { useEffect, useRef } from "react";
import { initCurases, destroyCurases, type CurasesOptions, type CurasesInstance } from "./index";

export type CurasesProps = CurasesOptions;

/**
 * React hook to initialize and manage Curases custom cursor.
 */
export function useCurases(options: CurasesOptions = {}): React.MutableRefObject<CurasesInstance | null> {
  const instanceRef = useRef<CurasesInstance | null>(null);

  const { cursor, size, speed, color, edgeDive, hideNativeCursor, cdnUrl } = options;

  useEffect(() => {
    let cancelled = false;

    initCurases({
      cursor,
      size,
      speed,
      color,
      edgeDive,
      hideNativeCursor,
      cdnUrl,
    }).then((instance) => {
      if (!cancelled) {
        instanceRef.current = instance;
      }
    });

    return () => {
      cancelled = true;
      destroyCurases();
      instanceRef.current = null;
    };
  }, [hideNativeCursor, cdnUrl]);

  // Handle dynamic prop changes without re-injecting the script
  useEffect(() => {
    if (!instanceRef.current) return;
    if (cursor !== undefined) instanceRef.current.setCursor(cursor);
  }, [cursor]);

  useEffect(() => {
    if (!instanceRef.current) return;
    if (size !== undefined) instanceRef.current.setSize(size);
  }, [size]);

  useEffect(() => {
    if (!instanceRef.current) return;
    if (speed !== undefined) instanceRef.current.setSpeed(speed);
  }, [speed]);

  useEffect(() => {
    if (!instanceRef.current) return;
    if (color !== undefined) instanceRef.current.setColor(color);
  }, [color]);

  useEffect(() => {
    if (!instanceRef.current) return;
    if (edgeDive !== undefined) instanceRef.current.setEdgeDive(edgeDive);
  }, [edgeDive]);

  return instanceRef;
}

/**
 * Drop-in React component for Next.js and React applications.
 *
 * @example
 * ```tsx
 * import { Curases } from "curases/react";
 *
 * export default function RootLayout({ children }: { children: React.ReactNode }) {
 *   return (
 *     <html>
 *       <body>
 *         <Curases cursor="Handy" size={1.5} />
 *         {children}
 *       </body>
 *     </html>
 *   );
 * }
 * ```
 */
export function Curases(props: CurasesProps): null {
  useCurases(props);
  return null;
}

export default Curases;
