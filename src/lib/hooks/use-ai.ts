"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { SettingItem } from "@/lib/services/settings-service";
import { questionKeys } from "@/lib/hooks/use-questions";

/**
 * Hook Pengaturan AI (M10) — React Query.
 * - `useAiSettings`  : baca ai.* (secret dimask)
 * - `useSaveAiSettings` : simpan ai.*
 * - `useAiModels`    : daftar model dari provider (untuk pemilih)
 * - `useAiHealth`    : cek LLM + embedding
 */

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
  return json.data as T;
}

export const aiKeys = {
  settings: ["ai", "settings"] as const,
  models: ["ai", "models"] as const,
  health: ["ai", "health"] as const,
};

export function useAiSettings() {
  return useQuery({
    queryKey: aiKeys.settings,
    queryFn: () => apiFetch<{ items: SettingItem[] }>("/api/ai/settings"),
    staleTime: 5 * 60_000,
  });
}

export interface AiSettingsInput {
  enabled?: boolean;
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  maxTokens?: number;
  timeoutMs?: number;
}

export function useSaveAiSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AiSettingsInput) =>
      apiFetch<{ items: SettingItem[] }>("/api/ai/settings", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: aiKeys.settings });
      qc.invalidateQueries({ queryKey: aiKeys.models });
      qc.invalidateQueries({ queryKey: aiKeys.health });
    },
  });
}

/** Daftar model (dimuat saat dipanggil; `enabled` untuk on-demand). */
export function useAiModels(enabled = true) {
  return useQuery({
    queryKey: aiKeys.models,
    queryFn: () => apiFetch<{ models: string[]; error?: string }>("/api/ai/models"),
    enabled,
    staleTime: 60_000,
    retry: false,
  });
}

export function useAiHealth(enabled = true) {
  return useQuery({
    queryKey: aiKeys.health,
    queryFn: () =>
      apiFetch<{
        llm: { enabled: boolean; model: string | null; ok: boolean; error: string | null };
        embedding: { ok: boolean; error: string | null };
      }>("/api/ai/health"),
    enabled,
    staleTime: 30_000,
    retry: false,
  });
}

/** Usulan enrichment (bentuk dari service). */
export interface EnrichmentProposal {
  topics: string[];
  difficulty: number | null;
  cognitiveLevel: string | null;
  tags: string[];
  notes?: string;
}

export interface EnrichResult {
  mode: "single";
  result: {
    questionId: string;
    ok: boolean;
    proposal?: EnrichmentProposal;
    error?: string;
    status?: string;
  };
}

/**
 * Enrich SATU soal dengan AI (usulan → diterapkan + status → review).
 * `onSuccess` di hook pemanggil untuk invalidasi daftar/detail.
 */
export function useEnrichQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (questionId: string) =>
      apiFetch<EnrichResult>("/api/ai/enrich", {
        method: "POST",
        body: JSON.stringify({ questionId }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: questionKeys.all });
    },
  });
}
