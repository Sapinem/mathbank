"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { SettingItem, SettingValue } from "@/lib/services/settings-service";
import { api } from "@/lib/api/fetcher";

/**
 * Hook pengaturan aplikasi (L3) — React Query.
 * staleTime panjang (30m): pengaturan jarang berubah.
 */
export const settingsKeys = {
  all: ["settings"] as const,
};

/** Baca pengaturan umum (secret dimask). */
export function useSettings() {
  return useQuery({
    queryKey: settingsKeys.all,
    queryFn: () => api<{ items: SettingItem[] }>("/api/settings"),
    staleTime: 30 * 60_000,
  });
}

/** Perbarui pengaturan umum. */
export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (settings: Array<{ key: string; value: SettingValue }>) =>
      api<{ items: SettingItem[] }>("/api/settings", {
        method: "PATCH",
        body: JSON.stringify({ settings }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: settingsKeys.all }),
  });
}
