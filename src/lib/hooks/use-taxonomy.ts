"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { referenceKeys } from "./use-reference";
import type { TopicNode } from "@/lib/taxonomy/tree";

/**
 * Hook kelola taksonomi (M5) — React Query mutation untuk topik.
 * Query daftar memakai kunci bersama `referenceKeys.topics` (dipakai filter soal).
 */
export const taxonomyKeys = {
  topics: referenceKeys.topics,
};

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
  return json.data as T;
}

export interface TopicInput {
  name: string;
  parentId?: string | null;
  description?: string | null;
  sortOrder?: number;
}

/** Daftar topik (datar) untuk pengelolaan. */
export function useTopicList() {
  return useQuery({
    queryKey: taxonomyKeys.topics,
    queryFn: () => apiFetch<TopicNode[]>("/api/topics"),
    staleTime: 30 * 60_000,
  });
}

export function useCreateTopic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: TopicInput) =>
      apiFetch<TopicNode>("/api/topics", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: taxonomyKeys.topics }),
  });
}

export function useUpdateTopic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<TopicInput> }) =>
      apiFetch<TopicNode>(`/api/topics/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: taxonomyKeys.topics }),
  });
}

export function useDeleteTopic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ ok: boolean }>(`/api/topics/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: taxonomyKeys.topics }),
  });
}
