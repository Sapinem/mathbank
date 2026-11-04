import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import {
  bundleKeys,
  useUpdateBundle,
  useAddBundleItem,
  useRemoveBundleItem,
  useReorderBundleItems,
  useUpdateBundleItemSlot,
} from "./use-bundles";
import type { BundleDetail } from "./use-bundles";

const mockApi = vi.fn();
vi.mock("@/lib/api/fetcher", () => ({
  api: (...args: unknown[]) => mockApi(...args),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return {
    queryClient,
    wrapper: ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children),
  };
}

const initialBundle: BundleDetail = {
  id: "b1",
  version: 1,
  title: "Paket Matematika",
  bundleType: "exam",
  origin: "manual",
  url: null,
  sourceId: null,
  eventId: null,
  year: 2026,
  grade: "10",
  durationMinutes: 90,
  instructions: null,
  printConfig: {},
  status: "draft",
  createdById: "u1",
  itemCount: 1,
  items: [
    {
      item: {
        id: "item-1",
        bundleId: "b1",
        questionId: "q1",
        role: "question",
        orderIndex: 1,
        sectionName: null,
        itemNumber: "1",
        notes: null,
      },
      question: {
        id: "q1",
        contentMarkdown: "Soal 1",
        questionType: "single_choice",
        answerKey: {},
        status: "ready",
        options: [],
      },
    },
  ],
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("use-bundles OCC query cache synchronization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("useUpdateBundle memperbarui versi paket di cache", async () => {
    const { queryClient, wrapper } = createWrapper();
    queryClient.setQueryData(bundleKeys.detail("b1"), initialBundle);

    mockApi.mockResolvedValueOnce({
      ...initialBundle,
      title: "Paket Terbarui",
      version: 2,
    });

    const { result } = renderHook(() => useUpdateBundle("b1"), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ title: "Paket Terbarui" });
    });

    const cached = queryClient.getQueryData<BundleDetail>(bundleKeys.detail("b1"));
    expect(cached?.version).toBe(2);
    expect(cached?.title).toBe("Paket Terbarui");
  });

  it("useAddBundleItem memperbarui versi paket di cache saat butir ditambahkan", async () => {
    const { queryClient, wrapper } = createWrapper();
    queryClient.setQueryData(bundleKeys.detail("b1"), initialBundle);

    mockApi.mockResolvedValueOnce({
      id: "item-2",
      bundleId: "b1",
      questionId: "q2",
      role: "question",
      orderIndex: 2,
      sectionName: null,
      bundleVersion: 3,
    });

    const { result } = renderHook(() => useAddBundleItem("b1"), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ questionId: "q2" });
    });

    await waitFor(() => {
      const cached = queryClient.getQueryData<BundleDetail>(bundleKeys.detail("b1"));
      expect(cached?.version).toBe(3);
    });
  });

  it("useRemoveBundleItem memperbarui versi paket di cache saat butir dihapus", async () => {
    const { queryClient, wrapper } = createWrapper();
    queryClient.setQueryData(bundleKeys.detail("b1"), initialBundle);

    mockApi.mockResolvedValueOnce({
      ok: true,
      bundleVersion: 4,
    });

    const { result } = renderHook(() => useRemoveBundleItem("b1"), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ itemId: "item-1" });
    });

    await waitFor(() => {
      const cached = queryClient.getQueryData<BundleDetail>(bundleKeys.detail("b1"));
      expect(cached?.version).toBe(4);
    });
  });

  it("useReorderBundleItems memperbarui urutan item dan versi paket di cache", async () => {
    const { queryClient, wrapper } = createWrapper();
    queryClient.setQueryData(bundleKeys.detail("b1"), initialBundle);

    mockApi.mockResolvedValueOnce({
      itemIds: ["item-1"],
      bundleVersion: 5,
    });

    const { result } = renderHook(() => useReorderBundleItems("b1"), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ itemIds: ["item-1"] });
    });

    await waitFor(() => {
      const cached = queryClient.getQueryData<BundleDetail>(bundleKeys.detail("b1"));
      expect(cached?.version).toBe(5);
    });
  });

  it("useUpdateBundleItemSlot memperbarui metadata butir dan versi paket di cache", async () => {
    const { queryClient, wrapper } = createWrapper();
    queryClient.setQueryData(bundleKeys.detail("b1"), initialBundle);

    mockApi.mockResolvedValueOnce({
      id: "item-1",
      sectionName: "Bagian A",
      bundleVersion: 6,
    });

    const { result } = renderHook(() => useUpdateBundleItemSlot("b1"), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ itemId: "item-1", patch: { sectionName: "Bagian A" } });
    });

    await waitFor(() => {
      const cached = queryClient.getQueryData<BundleDetail>(bundleKeys.detail("b1"));
      expect(cached?.version).toBe(6);
      expect(cached?.items[0]?.item.sectionName).toBe("Bagian A");
    });
  });
});
