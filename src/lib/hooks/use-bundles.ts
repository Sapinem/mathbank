"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  BundleRow,
  BundleListResult,
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
    queryFn: async () => {
      // API-05: `GET /api/bundles` kini amplop `{ items, total, limit, offset }`.
      // Komponen daftar mengonsumsi array — kita unwrap `.items` di sini agar
      // kontrak `useBundles(): BundleRow[]` tak berubah (tanpa sentuh UI).
      const page = await api<BundleListResult>(
        `/api/bundles${query ? `?${query}` : ""}`,
      );
      return page.items;
    },
  });
}

/**
 * Daftar paket dengan amplop paginasi penuh (**API-05**).
 *
 * Berbeda dari `useBundles` (yang meng-unwrap `.items` demi kompatibilitas
 * komponen daftar), hook ini mempertahankan `{ items, total, limit, offset }`
 * sehingga UI berpaginasi dapat menampilkan total & jumlah halaman.
 */
export function useBundlesPage(
  filter?: BundlesListFilter & { limit?: number; offset?: number },
) {
  const qs = new URLSearchParams();
  if (filter?.bundleType) qs.set("bundleType", filter.bundleType);
  if (filter?.origin) qs.set("origin", filter.origin);
  if (filter?.limit != null) qs.set("limit", String(filter.limit));
  if (filter?.offset != null) qs.set("offset", String(filter.offset));
  const query = qs.toString();
  return useQuery({
    queryKey: [...bundleKeys.all, "page", filter],
    queryFn: () =>
      api<BundleListResult>(`/api/bundles${query ? `?${query}` : ""}`),
  });
}

/**
 * Ambil SEMUA paket (semua halaman) untuk daftar yang memfilter di sisi klien.
 *
 * LATAR: `GET /api/bundles` dibatasi `limit` (default 20, maksimum 100 sesuai
 * skema zod). `useBundles` hanya mengambil satu halaman pertama sehingga daftar
 * & statistik terpotong pada 20 paket walau `total` sebenarnya jauh lebih besar
 * (mis. 105). Hook ini menelusuri seluruh halaman lalu mengembalikan
 * `{ items, total }` — `total` diambil dari API (bukan panjang array) agar
 * statistik akurat.
 *
 * Filter `bundleType`/`origin` diteruskan ke API (server-side) seperti semula.
 */
export function useAllBundles(filter?: BundlesListFilter) {
  const qs = new URLSearchParams();
  if (filter?.bundleType) qs.set("bundleType", filter.bundleType);
  if (filter?.origin) qs.set("origin", filter.origin);
  const baseQuery = qs.toString();
  return useQuery({
    queryKey: [...bundleKeys.all, "all", filter ?? null],
    queryFn: async (): Promise<{ items: BundleRow[]; total: number }> => {
      const PAGE = 100; // batas maksimum skema API
      const items: BundleRow[] = [];
      let offset = 0;
      let total = 0;
      // Batas iterasi defensif (mis. 50 halaman = 5000 paket) agar tak loop tanpa henti
      // bila API keliru melaporkan `total`.
      for (let i = 0; i < 50; i++) {
        const params = new URLSearchParams(baseQuery);
        params.set("limit", String(PAGE));
        params.set("offset", String(offset));
        const page = await api<BundleListResult>(`/api/bundles?${params.toString()}`);
        items.push(...page.items);
        total = page.total;
        offset += page.items.length;
        if (page.items.length === 0 || offset >= page.total) break;
      }
      return { items, total };
    },
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
