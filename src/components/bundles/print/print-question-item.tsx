"use client";

import { Fragment } from "react";
import { MathContent } from "@/components/math/math-content";
import { readMatchingPayload } from "@/components/questions/matching-view";
import {
  matchingResponseLabel,
  premiseLabel,
  responseLabel,
} from "@/components/questions/matching-labels";
import { readMatrixGridPayload } from "@/components/questions/matrix-grid-view";
import { isOptionBased } from "@/lib/contracts/question";
import type { BundleItemView } from "@/lib/hooks/use-bundles";
import { cn } from "@/lib/utils";
import { explanationOf, itemCorrectLabels, labelOf } from "./item-helpers";
import type { ColumnMode, ExplanationMode, KeyMode } from "./types";

export interface PrintQuestionItemProps {
  item: BundleItemView;
  /** Nomor urut butir (1..n) — dipakai bila item tidak punya nomor kustom. */
  ordinal: number;
  /** Item pertama naskah — dipakai CSS untuk aturan "butir pembuka". */
  isFirst: boolean;
  /** Nama bagian, hanya bila ini AWAL bagian (null = tanpa header). */
  sectionName: string | null;
  /** Item ini ditandai "mulai kolom baru" oleh guru. */
  forceColumn: boolean;
  showNumber: boolean;
  /** Susunan opsi PG: satu atau dua kolom. */
  optionColumns: ColumnMode;
  keyMode: KeyMode;
  explanationMode: ExplanationMode;
  answerSpaceCm: number;
}

/**
 * Satu butir pada naskah cetak: stimulus, atau soal beserta opsi/tabel/pasangan,
 * ruang coretan, dan pembahasan inline.
 *
 * Diekstrak dari `BundlePrintView` agar berkas utama tidak lagi memuat lima
 * bentuk render sekaligus. Perilaku TIDAK berubah — markup dan kelas cetak
 * identik dengan sebelumnya.
 */
export function PrintQuestionItem({
  item,
  ordinal,
  isFirst,
  sectionName,
  forceColumn,
  showNumber,
  optionColumns,
  keyMode,
  explanationMode,
  answerSpaceCm,
}: PrintQuestionItemProps) {
  const sectionHeader = sectionName ? (
    <li
      data-break={forceColumn ? "force-column" : undefined}
      className="print-section-header list-none font-bold text-xs uppercase tracking-wider text-slate-700 pt-2 pb-1 border-b border-slate-300 col-span-full"
    >
      {sectionName}
    </li>
  ) : null;

  if (item.item.role === "stimulus") {
    return (
      <Fragment>
        {sectionHeader}
        <li
          data-first-item={isFirst ? "true" : undefined}
          className="print-question print-stimulus list-none"
        >
          <div className="rounded border-l-4 border-gray-300 bg-gray-50 p-3 text-sm">
            <MathContent content={item.question.contentMarkdown} />
          </div>
        </li>
      </Fragment>
    );
  }

  const correct = itemCorrectLabels(item);
  const displayNumber = labelOf(item, ordinal);
  const showInlineKey = keyMode === "inline";

  return (
    <Fragment>
      {sectionHeader}
      <li
        data-first-item={ordinal === 1 ? "true" : undefined}
        data-break={forceColumn && !sectionName ? "force-column" : undefined}
        className="print-question print-item flex gap-2"
      >
        {showNumber && (
          <span className="print-item-number w-[22px] shrink-0 text-right font-medium tabular-nums">
            {displayNumber}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <MathContent content={item.question.contentMarkdown} />

          {isOptionBased(item.question.questionType as never) &&
            item.question.questionType !== "matrix_grid" &&
            item.question.questionType !== "matching" &&
            item.question.options.length > 0 && (
              <ul
                className={cn(
                  "print-options mt-1.5 gap-1 text-sm",
                  optionColumns === "2" ? "grid grid-cols-2" : "flex flex-col",
                )}
              >
                {item.question.options.map((o) => {
                  const isKey = showInlineKey && (o.isCorrect || correct.includes(o.label));
                  return (
                    <li key={o.id} className="flex gap-2 break-inside-avoid">
                      <span className={isKey ? "font-bold" : "font-medium"}>{o.label}.</span>
                      <span className={isKey ? "font-bold" : undefined}>
                        <MathContent content={o.contentMarkdown} />
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}

          <MatrixGridBlock item={item} showInlineKey={showInlineKey} />
          <MatchingBlock item={item} showInlineKey={showInlineKey} />

          {/* Ruang coret-coretan siswa — polos, tanpa kotak/border, semua tipe soal. */}
          {explanationMode !== "inline" && answerSpaceCm > 0 && (
            <div
              data-slot="scratch-space"
              className="w-full break-inside-avoid"
              style={{ height: `${answerSpaceCm}cm` }}
              aria-hidden="true"
            />
          )}

          {explanationMode === "inline" && (
            <InlineExplanation item={item} />
          )}
        </div>
      </li>
    </Fragment>
  );
}

/** Tabel pernyataan untuk soal `matrix_grid`. */
function MatrixGridBlock({ item, showInlineKey }: { item: BundleItemView; showInlineKey: boolean }) {
  if (item.question.questionType !== "matrix_grid") return null;
  const { labels, rows } = readMatrixGridPayload(item.question.dataPayload);
  if (rows.length === 0) return null;
  return (
    <div className="mt-2 overflow-x-auto break-inside-avoid">
      <table className="w-full border-collapse border border-gray-300 text-xs print:border-black">
        <thead>
          <tr className="bg-gray-100 print:bg-gray-200">
            <th className="w-8 border border-gray-300 p-1.5 text-center font-medium print:border-black">No.</th>
            <th className="border border-gray-300 p-1.5 text-left font-medium print:border-black">Pernyataan</th>
            {labels.map((l, li) => (
              <th key={li} className="w-16 border border-gray-300 p-1.5 text-center font-medium print:border-black">
                {l}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} className="border-t border-gray-200 print:border-black">
              <td className="border border-gray-300 p-1.5 text-center print:border-black">{ri + 1}.</td>
              <td className="border border-gray-300 p-1.5 print:border-black">
                <MathContent content={r.text} />
              </td>
              {labels.map((l, li) => {
                const isSelected = showInlineKey && r.answer === l;
                return (
                  <td key={li} className="border border-gray-300 p-1.5 text-center font-bold print:border-black">
                    {isSelected ? "✓" : "○"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Premis & pilihan respons untuk soal `matching`. */
function MatchingBlock({ item, showInlineKey }: { item: BundleItemView; showInlineKey: boolean }) {
  if (item.question.questionType !== "matching") return null;
  const { premises, responses } = readMatchingPayload(item.question.dataPayload);
  const matchingPairs =
    (item.question.answerKey as { matchingPairs?: Record<string, string> } | null)?.matchingPairs ?? {};
  if (premises.length === 0 && responses.length === 0) return null;
  return (
    <div className="mt-2 grid grid-cols-2 gap-4 text-xs break-inside-avoid">
      <div className="flex flex-col gap-1.5 border-r border-gray-200 pr-2 print:border-black">
        <span className="font-semibold text-gray-700 print:text-black">Premis / Pertanyaan:</span>
        {premises.map((p, pi) => {
          const keyLabel = matchingResponseLabel(matchingPairs, p.id, responses);
          return (
            <div
              key={p.id ?? pi}
              className="flex gap-1.5 rounded border border-gray-200 bg-gray-50 p-1 print:border-black print:bg-transparent"
            >
              <span className="font-bold">{premiseLabel(pi)}.</span>
              <div className="flex-1">
                <MathContent content={p.contentMarkdown} />
                {showInlineKey && keyLabel && (
                  <span className="ml-1 text-[10px] font-bold text-brand print:text-black">
                    → {keyLabel}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex flex-col gap-1.5 pl-2">
        <span className="font-semibold text-gray-700 print:text-black">Pilihan Jawaban:</span>
        {responses.map((res, ri) => (
          <div
            key={res.id ?? ri}
            className="flex gap-1.5 rounded border border-gray-200 bg-gray-50 p-1 print:border-black print:bg-transparent"
          >
            <span className="font-bold">{responseLabel(ri)}.</span>
            <div className="flex-1">
              <MathContent content={res.contentMarkdown} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Pembahasan tepat di bawah soal (mode inline). */
function InlineExplanation({ item }: { item: BundleItemView }) {
  const exp = explanationOf(item);
  if (!exp) return null;
  return (
    <div className="mt-2.5 rounded border-l-2 border-brand bg-brand/5 p-2.5 text-xs text-foreground break-inside-avoid print:bg-transparent print:border-l print:text-black">
      <span className="mb-1 block font-bold text-brand print:text-black">Pembahasan:</span>
      <MathContent content={exp} />
    </div>
  );
}
