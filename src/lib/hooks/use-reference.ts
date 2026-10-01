"use client";

import { useQuery } from "@tanstack/react-query";

/**
 * Hook data referensi (L3) — topik, sumber, event.
 * staleTime 30 menit (jarang berubah).
 */

async function apiFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { "Content-Type": "application/json" } });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
  return json.data as T;
}

export interface TopicRow {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  level: number;
}

export interface SourceRow {
  id: string;
  kind: string;
  label: string;
  slug: string;
}

export interface EventRow {
  id: string;
  name: string;
  shortname: string;
  category: string;
}

export interface GradeRow {
  id: string;
  label: string;
  levelGroup: string | null;
  curriculumPhase: string | null;
  orderIndex: number;
}

export const referenceKeys = {
  topics: ["reference", "topics"] as const,
  sources: ["reference", "sources"] as const,
  events: ["reference", "events"] as const,
  grades: ["reference", "grades"] as const,
};

/** Daftar jenjang/kelas (selaras QBank: id "1".."12","11w","utbk","umum"). */
export function useGrades() {
  return useQuery({
    queryKey: referenceKeys.grades,
    queryFn: () => apiFetch<GradeRow[]>("/api/grades"),
    staleTime: 30 * 60_000,
  });
}

export function useTopics() {
  return useQuery({
    queryKey: referenceKeys.topics,
    queryFn: () => apiFetch<TopicRow[]>("/api/topics"),
    staleTime: 30 * 60_000,
  });
}

export function useSources() {
  return useQuery({
    queryKey: referenceKeys.sources,
    queryFn: () => apiFetch<SourceRow[]>("/api/sources"),
    staleTime: 30 * 60_000,
  });
}

export function useEvents() {
  return useQuery({
    queryKey: referenceKeys.events,
    queryFn: () => apiFetch<EventRow[]>("/api/events"),
    staleTime: 30 * 60_000,
  });
}
