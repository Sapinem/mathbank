import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useEditorAutosave } from "./use-editor-autosave";

describe("useEditorAutosave", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    window.localStorage.clear();
  });

  it("menyimpan value ke localStorage setelah debounce", () => {
    renderHook(({ v }) => useEditorAutosave("draft-q1", v, ""), {
      initialProps: { v: "Naskah soal $x=1$" },
    });
    // belum tersimpan sebelum debounce selesai
    expect(window.localStorage.getItem("draft-q1")).toBeNull();
    act(() => {
      vi.advanceTimersByTime(2600);
    });
    const raw = window.localStorage.getItem("draft-q1");
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!).value).toBe("Naskah soal $x=1$");
  });

  it("menghapus draf bila value kosong", () => {
    window.localStorage.setItem(
      "draft-q2",
      JSON.stringify({ value: "lama", savedAt: 1 }),
    );
    const { rerender } = renderHook(({ v }) => useEditorAutosave("draft-q2", v, "lama"), {
      initialProps: { v: "lama" },
    });
    rerender({ v: "" });
    act(() => {
      vi.advanceTimersByTime(2600);
    });
    expect(window.localStorage.getItem("draft-q2")).toBeNull();
  });

  it("menawarkan pulihkan draf tersimpan yang BEDA dari awal", () => {
    window.localStorage.setItem(
      "draft-q3",
      JSON.stringify({ value: "draf tersimpan", savedAt: 1 }),
    );
    const { result } = renderHook(() => useEditorAutosave("draft-q3", "", ""));
    expect(result.current.pendingDraft).toBe("draf tersimpan");
  });

  it("tidak menawarkan bila draf sama dengan nilai awal", () => {
    window.localStorage.setItem(
      "draft-q4",
      JSON.stringify({ value: "sama", savedAt: 1 }),
    );
    const { result } = renderHook(() => useEditorAutosave("draft-q4", "sama", "sama"));
    expect(result.current.pendingDraft).toBeNull();
  });

  it("restore mengembalikan draf & menutup banner", () => {
    window.localStorage.setItem(
      "draft-q5",
      JSON.stringify({ value: "isi draf", savedAt: 1 }),
    );
    const { result } = renderHook(() => useEditorAutosave("draft-q5", "", ""));
    let restored: string | null = null;
    act(() => {
      restored = result.current.restore();
    });
    expect(restored).toBe("isi draf");
    expect(result.current.pendingDraft).toBeNull();
  });

  it("discard menghapus draf dari localStorage", () => {
    window.localStorage.setItem(
      "draft-q6",
      JSON.stringify({ value: "buang aku", savedAt: 1 }),
    );
    const { result } = renderHook(() => useEditorAutosave("draft-q6", "", ""));
    act(() => {
      result.current.discard();
    });
    expect(window.localStorage.getItem("draft-q6")).toBeNull();
    expect(result.current.pendingDraft).toBeNull();
  });

  it("tahan terhadap JSON rusak di localStorage", () => {
    window.localStorage.setItem("draft-q7", "{bukan json");
    const { result } = renderHook(() => useEditorAutosave("draft-q7", "", ""));
    expect(result.current.pendingDraft).toBeNull();
  });
});
