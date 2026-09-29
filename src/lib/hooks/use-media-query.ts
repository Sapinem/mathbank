"use client";

import { useSyncExternalStore } from "react";

/**
 * Media query reactif (Fase R).
 *
 * Memakai `useSyncExternalStore` — pola resmi React untuk sistem luar
 * (matchMedia) — sehingga TIDAK ada setState-in-effect
 * (sesuai larangan React Compiler, CONSTRAINTS #6).
 *
 * @example
 * const isDesktop = useMediaQuery("(min-width: 1024px)");
 */
export function useMediaQuery(query: string): boolean {
  function subscribe(cb: () => void) {
    const mql = window.matchMedia(query);
    mql.addEventListener("change", cb);
    return () => mql.removeEventListener("change", cb);
  }

  function getSnapshot() {
    return window.matchMedia(query).matches;
  }

  // Di server: asumsikan desktop (hindari flash pengalih di SSR).
  function getServerSnapshot() {
    return true;
  }

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
