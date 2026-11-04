export {};

declare global {
  interface Window {
    Curases?: {
      load: (id: string) => void;
      setSize: (size: number) => void;
      setSpeed: (speed: number) => void;
      setColor: (color: string) => void;
      setRoughness?: (roughness: number) => void;
      setBoil?: (boil: number) => void;
      setOutline?: (outline: number) => void;
      state: (state: string) => void;
      show: () => void;
      hide: () => void;
    };
  }
}
