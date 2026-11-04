interface CurasesOptions {
    /**
     * Cursor identifier or preset name (e.g. "Handy").
     * @default "Handy"
     */
    cursor?: string;
    /**
     * Size scaling factor (1 = 32px base size).
     * @default 1.5
     */
    size?: number;
    /**
     * Smooth movement lerp factor (1 = instant 1:1 hardware, lower = smooth fluid trailing).
     * @default 1
     */
    speed?: number;
    /**
     * Optional color override for cursor vectors (e.g. "#2563eb"). Empty string keeps natural SVG colors.
     * @default ""
     */
    color?: string;
    /**
     * Whether to inject global CSS hiding the default system cursor.
     * @default true
     */
    hideNativeCursor?: boolean;
    /**
     * The CDN base URL serving the cursor engine and assets.
     * @default "https://www.curases.com"
     */
    cdnUrl?: string;
}
interface CurasesInstance {
    setCursor: (id: string) => void;
    setSize: (size: number) => void;
    setSpeed: (speed: number) => void;
    setColor: (color: string) => void;
    setVisibility: (visible: boolean) => void;
    destroy: () => void;
}
declare global {
    interface Window {
        __CURSOR_ASSET_BASE__?: string;
        __CURSOR_SETTINGS__?: {
            id?: string;
            size?: number;
            speed?: number;
            color?: string;
        };
        __customCursorEngineLoaded?: boolean;
        CustomCursor?: {
            load: (id: string) => void;
            speed: (speed: number) => void;
            size: (size: number) => void;
            color: (color: string) => void;
            state: (state: string) => void;
            visibility: (visible: boolean) => void;
            applySettings: (settings: {
                id?: string;
                size?: number;
                speed?: number;
                color?: string;
            }) => void;
        };
    }
}
declare function initCurases(options?: CurasesOptions): Promise<CurasesInstance>;
declare function destroyCurases(): void;

export { type CurasesInstance, type CurasesOptions, destroyCurases, initCurases };
