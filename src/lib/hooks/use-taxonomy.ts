"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { referenceKeys } from "./use-reference";
import { api, apiFetch } from "@/lib/api/fetcher";
import type { TopicNode } from "@/lib/taxonomy/tree";

/**
 * Hook kelola taksonomi (M5) — React Query mutation untuk topik.
 * Query daftar memakai kunci bersama `referenceKeys.topics` (dipakai filter soal).
 */
export const taxonomyKeys = {
  topics: referenceKeys.topics,
};

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
    mutationFn: ({ id, input, version }: { id: string; input: Partial<TopicInput>; version?: number | "*" }) =>
      api<TopicNode>(`/api/topics/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
        ifMatch: version ?? "*",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: taxonomyKeys.topics }),
  });
}

export function useDeleteTopic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: string | { id: string; version?: number | "*" }) => {
      const id = typeof args === "string" ? args : args.id;
      const version = typeof args === "object" ? args.version : undefined;
      return api<{ ok: boolean }>(`/api/topics/${id}`, {
        method: "DELETE",
        ifMatch: version ?? "*",
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: taxonomyKeys.topics }),
  });
}
