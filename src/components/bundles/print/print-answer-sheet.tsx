"use client";

import type { BundleItemView } from "@/lib/hooks/use-bundles";
import { labelOf } from "./item-helpers";

/** Lembar jawaban kosong untuk siswa (nama/kelas + satu baris per butir). */
export function PrintAnswerSheet({ items }: { items: BundleItemView[] }) {
  return (
    <section className="print-sheet-answers mt-8 border-t pt-4">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide">Lembar Jawaban</h2>
      <p className="mb-3 text-xs">Nama: ______________________  Kelas: ____________</p>
      <table className="w-full border-collapse text-sm">
        <tbody>
          {items.map((it, i) => (
            <tr key={it.item.id} className="border-b">
              <td className="w-10 border px-2 py-1.5 text-right font-medium tabular-nums">
                {labelOf(it, i + 1)}
              </td>
              <td className="border px-2 py-1.5">&nbsp;</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
