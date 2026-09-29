"use client";

import { useQuery } from "@tanstack/react-query";

export interface DashboardStats {
  stats: {
    total: number;
    ready: number;
    review: number;
    flagged: number;
    bundles: number;
    sources: number;
  };
  byDifficulty: { key: number; n: number }[];
  byGrade: { key: string; n: number }[];
  topTopics: { id: string; name: string; n: number }[];
  recent: {
    id: string;
    content: string;
    status: string;
    createdAt: string;
  }[];
}

async function fetchStats(): Promise<DashboardStats> {
  const res = await fetch("/api/stats");
  if (!res.ok) throw new Error(`Gagal memuat statistik (${res.status})`);
  const { data } = await res.json();
  return data;
}

/** Statistik dasbor (RENCANA-UI §3.1). */
export function useStats() {
  return useQuery({
    queryKey: ["stats"],
    queryFn: fetchStats,
    staleTime: 60_000,
  });
}
