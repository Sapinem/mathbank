import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useMediaQuery } from "./use-media-query";

/** Tiruan `matchMedia` yang bisa dikendalikan. */
function installMatchMedia(initialMatches: boolean) {
  const listeners = new Set<(e: { matches: boolean }) => void>();
  const state = { matches: initialMatches };
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: state.matches,
    media: query,
    addEventListener: (_: string, cb: (e: { matches: boolean }) => void) => listeners.add(cb),
    removeEventListener: (_: string, cb: (e: { matches: boolean }) => void) => listeners.delete(cb),
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  return {
    state,
    listeners,
    setMatches(v: boolean) {
      state.matches = v;
      listeners.forEach((cb) => cb({ matches: v }));
    },
  };
}

describe("useMediaQuery", () => {
  let mm: ReturnType<typeof installMatchMedia>;

  beforeEach(() => {
    mm = installMatchMedia(true);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("mengembalikan nilai matches awal", () => {
    const { result } = renderHook(() => useMediaQuery("(min-width: 1024px)"));
    expect(result.current).toBe(true);
  });

  it("ikut berubah saat media berubah", () => {
    const { result } = renderHook(() => useMediaQuery("(min-width: 1024px)"));
    expect(result.current).toBe(true);
    act(() => mm.setMatches(false));
    expect(result.current).toBe(false);
    act(() => mm.setMatches(true));
    expect(result.current).toBe(true);
  });

  it("memakai query yang diminta", () => {
    renderHook(() => useMediaQuery("(min-width: 640px)"));
    expect(window.matchMedia).toHaveBeenCalledWith("(min-width: 640px)");
  });

  it("melepas listener saat unmount (tak ada kebocoran)", () => {
    const { unmount } = renderHook(() => useMediaQuery("(min-width: 1024px)"));
    expect(mm.listeners.size).toBeGreaterThan(0);
    unmount();
    expect(mm.listeners.size).toBe(0);
  });
});
