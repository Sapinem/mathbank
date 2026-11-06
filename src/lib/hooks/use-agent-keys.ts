"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/fetcher";

/**
 * Hook Akses Agen (API key MCP, M11-e) — React Query.
 * - `useAgentKeys`      : daftar kunci agen (tanpa nilai rahasia)
 * - `useCreateAgentKey` : buat kunci (nilai penuh hanya muncul sekali)
 * - `useRevokeAgentKey` : cabut kunci
 */

export interface AgentKeyInfo {
  id: string;
  version: number;
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
    queryFn: () => api<{ items: AgentKeyInfo[] }>("/api/system/agent-keys"),
    enabled,
    staleTime: 30_000,
  });
}

export function useCreateAgentKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name?: string; expiresInDays?: number }) =>
      api<{ id: string; key: string; prefix: string | null; name: string | null }>(
        "/api/system/agent-keys",
        { method: "POST", body: JSON.stringify(input) },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: agentKeyKeys.all }),
  });
}

export function useRevokeAgentKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: string | { id: string; version?: number | "*" }) => {
      const id = typeof args === "string" ? args : args.id;
      const version = typeof args === "object" ? args.version : undefined;
      return api<{ ok: boolean }>(`/api/system/agent-keys/${id}`, {
        method: "DELETE",
        ifMatch: version ?? "*",
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: agentKeyKeys.all }),
  });
}
