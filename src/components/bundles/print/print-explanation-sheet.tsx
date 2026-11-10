"use client";

import { MathContent } from "@/components/math/math-content";
import type { BundleItemView } from "@/lib/hooks/use-bundles";
import { explanationOf, labelOf } from "./item-helpers";

/** Lembar pembahasan terpisah di akhir naskah (mode `end`). */
export function PrintExplanationSheet({ items }: { items: BundleItemView[] }) {
  return (
    <section className="print-sheet-explanation mt-8 border-t pt-4">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide">Pembahasan</h2>
      <ol className="flex flex-col gap-4 text-sm leading-relaxed">
        {items.map((it, i) => {
          const explanation = explanationOf(it);
          if (!explanation) return null;
          return (
            <li key={it.item.id} className="print-question flex gap-2 break-inside-avoid">
              <span className="w-6 shrink-0 text-right font-medium tabular-nums">
                {labelOf(it, i + 1)}
              </span>
              <div className="min-w-0 flex-1">
                <MathContent content={explanation} />
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
