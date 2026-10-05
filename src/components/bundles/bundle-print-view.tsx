"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { MathContent } from "@/components/math/math-content";
import { isOptionBased } from "@/lib/contracts/question";
import { useBundle } from "@/lib/hooks/use-bundles";
import type { BundleItemView } from "@/lib/hooks/use-bundles";
import { cn } from "@/lib/utils";

/**
 * Tampilan cetak paket soal (MAT-40) — standar cetak A4 / PDF.
 *
 * Alur: pilih opsi cetak (kolom opsi, kunci, lembar jawaban, pembahasan) →
 * `window.print()`. Gaya `@media print` ada di `src/styles/print.css`; hanya
 * `.print-sheet` yang tampil saat mencetak (shell aplikasi disembunyikan).
 *
 * MAT-40 peningkatan:
 *  - Layout A4 standar (`@page { size: A4; margin: 15mm; }`).
 *  - `page-break-inside: avoid` pada tiap butir soal.
 *  - Opsi jawaban (A–E) adaptif 1 atau 2 kolom.
 *  - KaTeX rendered tajam dan terisolasi (`.katex-inline`).
 *  - Opsi cetak lembar kunci jawaban DAN pembahasan terpisah.
 *  - Touch targets 44px (WCAG 2.2 AA) pada semua tombol aksi.
 *
 * Catatan akses: kunci hanya muncul bila API mengirimkannya (aktor berhak —
 * `canSeeAnswerKey`). Bila tak ada, opsi "Tampilkan kunci" dinonaktifkan.
 */

type ColumnMode = "1" | "2";
/** Cara kunci jawaban disajikan. */
type KeyMode = "hidden" | "inline" | "separate";

/** Baca label opsi benar dari `answerKey` (bila ada). */
function correctLabelsOf(item: BundleItemView): string[] {
  return item.question.answerKey?.correct ?? [];
}

export function BundlePrintView() {
  const params = useParams<{ id: string }>();
  const bundleId = params.id;
  const { data: bundle, isPending, isError, error } = useBundle(bundleId);

  const [columns, setColumns] = useState<ColumnMode>("1");
  const [keyMode, setKeyMode] = useState<KeyMode>("hidden");
  const [includeAnswerSheet, setIncludeAnswerSheet] = useState(true);
  const [includeExplanation, setIncludeExplanation] = useState(false);

  if (isPending) return <LoadingState label="Menyiapkan naskah…" />;
  if (isError)
    return <ErrorState title="Gagal memuat paket" description={(error as Error).message} />;
  if (!bundle) return null;

  const items = bundle.items;
  // Soal bernomor = item non-stimulus; stimulus ditampilkan sebagai blok.
  const questionItems = items.filter((it) => it.item.role !== "stimulus");
  // Bisa tampilkan kunci bila API mengirimkan answerKey pada minimal satu soal.
  const canShowKey = items.some((it) => it.question.answerKey != null);
  // Bisa tampilkan pembahasan bila ada minimal satu soal punya explanation.
  const canShowExplanation = items.some((it) => it.question.answerKey?.explanation != null);

  return (
    <div className="flex flex-col gap-6">
      {/* ── Bilah kontrol (tidak ikut tercetak) ─────────────────── */}
      <div className="no-print flex flex-wrap items-end gap-4 rounded-lg border bg-card p-4">
        {/* Kolom Opsi */}
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Kolom Opsi</span>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant={columns === "1" ? "default" : "outline"}
              onClick={() => setColumns("1")}
              className="min-h-[44px]"
            >
              1 kolom
            </Button>
            <Button
              size="sm"
              variant={columns === "2" ? "default" : "outline"}
              onClick={() => setColumns("2")}
              className="min-h-[44px]"
            >
              2 kolom
            </Button>
          </div>
        </div>

        {/* Kunci jawaban */}
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Kunci jawaban</span>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant={keyMode === "hidden" ? "default" : "outline"}
              onClick={() => setKeyMode("hidden")}
              className="min-h-[44px]"
            >
              Sembunyikan
            </Button>
            <Button
              size="sm"
              variant={keyMode === "inline" ? "default" : "outline"}
              disabled={!canShowKey}
              onClick={() => setKeyMode("inline")}
              className="min-h-[44px]"
            >
              Tandai tebal
            </Button>
            <Button
              size="sm"
              variant={keyMode === "separate" ? "default" : "outline"}
              disabled={!canShowKey}
              onClick={() => setKeyMode("separate")}
              className="min-h-[44px]"
            >
              Lembar terpisah
            </Button>
          </div>
        </div>

        {/* Lembar Jawaban */}
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Lembar jawaban</span>
          <Button
            size="sm"
            variant={includeAnswerSheet ? "default" : "outline"}
            onClick={() => setIncludeAnswerSheet((v) => !v)}
            className="min-h-[44px]"
          >
            {includeAnswerSheet ? "Sertakan (di akhir)" : "Tanpa lembar jawaban"}
          </Button>
        </div>

        {/* Pembahasan */}
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Pembahasan</span>
          <Button
            size="sm"
            variant={includeExplanation ? "default" : "outline"}
            disabled={!canShowExplanation}
            onClick={() => setIncludeExplanation((v) => !v)}
            className="min-h-[44px]"
          >
            {includeExplanation ? "Sertakan pembahasan" : "Tanpa pembahasan"}
          </Button>
        </div>

        <div className="ml-auto flex gap-2">
          <Button
            variant="outline"
            render={<Link href={`/bundles/${bundleId}`} />}
            nativeButton={false}
            className="min-h-[44px]"
          >
            <ArrowLeft data-icon="inline-start" /> Kembali
          </Button>
          <Button onClick={() => window.print()} className="min-h-[44px]">
            <Printer data-icon="inline-start" /> Cetak / Simpan PDF
          </Button>
        </div>
      </div>

      {!canShowKey && (
        <p className="no-print text-sm text-muted-foreground">
          Peran Anda tidak berhak melihat kunci jawaban — opsi kunci dinonaktifkan.
        </p>
      )}
      {!canShowExplanation && (
        <p className="no-print text-sm text-muted-foreground">
          Tidak ada pembahasan tersedia untuk paket ini.
        </p>
      )}

      {/* ── Naskah (yang dicetak) ───────────────────────────────── */}
      {/* MAT-40: A4 physical page preview — max-w-[210mm] mensimulasikan lebar
          kertas A4; padding 15mm menyelaraskan dengan @page margin. */}
      <div className="print-sheet mx-auto w-full max-w-[210mm] rounded-lg border bg-white p-[15mm] text-black shadow-sm print:border-0 print:p-0 print:shadow-none">
        {/* Kop */}
        <header className="mb-6 border-b pb-3">
          <h1 className="text-lg font-bold">{bundle.title}</h1>
          <p className="mt-1 text-xs">
            {[bundle.grade, bundle.year ? `Tahun ${bundle.year}` : null]
              .filter(Boolean)
              .join(" · ")}
            {bundle.durationMinutes ? ` · Waktu: ${bundle.durationMinutes} menit` : ""}
            {` · ${questionItems.length} soal`}
          </p>
          {bundle.instructions && (
            <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed">
              {bundle.instructions}
            </p>
          )}
        </header>

        {/* Daftar soal — 1 atau 2 kolom */}
        <ol
          className={
            columns === "2"
              ? "columns-1 gap-8 sm:columns-2 [&>li]:break-inside-avoid"
              : "flex flex-col gap-5"
          }
        >
          {items.map((it) => {
            if (it.item.role === "stimulus") {
              return (
                <li key={it.item.id} className="print-question list-none">
                  <div className="rounded border-l-4 border-gray-300 bg-gray-50 p-3 text-sm">
                    <MathContent content={it.question.contentMarkdown} />
                  </div>
                </li>
              );
            }
            // Nomor urut soal (1..n)
            const num = questionItems.findIndex((q) => q.item.id === it.item.id) + 1;
            const correct = correctLabelsOf(it);
            return (
              <li key={it.item.id} className="print-question flex gap-2">
                <span className="w-6 shrink-0 text-right font-medium tabular-nums">{num}.</span>
                <div className="min-w-0 flex-1">
                  <MathContent content={it.question.contentMarkdown} />
                  {isOptionBased(it.question.questionType as never) &&
                    it.question.options.length > 0 && (
                      <ul
                        className={cn(
                          "mt-1.5 gap-1 text-sm",
                          columns === "2"
                            ? "grid grid-cols-1 sm:grid-cols-2"
                            : "flex flex-col",
                        )}
                      >
                        {it.question.options.map((o) => {
                          const isKey =
                            keyMode === "inline" && (o.isCorrect || correct.includes(o.label));
                          return (
                            <li key={o.id} className="flex gap-2 break-inside-avoid">
                              <span className={isKey ? "font-bold" : "font-medium"}>
                                {o.label}.
                              </span>
                              <span className={isKey ? "font-bold" : undefined}>
                                <MathContent content={o.contentMarkdown} />
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                </div>
              </li>
            );
          })}
        </ol>

        {/* Lembar kunci jawaban terpisah */}
        {keyMode === "separate" && canShowKey && (
          <section className="print-sheet-answerkey mt-8 border-t pt-4">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide">Kunci Jawaban</h2>
            <ol className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm sm:grid-cols-3">
              {questionItems.map((it, i) => {
                const correct = correctLabelsOf(it);
                const text = it.question.answerKey?.text ?? null;
                const shown = correct.length > 0 ? correct.join(", ") : (text ?? "—");
                return (
                  <li key={it.item.id} className="flex gap-2 tabular-nums">
                    <span className="w-6 text-right font-medium">{i + 1}.</span>
                    <span>{shown}</span>
                  </li>
                );
              })}
            </ol>
          </section>
        )}

        {/* Lembar pembahasan terpisah (MAT-40) */}
        {includeExplanation && canShowExplanation && (
          <section className="print-sheet-explanation mt-8 border-t pt-4">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide">Pembahasan</h2>
            <ol className="flex flex-col gap-4 text-sm leading-relaxed">
              {questionItems.map((it, i) => {
                const explanation = it.question.answerKey?.explanation;
                if (!explanation) return null;
                return (
                  <li key={it.item.id} className="print-question flex gap-2 break-inside-avoid">
                    <span className="w-6 shrink-0 text-right font-medium tabular-nums">
                      {i + 1}.
                    </span>
                    <div className="min-w-0 flex-1">
                      <MathContent content={explanation} />
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        )}

        {/* Lembar jawaban kosong */}
        {includeAnswerSheet && (
          <section className="print-sheet-answers mt-8 border-t pt-4">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide">Lembar Jawaban</h2>
            <p className="mb-3 text-xs">Nama: ______________________  Kelas: ____________</p>
            <table className="w-full border-collapse text-sm">
              <tbody>
                {questionItems.map((it, i) => (
                  <tr key={it.item.id} className="border-b">
                    <td className="w-10 border px-2 py-1.5 text-right font-medium tabular-nums">
                      {i + 1}
                    </td>
                    <td className="border px-2 py-1.5">&nbsp;</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </div>
    </div>
  );
}
