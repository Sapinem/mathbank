"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Peta pintasan "g lalu huruf" (M15) — pola gaya Linear/GitHub.
 * Tekan `g`, lepas, lalu huruf tujuan dalam ~1 detik.
 */
export const GOTO_SHORTCUTS: Record<string, { href: string; label: string }> = {
  d: { href: "/", label: "Dasbor" },
  q: { href: "/questions", label: "Bank Soal" },
  r: { href: "/review", label: "Telaah" },
  b: { href: "/bundles", label: "Paket Soal" },
  t: { href: "/references/topics", label: "Topik" },
  s: { href: "/system/settings", label: "Pengaturan" },
};

/** Abaikan pintasan saat fokus ada di kolom input/editor. */
function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    el.isContentEditable
  );
}

/**
 * Pintasan keyboard global (M15).
 *
 * - `/`  → buka pencarian (command palette) via `onSearch`, atau fokus elemen
 *          `[data-shortcut-search]`/`input[type=search]` bila ada
 * - `g` lalu huruf → navigasi cepat (lihat `GOTO_SHORTCUTS`)
 * - `?`  → buka dialog bantuan (dikelola `onHelp`)
 *
 * `⌘K`/`Ctrl+K` (command palette) ditangani terpisah di `CommandPalette`.
 */
export function useKeyboardShortcuts({
  enabled = true,
  onHelp,
  onSearch,
}: {
  enabled?: boolean;
  onHelp?: () => void;
  onSearch?: () => void;
} = {}) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;
    let pendingG = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    function resetG() {
      pendingG = false;
      if (timer) clearTimeout(timer);
    }

    function onKey(e: KeyboardEvent) {
      const typing = isTypingTarget(e.target);
      // `?` (Shift+/) untuk bantuan — abaikan saat mengetik.
      if (e.key === "?" && !typing) {
        e.preventDefault();
        onHelp?.();
        return;
      }
      // `/` buka pencarian — abaikan saat mengetik.
      if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (onSearch) {
          e.preventDefault();
          onSearch();
          return;
        }
        const el = document.querySelector<HTMLElement>(
          "[data-shortcut-search], input[type='search']",
        );
        if (el) {
          e.preventDefault();
          el.focus();
        }
        return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;

      if (pendingG) {
        const target = GOTO_SHORTCUTS[e.key.toLowerCase()];
        if (target) {
          e.preventDefault();
          resetG();
          router.push(target.href);
        } else {
          resetG();
        }
        return;
      }
      if (e.key === "g") {
        pendingG = true;
        timer = setTimeout(() => {
          pendingG = false;
        }, 1200);
      }
    }

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (timer) clearTimeout(timer);
    };
  }, [enabled, onHelp, onSearch, router]);
}
