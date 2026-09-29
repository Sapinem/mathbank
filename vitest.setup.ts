import "@testing-library/jest-dom/vitest";

/**
 * jsdom tak punya `window.matchMedia`. Beberapa komponen (SidebarProvider,
 * DesktopOnly) memakainya via `useMediaQuery`. Stub default = **desktop**
 * (`matches: true`) agar render tidak memicu cabang mobile tak sengaja.
 * Tes yang perlu mobile menimpanya sendiri (lihat desktop-only.test.tsx).
 */
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: true,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}
