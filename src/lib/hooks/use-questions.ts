"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  ListQuestionsQuery,
  CreateQuestionInput,
  UpdateQuestionInput,
} from "@/lib/contracts/question";
import type { PublicQuestion } from "@/lib/services/question-service";
import type { QuestionStatus } from "@/lib/fsm/question-fsm";

/**
 * Hook data soal (L3) — React Query.
 * staleTime per-jenis: questions 30s (sering berubah), reference 30m (jarang).
 */

/** Pembungkus fetch → { data } atau lempar error terformat. */
async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.error?.message ?? `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return json.data as T;
}

/** Bangun query string dari filter (buang nilai kosong). */
function toQueryString(query: Partial<ListQuestionsQuery>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

/** Kunci query soal. */
export const questionKeys = {
  all: ["questions"] as const,
  list: (filter: Partial<ListQuestionsQuery>) => ["questions", "list", filter] as const,
  detail: (id: string) => ["questions", "detail", id] as const,
};

export interface QuestionListResult {
  items: PublicQuestion[];
  total: number;
}

/** Daftar soal (filter + paginasi). */
export function useQuestions(filter: Partial<ListQuestionsQuery>) {
  return useQuery({
    queryKey: questionKeys.list(filter),
    queryFn: () =>
      apiFetch<QuestionListResult>(`/api/questions${toQueryString(filter)}`),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });
}

/** Detail satu soal. */
export function useQuestion(id: string | undefined) {
  return useQuery({
    queryKey: questionKeys.detail(id ?? ""),
    queryFn: () => apiFetch<PublicQuestion>(`/api/questions/${id}`),
    enabled: Boolean(id),
    staleTime: 30_000,
  });
}

/** Buat soal. */
export function useCreateQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateQuestionInput) =>
      apiFetch<PublicQuestion>("/api/questions", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: questionKeys.all }),
  });
}

/** Perbarui soal. */
export function useUpdateQuestion(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateQuestionInput) =>
      apiFetch<PublicQuestion>(`/api/questions/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: questionKeys.all }),
  });
}

export type ChangeQuestionStatusArgs =
  | QuestionStatus
  | { status: QuestionStatus; notes?: string | null };
export type ChangeStatusInput = ChangeQuestionStatusArgs;

/** Ubah status (FSM). */
export function useChangeQuestionStatus(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ChangeQuestionStatusArgs) => {
      const body = typeof input === "string" ? { status: input } : input;
      return apiFetch<PublicQuestion>(`/api/questions/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: questionKeys.all }),
  });
}

/** Tandai/lepas tanda. */
export function useSetQuestionFlag(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { flagged: boolean; notes?: string | null }) =>
      apiFetch<PublicQuestion>(`/api/questions/${id}/flag`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: questionKeys.all }),
  });
}

/** Hapus (lunak). */
export function useDeleteQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ ok: boolean }>(`/api/questions/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: questionKeys.all }),
  });
}

export type BulkAction =
  | "set_ready"
  | "archive"
  | "reject_to_draft"
  | "flag"
  | "unflag";

export interface BulkResult {
  ok: string[];
  failed: { id: string; error: string }[];
}

/** Aksi massal (G3.1) — kurasi banyak soal sekaligus. */
export function useBulkQuestionAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      ids: string[];
      action: BulkAction;
      notes?: string | null;
    }) =>
      apiFetch<BulkResult>("/api/questions/batch", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: questionKeys.all }),
  });
}
