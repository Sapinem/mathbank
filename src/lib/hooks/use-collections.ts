"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { CollectionRow } from "@/lib/services/collection-service";
import { api } from "@/lib/api/fetcher";

/**
 * Hook koleksi (ADR-0016) — arsip soal **publik**.
 *
 * ⚠️ Impor TIPE dari service aman (type-only, hilang saat build). Jangan impor
 * nilai/fungsi service dari sini — ia menarik `@/lib/db` ke bundle klien.
 */
export const collectionKeys = {
  all: ["collections"] as const,
  detail: (id: string) => ["collections", id] as const,
  items: (id: string) => ["collections", id, "items"] as const,
};

export interface CollectionDetail extends CollectionRow {
  questionIds: string[];
}

export function useCollections() {
  return useQuery({
    queryKey: collectionKeys.all,
    queryFn: () => api<CollectionRow[]>("/api/collections"),
  });
}

export function useCollection(id: string | null) {
  return useQuery({
    queryKey: collectionKeys.detail(id ?? ""),
    queryFn: () => api<CollectionDetail>(`/api/collections/${id}`),
    enabled: !!id,
  });
}

export interface CollectionInput {
  title: string;
  sourceId?: string | null;
  eventId?: string | null;
  year?: number | null;
  grade?: string | null;
  description?: string | null;
}

export function useCreateCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CollectionInput) =>
      api<CollectionRow>("/api/collections", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: collectionKeys.all }),
  });
}

export function useUpdateCollection(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<CollectionInput>) =>
      api<CollectionRow>(`/api/collections/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: collectionKeys.all });
      qc.invalidateQueries({ queryKey: collectionKeys.detail(id) });
    },
  });
}

export function useDeleteCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ ok: boolean }>(`/api/collections/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: collectionKeys.all }),
  });
}

export function useAddCollectionItem(collectionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (questionId: string) =>
      api<unknown>(`/api/collections/${collectionId}/items`, {
        method: "POST",
        body: JSON.stringify({ questionId }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: collectionKeys.detail(collectionId) });
      qc.invalidateQueries({ queryKey: collectionKeys.items(collectionId) });
      qc.invalidateQueries({ queryKey: collectionKeys.all });
    },
  });
}

export function useRemoveCollectionItem(collectionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (questionId: string) =>
      api<{ ok: boolean }>(
        `/api/collections/${collectionId}/items?questionId=${questionId}`,
        { method: "DELETE" },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: collectionKeys.detail(collectionId) });
      qc.invalidateQueries({ queryKey: collectionKeys.items(collectionId) });
      qc.invalidateQueries({ queryKey: collectionKeys.all });
    },
  });
}
