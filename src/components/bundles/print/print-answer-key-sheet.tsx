"use client";

import { readMatchingPayload } from "@/components/questions/matching-view";
import { matchingKeySummary } from "@/components/questions/matching-labels";
import type { BundleItemView } from "@/lib/hooks/use-bundles";
import { itemCorrectLabels, labelOf } from "./item-helpers";

/**
 * Lembar kunci jawaban terpisah (akhir naskah).
 *
 * Soal `matching` ditampilkan sebagai ringkasan pasangan (1→C, 2→A), bukan
 * daftar label mentah — kalau tidak, guru harus mencocokkan sendiri.
 */
export function PrintAnswerKeySheet({ items }: { items: BundleItemView[] }) {
  return (
    <section className="print-sheet-answerkey mt-8 border-t pt-4">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide">Kunci Jawaban</h2>
      <ol className="grid grid-cols-3 gap-x-8 gap-y-1 text-sm">
        {items.map((it, i) => {
          const correct = itemCorrectLabels(it);
          const text = it.question.answerKey?.text ?? null;
          const matchingPayload =
            it.question.questionType === "matching"
              ? readMatchingPayload(it.question.dataPayload)
              : null;
          const matchingShown = matchingPayload
            ? matchingKeySummary(
                (it.question.answerKey as { matchingPairs?: Record<string, string> } | null)
                  ?.matchingPairs,
                matchingPayload.premises,
                matchingPayload.responses,
              )
            : "";
          const shown = matchingShown
            ? matchingShown
            : correct.length > 0
              ? correct.join(", ")
              : (text ?? "-");
          return (
            <li key={it.item.id} className="flex gap-2 tabular-nums">
              <span className="w-6 text-right font-medium">{labelOf(it, i + 1)}</span>
              <span>{shown}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
