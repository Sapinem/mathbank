import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDebouncedSearchParam } from "./use-debounced-search-param";

let currentParams = new URLSearchParams();
const replaceMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: replaceMock,
  }),
  useSearchParams: () => currentParams,
}));

describe("useDebouncedSearchParam", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    currentParams = new URLSearchParams();
    replaceMock.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("mengembalikan nilai awal dari searchParams", () => {
    currentParams = new URLSearchParams("q=aljabar");
    const { result } = renderHook(() => useDebouncedSearchParam("/questions"));

    expect(result.current[0]).toBe("aljabar");
  });

  it("memperbarui nilai lokal seketika dan men-debounce router.replace selama 300ms", () => {
    const { result } = renderHook(() => useDebouncedSearchParam("/questions"));

    act(() => {
      result.current[1]("geometri");
    });

    expect(result.current[0]).toBe("geometri");
    expect(replaceMock).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(replaceMock).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(replaceMock).toHaveBeenCalledWith("/questions?q=geometri", { scroll: false });
  });

  it("menghapus parameter page dari URL saat kata kunci pencarian berubah", () => {
    currentParams = new URLSearchParams("page=3&status=ready");
    const { result } = renderHook(() => useDebouncedSearchParam("/bundles"));

    act(() => {
      result.current[1]("ujian");
    });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(replaceMock).toHaveBeenCalledWith("/bundles?status=ready&q=ujian", { scroll: false });
  });

  it("menghapus parameter kata kunci dari URL bila input dikosongkan atau hanya spasi", () => {
    currentParams = new URLSearchParams("q=aljabar&status=ready");
    const { result } = renderHook(() => useDebouncedSearchParam("/questions"));

    act(() => {
      result.current[1]("   ");
    });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(replaceMock).toHaveBeenCalledWith("/questions?status=ready", { scroll: false });
  });

  it("menyinkronkan state lokal saat searchParams eksternal berubah", () => {
    currentParams = new URLSearchParams("q=awal");
    const { result, rerender } = renderHook(() => useDebouncedSearchParam("/questions"));
    expect(result.current[0]).toBe("awal");

    currentParams = new URLSearchParams("q=baru");
    rerender();
    expect(result.current[0]).toBe("baru");
  });
});
