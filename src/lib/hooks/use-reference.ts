"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/fetcher";

/**
 * Hook data referensi (L3) — topik, sumber, event.
 * staleTime 30 menit (jarang berubah).
 */

/**
 * MAT-131B (Tahap A): `slug` **deprecated & opsional** pada topik.
 * Identitas kanonik = `id`; UI tidak boleh bergantung pada `slug`
 * (bisa `null` untuk baris baru, hilang total di Tahap B).
 */
export interface TopicRow {
  id: string;
  name: string;
  parentId: string | null;
  level: number;
  usageCount?: number;
}

export interface SourceRow {
  id: string;
  /** Nomor revisi (ADR-0030) — dikirim balik sebagai If-Match saat menyunting. */
  version: number;
  kind: string;
  label: string;
}

export interface EventRow {
  id: string;
  /** Nomor revisi (ADR-0030) — dikirim balik sebagai If-Match saat menyunting. */
  version: number;
  name: string;
  shortname: string;
  category: string;
}

export interface TagRow {
  id: string;
  /** Nomor revisi (ADR-0030) — dikirim balik sebagai If-Match saat menyunting. */
  version: number;
  name: string;
  usageCount: number;
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
  tags: ["reference", "tags"] as const,
};

/** Daftar jenjang/kelas (id "1".."12", "utbk", "mandiri", "umum"). */
export function useGrades() {
  return useQuery({
    queryKey: referenceKeys.grades,
    queryFn: () => api<GradeRow[]>("/api/grades"),
    staleTime: 30 * 60_000,
  });
}

export function useTopics() {
  return useQuery({
    queryKey: referenceKeys.topics,
    queryFn: () => api<TopicRow[]>("/api/topics"),
    staleTime: 30 * 60_000,
  });
}

export function useSources() {
  return useQuery({
    queryKey: referenceKeys.sources,
    queryFn: () => api<SourceRow[]>("/api/sources"),
    staleTime: 30 * 60_000,
  });
}

export function useTags() {
  return useQuery({
    queryKey: referenceKeys.tags,
    queryFn: () => api<TagRow[]>("/api/tags"),
    staleTime: 30 * 60_000,
  });
}

export function useEvents() {
  return useQuery({
    queryKey: referenceKeys.events,
    queryFn: () => api<EventRow[]>("/api/events"),
    staleTime: 30 * 60_000,
  });
}

export interface StimulusRow {
  id: string;
  contentMarkdown: string;
}

/**
 * Daftar soal bertipe `stimulus` (untuk pemilih wacana induk di editor, G2.2).
 * Tak di-cache lama (soal bisa berubah); staleTime singkat 60 dtk.
 */
export function useStimulusParents() {
  return useQuery({
    queryKey: ["reference", "stimulus-parents"],
    queryFn: async () => {
      const res = await api<{ items: StimulusRow[] }>(
        "/api/questions?questionType=stimulus&limit=100",
      );
      return res.items ?? [];
    },
    staleTime: 60_000,
  });
}
