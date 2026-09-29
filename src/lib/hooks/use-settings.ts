"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { SettingItem, SettingValue } from "@/lib/services/settings-service";

/**
 * Hook pengaturan aplikasi (L3) — React Query.
 * staleTime panjang (30m): pengaturan jarang berubah.
 */
export const settingsKeys = {
  all: ["settings"] as const,
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

/** Baca pengaturan umum (secret dimask). */
export function useSettings() {
  return useQuery({
    queryKey: settingsKeys.all,
    queryFn: () => apiFetch<{ items: SettingItem[] }>("/api/settings"),
    staleTime: 30 * 60_000,
  });
}

/** Perbarui pengaturan umum. */
export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (settings: Array<{ key: string; value: SettingValue }>) =>
      apiFetch<{ items: SettingItem[] }>("/api/settings", {
        method: "PATCH",
        body: JSON.stringify({ settings }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: settingsKeys.all }),
  });
}
