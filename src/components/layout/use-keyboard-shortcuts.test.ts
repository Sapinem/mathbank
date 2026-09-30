import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { GOTO_SHORTCUTS, useKeyboardShortcuts } from "./use-keyboard-shortcuts";

/**
 * Tes pintasan keyboard global (M15) — `/`, `?`, dan `g`+huruf.
 *
 * Menggunakan `renderHook` dengan `useRouter` yang dimock. Memverifikasi jalur
 * nyata: pendengar `keydown` di `document` → efek navigasi/fokus/bantuan.
 */

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

beforeEach(() => push.mockReset());

describe("useKeyboardShortcuts", () => {
  it("'g' lalu 'q' menavigasi ke Bank Soal", () => {
    renderHook(() => useKeyboardShortcuts());
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "g", bubbles: true }));
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "q", bubbles: true }));
    });
    expect(push).toHaveBeenCalledWith(GOTO_SHORTCUTS.q.href);
  });

  it("'g' lalu huruf tak dikenal TIDAK menavigasi", () => {
    renderHook(() => useKeyboardShortcuts());
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "g", bubbles: true }));
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "z", bubbles: true }));
    });
    expect(push).not.toHaveBeenCalled();
  });

  it("'?' memanggil onHelp", () => {
    const onHelp = vi.fn();
    renderHook(() => useKeyboardShortcuts({ onHelp }));
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "?", bubbles: true }));
    });
    expect(onHelp).toHaveBeenCalledOnce();
  });

  it("'/' memfokuskan elemen [data-shortcut-search]", () => {
    const input = document.createElement("input");
    input.setAttribute("data-shortcut-search", "");
    document.body.appendChild(input);
    renderHook(() => useKeyboardShortcuts());
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "/", bubbles: true }));
    });
    expect(document.activeElement).toBe(input);
    input.remove();
  });

  it("pintasan DIABAIKAN saat fokus di kolom input", () => {
    const onHelp = vi.fn();
    renderHook(() => useKeyboardShortcuts({ onHelp }));
    const input = document.createElement("input");
    document.body.appendChild(input);
    act(() => {
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "?", bubbles: true }),
      );
    });
    expect(onHelp).not.toHaveBeenCalled();
    input.remove();
  });

  it("enabled=false → pintasan mati", () => {
    const onHelp = vi.fn();
    renderHook(() => useKeyboardShortcuts({ enabled: false, onHelp }));
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "?", bubbles: true }));
    });
    expect(onHelp).not.toHaveBeenCalled();
  });
});
