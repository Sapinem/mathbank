"use client";

import { MathContent } from "@/components/math/math-content";
import { cn } from "@/lib/utils";
import { premiseLabel, responseLabel } from "./matching-labels";

/**
 * Bentuk `data_payload` untuk soal `matching` (menjodohkan) — bentuk kanonik
 * MAT-145/146 yang ditulis `QuestionEditor.buildDataPayload()`:
 *
 *   { type: "matching", premises: [{id, contentMarkdown}], responses: [{id, contentMarkdown}] }
 *
 * Kunci pasangan tinggal di `answer_key.matchingPairs` (`premiseId → responsId`),
 * bukan di payload — payload hanya memuat dua kolom yang harus dilihat siswa.
 */
export interface MatchingItem {
  id: string;
  contentMarkdown: string;
}

export interface MatchingPayload {
  premises: MatchingItem[];
  responses: MatchingItem[];
}

/** Normalisasi `data_payload` mentah → bentuk terketik (aman, tanpa asumsi). */
export function readMatchingPayload(dp: unknown): MatchingPayload {
  const o = (dp ?? {}) as Record<string, unknown>;
  const read = (v: unknown): MatchingItem[] =>
    Array.isArray(v)
      ? (v as unknown[]).map((item, i) => {
          const row = (item ?? {}) as Record<string, unknown>;
          return {
            id: String(row.id ?? `i${i}`),
            contentMarkdown: String(row.contentMarkdown ?? row.text ?? ""),
          };
        })
      : [];
  return { premises: read(o.premises), responses: read(o.responses) };
}

/**
 * Tampilan soal `matching` (menjodohkan) untuk halaman detail.
 *
 * Dua kolom berdampingan di layar lebar dan **bertumpuk** di 360px
 * (`flex-col sm:flex-row`) supaya tidak ada overflow horizontal. Penanda
 * premis memakai huruf (A, B, …), respons memakai angka (1, 2, …) — dari
 * `matching-labels.ts`, modul yang sama dipakai tampilan cetak (Fase 4),
 * sehingga label detail dan cetak tidak bisa lagi berbeda.
 */
export function MatchingView({
  payload,
  className,
}: {
  payload: MatchingPayload;
  className?: string;
}) {
  const { premises, responses } = payload;
  if (premises.length === 0 && responses.length === 0) return null;

  return (
    <div className={cn("flex flex-col gap-2 border-t border-border/40 pt-4", className)}>
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Menjodohkan
      </span>

      <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
        <section className="flex min-w-0 flex-1 flex-col gap-1.5" aria-label="Kolom premis">
          <h3 className="text-xs font-medium text-muted-foreground">Premis</h3>
          <ol className="flex flex-col gap-1.5">
            {premises.map((p, i) => (
              <li
                key={p.id}
                className="flex min-w-0 items-start gap-2.5 rounded-lg border border-border/50 px-3 py-2"
              >
                <span className="shrink-0 font-mono text-sm font-semibold text-foreground/70">
                  {premiseLabel(i)}.
                </span>
                <div className="min-w-0 flex-1 text-sm leading-relaxed">
                  <MathContent content={p.contentMarkdown} noScroll />
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="flex min-w-0 flex-1 flex-col gap-1.5" aria-label="Kolom respons">
          <h3 className="text-xs font-medium text-muted-foreground">Respons</h3>
          <ol className="flex flex-col gap-1.5">
            {responses.map((r, i) => (
              <li
                key={r.id}
                className="flex min-w-0 items-start gap-2.5 rounded-lg border border-border/50 px-3 py-2"
              >
                <span className="shrink-0 font-mono text-sm font-semibold text-foreground/70">
                  {responseLabel(i)}.
                </span>
                <div className="min-w-0 flex-1 text-sm leading-relaxed">
                  <MathContent content={r.contentMarkdown} noScroll />
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
