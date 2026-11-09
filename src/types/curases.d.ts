export {};

declare global {
  interface Window {
    Curases?: {
      load: (id: string) => void;
      setSize: (size: number) => void;
      setSpeed: (speed: number) => void;
      setColor: (color: string) => void;
      setEdgeDive?: (
        edgeDive:
          | boolean
          | {
              enabled?: boolean;
              edgeBuffer?: number;
              outerMargin?: number;
              magneticRadius?: number;
              magneticStrength?: number;
              exitThreshold?: number;
              autoSuppressFlushSides?: boolean;
              edges?: {
                top?: boolean;
                bottom?: boolean;
                left?: boolean;
                right?: boolean;
              };
              wallBump?: boolean;
              wallBumpIntensity?: number;
              margin?: number;
              lookahead?: number;
              scope?: string | HTMLElement | null;
              stiffness?: number;
              damping?: number;
            }
      ) => void;
      setRoughness?: (roughness: number) => void;
      setBoil?: (boil: number) => void;
      setOutline?: (outline: number) => void;
      state: (state: string) => void;
      show: () => void;
      hide: () => void;
    };
  }
}
