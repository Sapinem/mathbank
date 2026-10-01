"use client";

import { useSyncExternalStore } from "react";

const MOBILE_BREAKPOINT = 1024;

/**
 * Apakah layar saat ini "mobile" (< breakpoint).
 *
 * Memakai `useSyncExternalStore` (pola resmi React untuk sistem luar) alih-alih
 * `useState`+`useEffect` versi bawaan shadcn — supaya mematuhi larangan
 * setState-in-effect (CONSTRAINTS #6, React Compiler).
 *
 * Batas kunci `lg` (1024px) sesuai RENCANA-UI-MOBILE.md §0 dan CONSTRAINTS #14:
 * di bawah 1024px, sidebar beralih menjadi drawer on-demand agar tablet tidak terhimpit.
 */
function subscribe(cb: () => void) {
  const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
  mql.addEventListener("change", cb);
  return () => mql.removeEventListener("change", cb);
}

function getSnapshot() {
  return window.innerWidth < MOBILE_BREAKPOINT;
}

function getServerSnapshot() {
  return false;
}

export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
