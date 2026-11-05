import { CurasesOptions, CurasesInstance } from './index.js';

type CurasesProps = CurasesOptions;
/**
 * React hook to initialize and manage Curases custom cursor.
 */
declare function useCurases(options?: CurasesOptions): React.MutableRefObject<CurasesInstance | null>;
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
declare function Curases(props: CurasesProps): null;

export { Curases, type CurasesProps, Curases as default, useCurases };
