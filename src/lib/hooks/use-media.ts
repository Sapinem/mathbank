"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

/**
 * Hook media (G4.5) — React Query, mengikuti pola `use-questions.ts`/`use-ai.ts`.
 *
 * - `useMediaList`   : daftar galeri (paginasi + cari + filter asal)
 * - `useMediaDetail` : satu aset + soal yang memakainya
 * - `useUploadMedia` : unggah gambar (multipart) → shortcode siap sisip
 *
 * Semua lewat route `/api/media*` yang di sisi server memakai `mediaService` —
 * jadi gambar guru selalu terdaftar (bukan orphan).
 */

export interface MediaListItem {
  id: string;
  shortId: string;
  title: string;
  altText: string | null;
  originalImagePath: string | null;
  svgPath: string | null;
  mimeType: string | null;
  fileSize: number | null;
  sourceOrigin: string;
  createdAt: string;
}

export interface MediaListResult {
  data: MediaListItem[];
  total: number;
}

export interface MediaDetail {
  asset: MediaListItem & { caption: string | null; description: string | null };
  usedBy: { questionId: string; role: string; orderIndex: number }[];
}

export const mediaKeys = {
  list: (q: string, origin?: string) => ["media", "list", q, origin ?? "all"] as const,
  detail: (shortId: string) => ["media", "detail", shortId] as const,
};

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
  return json.data as T;
}

/** Daftar aset galeri. `enabled=false` saat dialog tertutup (hindari fetch sia-sia). */
export function useMediaList(q: string, origin: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: mediaKeys.list(q, origin),
    enabled,
    queryFn: () => {
      const params = new URLSearchParams({ limit: "48" });
      if (q) params.set("q", q);
      if (origin) params.set("origin", origin);
      return apiFetch<MediaListResult>(`/api/media?${params.toString()}`);
    },
    staleTime: 30_000,
  });
}

/** Daftar aset dengan paginasi penuh — dipakai halaman /assets. */
export function useMediaPage(opts: {
  q?: string | undefined;
  origin?: string | undefined;
  limit: number;
  offset: number;
}) {
  const { q, origin, limit, offset } = opts;
  return useQuery({
    queryKey: ["media", "page", q ?? "", origin ?? "all", limit, offset] as const,
    queryFn: () => {
      const params = new URLSearchParams({
        limit: String(limit),
        offset: String(offset),
      });
      if (q) params.set("q", q);
      if (origin) params.set("origin", origin);
      return apiFetch<MediaListResult>(`/api/media?${params.toString()}`);
    },
    staleTime: 30_000,
  });
}

/** Daftar aset orphan (tak dipakai soal mana pun) — panel hygiene G4.6. */
export function useOrphanAssets(enabled: boolean) {
  return useQuery({
    queryKey: ["media", "orphans"] as const,
    enabled,
    queryFn: () =>
      apiFetch<{ data: MediaListItem[]; total: number; totalBytes: number }>(
        "/api/media/orphans",
      ),
    staleTime: 10_000,
  });
}

/** Hapus aset beserta berkasnya. Menolak (409) bila masih dipakai soal. */
export function useDeleteMedia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (shortId: string) => {
      const res = await fetch(`/api/media/${shortId}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
      return json.data as { shortId: string; filesRemoved: number };
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["media"] });
    },
  });
}

/** Detail satu aset + daftar soal yang memakainya. */
export function useMediaDetail(shortId: string | null) {
  return useQuery({
    queryKey: mediaKeys.detail(shortId ?? ""),
    enabled: Boolean(shortId),
    queryFn: () => apiFetch<MediaDetail>(`/api/media/${shortId}`),
    staleTime: 30_000,
  });
}

/** Hasil unggah: aset + shortcode siap sisip ke markdown. */
export interface UploadMediaResult {
  id: string;
  shortId: string;
  shortcode: string;
  reused: boolean;
}

/** Unggah gambar → shortcode. Setelah sukses, daftar galeri di-invalidate. */
export function useUploadMedia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return apiFetch<UploadMediaResult>("/api/media/upload", { method: "POST", body: form });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["media"] });
    },
  });
}
