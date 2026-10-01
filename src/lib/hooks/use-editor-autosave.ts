"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Autosave draf editor ke `localStorage` (G2.3).
 *
 * Menyimpan `value` (didebounce ~2,5 dtk) ke localStorage di bawah `key`.
 * Saat mount, bila ada draf tersimpan yang BERBEDA dari `initialValue`,
 * draf ditawarkan untuk dipulihkan (banner) — mencegah kehilangan naskah bila
 * tab tertutup/crash.
 *
 * Catatan CONSTRAINTS #6: TANPA `useMemo`/`useCallback`.
 * Catatan React 19 lint: draf awal dibaca lewat **lazy `useState` initializer**
 * (bukan `useEffect`+setState) dan nilai terbaru disimpan ke ref **di dalam
 * effect**, bukan saat render (menghindari "access refs during render").
 */
const DEBOUNCE_MS = 2500;

interface StoredDraft {
  value: string;
  savedAt: number;
}

/** Baca draf tersimpan; kembalikan null bila tak ada / rusak / sama dgn awal. */
function readStoredDraft(key: string, initialValue: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredDraft;
    if (parsed?.value && parsed.value !== initialValue) return parsed.value;
  } catch {
    // localStorage rusak / JSON invalid → abaikan.
  }
  return null;
}

export function useEditorAutosave(
  key: string,
  value: string,
  initialValue: string,
) {
  const [pendingDraft, setPendingDraft] = useState<string | null>(() =>
    readStoredDraft(key, initialValue),
  );
  const valueRef = useRef(value);

  // Simpan (debounce) setiap `value` berubah; ref diperbarui di dalam effect.
  useEffect(() => {
    valueRef.current = value;
    if (pendingDraft !== null) return; // jangan timpa draf sebelum diputuskan.
    const t = setTimeout(() => {
      try {
        if (!value.trim()) {
          window.localStorage.removeItem(key);
        } else {
          const payload: StoredDraft = { value, savedAt: Date.now() };
          window.localStorage.setItem(key, JSON.stringify(payload));
        }
      } catch {
        // kuota penuh → abaikan.
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [key, value, pendingDraft]);

  /** Terapkan draf tersimpan (dipakai tombol "Pulihkan"). */
  function restore(): string | null {
    const v = pendingDraft;
    setPendingDraft(null);
    return v;
  }

  /** Buang draf tersimpan (dipakai tombol "Buang"). */
  function discard() {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // abaikan
    }
    setPendingDraft(null);
  }

  /** Hapus draf (mis. setelah berhasil simpan ke server). */
  function clear() {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // abaikan
    }
  }

  return { pendingDraft, restore, discard, clear };
}
