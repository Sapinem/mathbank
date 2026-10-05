"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  BundleRow,
  BundleType,
  BundleOrigin,
  BundleValidation,
} from "@/lib/services/bundle-service";
import { api } from "@/lib/api/fetcher";

/**
 * Hook paket soal (L3) — daftar, detail, item, mutasi.
 *
 * ⚠️ Hanya memanggil `/api/**` lewat fetch; TIDAK mengimpor service (yang
 * menarik `@/lib/db`). Tipe diimpor `import type` (terhapus saat build).
 *
 * MAT-40: dukung filter URL-driven `?type=source|exam` & `?origin=ingest|manual`.
 */
export const bundleKeys = {
  all: ["bundles"] as const,
  detail: (id: string) => ["bundles", id] as const,
};

/** Baris item pada detail paket (soal ter-proyeksi). */
export interface BundleOptionView {
  id: string;
  label: string;
  contentMarkdown: string;
  orderIndex: number;
  /** Hanya ada bila aktor boleh melihat kunci. */
  isCorrect?: boolean;
  distractorRationale?: string | null;
}

export interface BundleItemView {
  item: {
    id: string;
    bundleId: string;
    questionId: string;
    role: "question" | "stimulus";
    orderIndex: number;
    sectionName: string | null;
    itemNumber: string | null;
    notes: string | null;
  };
  question: {
    id: string;
    contentMarkdown: string;
    questionType: string;
    status: string;
    dataPayload?: unknown;
    /** Hanya ada bila aktor boleh melihat kunci. */
    answerKey?: {
      correct?: string[];
      text?: string;
      explanation?: string;
    } | null;
    options: BundleOptionView[];
  };
}

export interface BundleDetail extends BundleRow {
  items: BundleItemView[];
}

/**
 * Filter opsional untuk `useBundles` (MAT-40 — URL-driven).
 * Meneruskan `bundleType` & `origin` ke API sebagai query string.
 */
export interface BundlesListFilter {
  bundleType?: BundleType;
  origin?: BundleOrigin;
}

export function useBundles(filter?: BundlesListFilter) {
  const qs = new URLSearchParams();
  if (filter?.bundleType) qs.set("bundleType", filter.bundleType);
  if (filter?.origin) qs.set("origin", filter.origin);
  const query = qs.toString();
  return useQuery({
    queryKey: query
      ? [...bundleKeys.all, filter]
      : bundleKeys.all,
    queryFn: () =>
      api<BundleRow[]>(`/api/bundles${query ? `?${query}` : ""}`),
  });
}

export function useBundle(id: string | null) {
  return useQuery({
    queryKey: bundleKeys.detail(id ?? ""),
    queryFn: () => api<BundleDetail>(`/api/bundles/${id}`),
    enabled: Boolean(id),
  });
}

export function useBundleValidation(id: string | null) {
  return useQuery({
    queryKey: ["bundles", id, "validate"],
    queryFn: () => api<BundleValidation>(`/api/bundles/${id}/validate`),
    enabled: Boolean(id),
  });
}

export function useCreateBundle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { title: string; bundleType: BundleType }) =>
      api<BundleRow>("/api/bundles", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: bundleKeys.all }),
  });
}

export function useUpdateBundle(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Record<string, unknown>) =>
      api<BundleRow>(`/api/bundles/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: bundleKeys.all });
      qc.invalidateQueries({ queryKey: bundleKeys.detail(id) });
    },
  });
}

export function useArchiveBundle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ ok: boolean }>(`/api/bundles/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: bundleKeys.all }),
  });
}

export function useDuplicateBundle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<BundleRow>(`/api/bundles/${id}/duplicate`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: bundleKeys.all }),
  });
}

export function useAddBundleItem(bundleId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { questionId: string; role?: "question" | "stimulus" }) =>
      api<unknown>(`/api/bundles/${bundleId}/items`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: bundleKeys.detail(bundleId) }),
  });
}

export function useRemoveBundleItem(bundleId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) =>
      api<{ ok: boolean }>(`/api/bundles/${bundleId}/items/${itemId}`, {
        method: "DELETE",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: bundleKeys.detail(bundleId) }),
  });
}

export function useReorderBundleItems(bundleId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemIds: string[]) =>
      api<{ ok: boolean }>(`/api/bundles/${bundleId}/items`, {
        method: "PUT",
        body: JSON.stringify({ itemIds }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: bundleKeys.detail(bundleId) }),
  });
}
