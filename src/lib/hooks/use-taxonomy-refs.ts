"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { SourceRow, EventRow, TagRow } from "@/lib/services/taxonomy-service";
import { api } from "@/lib/api/fetcher";
import { referenceKeys } from "./use-reference";

/** Kunci query bersama untuk entitas taksonomi (sinkron dengan filter bank soal). */
export const refKeys = {
  sources: referenceKeys.sources,
  events: referenceKeys.events,
  tags: referenceKeys.tags,
};

// ── Sumber ─────────────────────────────────────────────────────

export function useSources() {
  return useQuery({ queryKey: refKeys.sources, queryFn: () => api<SourceRow[]>("/api/sources") });
}

export function useCreateSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      kind: string;
      label: string;
      url?: string | null;
      publisher?: string | null;
      author?: string | null;
      bookYear?: number | null;
      city?: string | null;
    }) => api<SourceRow>("/api/sources", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: refKeys.sources }),
  });
}

export function useUpdateSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      version,
      ...input
    }: {
      id: string;
      version?: number | "*";
      kind?: string;
      label?: string;
      url?: string | null;
      publisher?: string | null;
      author?: string | null;
      bookYear?: number | null;
      city?: string | null;
    }) =>
      api<SourceRow>(`/api/sources/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
        ifMatch: version ?? "*",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: refKeys.sources }),
  });
}

export function useDeleteSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: string | { id: string; version?: number | "*" }) => {
      const id = typeof args === "string" ? args : args.id;
      const version = typeof args === "object" ? args.version : undefined;
      return api(`/api/sources/${id}`, { method: "DELETE", ifMatch: version ?? "*" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: refKeys.sources }),
  });
}

// ── Event ──────────────────────────────────────────────────────

export function useEvents() {
  return useQuery({ queryKey: refKeys.events, queryFn: () => api<EventRow[]>("/api/events") });
}

export function useCreateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      name: string;
      shortname: string;
      category: string;
      subtests?: string[];
      aliases?: string[];
    }) => api<EventRow>("/api/events", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: refKeys.events }),
  });
}

export function useUpdateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      version,
      ...input
    }: { id: string; version?: number | "*" } & Partial<{
      name: string;
      shortname: string;
      category: string;
      subtests: string[];
      aliases: string[];
    }>) =>
      api<EventRow>(`/api/events/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
        ifMatch: version ?? "*",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: refKeys.events }),
  });
}

export function useDeleteEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: string | { id: string; version?: number | "*" }) => {
      const id = typeof args === "string" ? args : args.id;
      const version = typeof args === "object" ? args.version : undefined;
      return api(`/api/events/${id}`, { method: "DELETE", ifMatch: version ?? "*" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: refKeys.events }),
  });
}

// ── Label ──────────────────────────────────────────────────────

export function useTags() {
  return useQuery({ queryKey: refKeys.tags, queryFn: () => api<TagRow[]>("/api/tags") });
}

export function useCreateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string }) =>
      api<TagRow>("/api/tags", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: refKeys.tags }),
  });
}

export function useUpdateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name, version }: { id: string; name: string; version?: number | "*" }) =>
      api<TagRow>(`/api/tags/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ name }),
        ifMatch: version ?? "*",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: refKeys.tags }),
  });
}

export function useDeleteTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: string | { id: string; version?: number | "*" }) => {
      const id = typeof args === "string" ? args : args.id;
      const version = typeof args === "object" ? args.version : undefined;
      return api(`/api/tags/${id}`, { method: "DELETE", ifMatch: version ?? "*" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: refKeys.tags }),
  });
}

/** Gabungkan label sinonim (G3.3) — pindah relasi soal lalu hapus sumber. */
export function useMergeTags() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { sourceId: string; targetId: string }) =>
      api<{ moved: number }>("/api/tags/merge", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: refKeys.tags }),
  });
}
