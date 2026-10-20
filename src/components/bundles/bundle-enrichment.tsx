import { Gauge, Tags } from "lucide-react";
import { cn } from "@/lib/utils";
import { difficultyToneClass } from "@/components/questions/rubric-badge";
import type { BundleEnrichment } from "@/lib/services/bundle-shared";

/**
 * Ringkasan pengayaan paket (Sprint 1 · MAT-127).
 *
 * Sumber data: `BundleRow.enrichment` dari `GET /api/bundles` (dihitung
 * server-side, satu request per halaman). Field ini OPSIONAL — paket lama /
 * respons sebelum backend siap tetap tampil tanpa ringkasan.
 *
 * Angka yang ditampilkan sengaja jujur: rerata kesulitan 1 desimal dan
 * cakupan topik sebagai persen butir yang SUDAH bertopik, bukan "jumlah
 * topik" saja — supaya guru bisa melihat pekerjaan pengayaan yang tersisa.
 */

/** Kelas tone untuk rerata kesulitan (dibulatkan ke level terdekat). */
export function avgDifficultyTone(avg: number): string {
  return difficultyToneClass(Math.min(5, Math.max(1, Math.round(avg))));
}

/** Chip rerata kesulitan, mis. "Rerata 3,2". */
export function DifficultyAverageChip({
  avg,
  className,
}: {
  avg: number;
  className?: string;
}) {
  const rounded = Math.round(avg * 10) / 10;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[11px] tabular-nums",
        avgDifficultyTone(avg),
        className,
      )}
      title={`Rerata tingkat kesulitan ${rounded} dari 5`}
    >
      <Gauge aria-hidden className="size-3" />
      {rounded.toFixed(1)}
    </span>
  );
}

/** Chip cakupan topik, mis. "12 topik · 45%". */
export function TopicCoverageChip({
  topicCount,
  coverage,
  className,
}: {
  topicCount: number;
  coverage: number;
  className?: string;
}) {
  const pct = Math.round(coverage * 100);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-mono text-[11px] tabular-nums text-muted-foreground",
        className,
      )}
      title={`${topicCount} topik berbeda · ${pct}% butir sudah bertopik`}
    >
      <Tags aria-hidden className="size-3 text-muted-foreground/80" />
      {topicCount} topik · {pct}%
    </span>
  );
}

/**
 * Baris ringkas statistik paket: jumlah butir, rerata kesulitan, cakupan topik.
 * `compact` dipakai di kartu grid (teks kecil, tanpa label).
 */
export function BundleEnrichmentSummary({
  enrichment,
  className,
  compact = false,
}: {
  enrichment?: BundleEnrichment;
  className?: string;
  compact?: boolean;
}) {
  if (!enrichment) return null;

  if (enrichment.questionCount === 0) {
    return (
      <span className={cn("text-[11px] text-muted-foreground/80", className)}>
        Belum ada butir
      </span>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1",
        compact ? "text-[11px]" : "text-xs",
        className,
      )}
    >
      <span className="inline-flex items-center gap-1 font-mono tabular-nums text-muted-foreground">
        <span className="font-semibold text-foreground">
          {enrichment.questionCount}
        </span>
        butir
      </span>
      <DifficultyAverageChip avg={enrichment.avgDifficulty} />
      <TopicCoverageChip
        topicCount={enrichment.topicCount}
        coverage={enrichment.topicCoverage}
      />
    </div>
  );
}
