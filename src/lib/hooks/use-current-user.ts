"use client";

import { useQuery } from "@tanstack/react-query";
import type { Role } from "@/lib/auth/roles";

export interface CurrentUser {
  id: string;
  name: string;
  roles: Role[];
  via: "session" | "apikey" | "system";
}

/**
 * Identitas pengguna saat ini (`/api/auth/me`, L3).
 * `staleTime` panjang — identitas jarang berubah.
 */
export function useCurrentUser() {
  return useQuery({
    queryKey: ["auth", "me"],
    queryFn: async (): Promise<CurrentUser> => {
      const res = await fetch("/api/auth/me");
      if (!res.ok) throw new Error(`Gagal memuat identitas (${res.status})`);
      const { data } = await res.json();
      return data;
    },
    staleTime: 10 * 60_000,
    retry: false,
  });
}
