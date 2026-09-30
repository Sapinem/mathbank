"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

/**
 * Hook Akses Agen (API key MCP, M11-e) — React Query.
 * - `useAgentKeys`      : daftar kunci agen (tanpa nilai rahasia)
 * - `useCreateAgentKey` : buat kunci (nilai penuh hanya muncul sekali)
 * - `useRevokeAgentKey` : cabut kunci
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

export interface AgentKeyInfo {
  id: string;
  name: string | null;
  prefix: string | null;
  enabled: boolean;
  createdAt: string | null;
  expiresAt: string | null;
  lastRequest: string | null;
  requestCount: number | null;
}

export const agentKeyKeys = {
  all: ["agent-keys"] as const,
};

export function useAgentKeys(enabled = true) {
  return useQuery({
    queryKey: agentKeyKeys.all,
    queryFn: () => apiFetch<{ items: AgentKeyInfo[] }>("/api/system/agent-keys"),
    enabled,
    staleTime: 30_000,
  });
}

export function useCreateAgentKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name?: string; expiresInDays?: number }) =>
      apiFetch<{ id: string; key: string; prefix: string | null; name: string | null }>(
        "/api/system/agent-keys",
        { method: "POST", body: JSON.stringify(input) },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: agentKeyKeys.all }),
  });
}

export function useRevokeAgentKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ ok: boolean }>(`/api/system/agent-keys/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: agentKeyKeys.all }),
  });
}
