"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { MathContent } from "@/components/math/math-content";
import { isOptionBased, correctLabelsOf } from "@/lib/contracts/question";
import { useBundle } from "@/lib/hooks/use-bundles";
import type { BundleItemView } from "@/lib/hooks/use-bundles";
import type { BundlePrintConfig } from "@/lib/db/schema/bundle";
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
/** Cara pembahasan disajikan (Axiom 3-Way Mode). */
type ExplanationMode = "none" | "inline" | "end";

/**
 * Nilai `size` CSS untuk tiap `pageSize`. `null` = pakai `@page` bawaan
 * `print.css` (A4). Peta eksplisit dipakai supaya nilai dari DB tidak pernah
 * diinterpolasi mentah ke dalam CSS.
 */
const PRINT_PAGE_SIZE_CSS: Record<NonNullable<BundlePrintConfig["pageSize"]>, string | null> = {
  A4: null,
  Letter: "Letter",
};

/** Baca label opsi benar dari `answerKey` (bila ada). */
function itemCorrectLabels(item: BundleItemView): string[] {
  return correctLabelsOf(item.question.answerKey);
}

/** Baca teks pembahasan dari `answerKey` (bila ada). */
function explanationOf(item: BundleItemView): string | null {
  const key = item.question.answerKey;
  if (!key) return null;
  const exp = key.explanation ?? (key as Record<string, unknown>).explanationMarkdown;
  if (typeof exp === "string" && exp.trim().length > 0) return exp.trim();
  return null;
}

export function BundlePrintView() {
  const params = useParams<{ id: string }>();
  const bundleId = params.id;
  const { data: bundle, isPending, isError, error } = useBundle(bundleId);

  const [columns, setColumns] = useState<ColumnMode>("1");
  // Kolom NASKAH (bukan opsi) — default dari printConfig, bisa ditimpa sesi ini.
  const [bodyColumns, setBodyColumns] = useState<ColumnMode | null>(null);
  const [keyModeOverride, setKeyModeOverride] = useState<KeyMode | null>(null);
  const [includeAnswerSheet, setIncludeAnswerSheet] = useState(true);
  const [explanationModeOverride, setExplanationModeOverride] = useState<ExplanationMode | null>(null);

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
  const canShowExplanation = items.some((it) => explanationOf(it) != null);

  // Default TIDAK diduplikasi di sini — setiap field dibaca dengan fallback
  // masing-masing di bawah (satu sumber: DEFAULT_BUNDLE_PRINT_CONFIG di skema).
  const config: BundlePrintConfig = bundle.printConfig ?? {};
  const effectiveKeyMode: KeyMode =
    keyModeOverride ?? (config.includeAnswerKey ? "separate" : "hidden");
  const effectiveExplanationMode: ExplanationMode =
    explanationModeOverride ?? config.explanationPlacement ?? "none";
  const institution = config.institutionName || "MATH MY ID";
  const tagline = config.tagline ?? "Bank Soal & Kurasi Matematika";
  const instructions = config.instructions ?? bundle.instructions;
  const durationMinutes = config.durationMinutes ?? bundle.durationMinutes;
  const isTwoColumn = bodyColumns ? bodyColumns === "2" : config.twoColumnLayout !== false;
  const pageSizeCss = PRINT_PAGE_SIZE_CSS[config.pageSize ?? "A4"];
  const answerSpaceCm = config.answerSpaceCm ?? 4;

  return (
    <div className="flex flex-col gap-6">
      {/* pageSize tidak bisa diatur lewat class (`@page` adalah konteks dokumen),
          jadi ukuran kertas non-A4 disuntik sebagai stylesheet khusus cetak.
          Margin TIDAK ditulis di sini: `@page` mencascade per-properti, jadi
          margin tetap milik `print.css` (satu sumber geometri kertas). */}
      {pageSizeCss && (
        <style>{`@media print { @page { size: ${pageSizeCss} portrait; } }`}</style>
      )}
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

        {/* Kolom Naskah — printConfig hanya bisa diubah lewat API, jadi halaman
            cetak ini wajib punya kendali lokal agar pengguna tidak terkunci. */}
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Kolom Naskah</span>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant={!isTwoColumn ? "default" : "outline"}
              onClick={() => setBodyColumns("1")}
              className="min-h-[44px]"
            >
              Naskah 1 kolom
            </Button>
            <Button
              size="sm"
              variant={isTwoColumn ? "default" : "outline"}
              onClick={() => setBodyColumns("2")}
              className="min-h-[44px]"
            >
              Naskah 2 kolom
            </Button>
          </div>
        </div>

        {/* Kunci jawaban */}
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Kunci jawaban</span>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant={effectiveKeyMode === "hidden" ? "default" : "outline"}
              onClick={() => setKeyModeOverride("hidden")}
              className="min-h-[44px]"
            >
              Sembunyikan
            </Button>
            <Button
              size="sm"
              variant={effectiveKeyMode === "inline" ? "default" : "outline"}
              disabled={!canShowKey}
              onClick={() => setKeyModeOverride("inline")}
              className="min-h-[44px]"
            >
              Tandai tebal
            </Button>
            <Button
              size="sm"
              variant={effectiveKeyMode === "separate" ? "default" : "outline"}
              disabled={!canShowKey}
              onClick={() => setKeyModeOverride("separate")}
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

        {/* Pembahasan (Axiom 3-Way Mode) */}
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Pembahasan</span>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant={effectiveExplanationMode === "none" ? "default" : "outline"}
              disabled={!canShowExplanation}
              onClick={() =>
                setExplanationModeOverride(effectiveExplanationMode === "none" ? "end" : "none")
              }
              className="min-h-[44px]"
            >
              {effectiveExplanationMode === "none" ? "Tanpa pembahasan" : "Sembunyikan"}
            </Button>
            <Button
              size="sm"
              variant={effectiveExplanationMode === "inline" ? "default" : "outline"}
              disabled={!canShowExplanation}
              onClick={() => setExplanationModeOverride("inline")}
              className="min-h-[44px]"
            >
              Di bawah soal
            </Button>
            <Button
              size="sm"
              variant={effectiveExplanationMode === "end" ? "default" : "outline"}
              disabled={!canShowExplanation}
              onClick={() => setExplanationModeOverride("end")}
              className="min-h-[44px]"
            >
              Lembar akhir
            </Button>
          </div>
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
      <div className="print-sheet worksheet mx-auto w-full max-w-[210mm] rounded-lg border bg-white p-[15mm] text-black shadow-sm print:border-0 print:p-0 print:shadow-none">
        {/* Kop Resmi (Format Varian C Prototype Soal) */}
        <header className="header print-header mb-4">
          <div className="headerTop flex justify-between items-start">
            <div className="headerLeft flex items-center gap-2">
              <div className="logo bg-[#0b6b3a] text-white px-2 py-1 rounded text-[10px] font-bold text-center leading-tight">
                MATH<br />MY ID
              </div>
              <div className="institution text-xs font-bold leading-tight">
                {institution.toUpperCase()}
                {tagline && (
                  <span className="tagline block font-normal text-[10px] text-gray-600">
                    {tagline}
                  </span>
                )}
              </div>
            </div>
            <div className="title print-bundle-title text-2xl font-extrabold text-[#0b6b3a] tracking-wide text-right">
              {bundle.title}
            </div>
          </div>
          <hr className="headerRule border-t-[2.5px] border-[#0b6b3a] my-2" />
          <div className="headerInfo flex justify-between text-xs">
            <div className="flex flex-col">
              <b>{bundle.grade ? `Kelas ${bundle.grade}` : "Matematika"}</b>
              <i className="not-italic text-gray-600">
                {[bundle.year ? `Tahun ${bundle.year}` : null, `${questionItems.length} Soal`]
                  .filter(Boolean)
                  .join(" · ")}
              </i>
            </div>
            <div className="right text-right flex flex-col">
              <i className="not-italic text-gray-600">
                {new Intl.DateTimeFormat("id-ID", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                }).format(new Date())}
              </i>
              {durationMinutes && (
                <i className="not-italic text-gray-600">Waktu: {durationMinutes} menit</i>
              )}
            </div>
          </div>
        </header>

        {instructions && (
          <div className="instruction print-instruction border border-[#0b6b3a] rounded-md p-2.5 mb-4 text-xs italic">
            {instructions}
          </div>
        )}

        {/* Daftar soal — 1 atau 2 kolom */}
        <ol
          className={cn(
            isTwoColumn
              ? "print-columns columns-1 gap-8 sm:columns-2 [&>li]:break-inside-avoid"
              : "print-single-column flex flex-col gap-5",
          )}
        >
          {items.map((it) => {
            if (it.item.role === "stimulus") {
              return (
                <li key={it.item.id} className="print-question print-stimulus list-none">
                  <div className="rounded border-l-4 border-gray-300 bg-gray-50 p-3 text-sm">
                    <MathContent content={it.question.contentMarkdown} />
                  </div>
                </li>
              );
            }
            // Nomor urut soal (1..n)
            const num = questionItems.findIndex((q) => q.item.id === it.item.id) + 1;
            const correct = itemCorrectLabels(it);
            const showNumber = config.showQuestionNumber !== false;
            return (
              <li key={it.item.id} className="print-question print-item flex gap-2">
                {showNumber && (
                  <span className="print-item-number w-6 shrink-0 text-right font-medium tabular-nums">{num}.</span>
                )}
                <div className="min-w-0 flex-1">
                  <MathContent content={it.question.contentMarkdown} />
                  {isOptionBased(it.question.questionType as never) &&
                    it.question.questionType !== "matrix_grid" &&
                    it.question.questionType !== "matching" &&
                    it.question.options.length > 0 && (
                      <ul
                        className={cn(
                          "print-options mt-1.5 gap-1 text-sm",
                          columns === "2"
                            ? "grid grid-cols-1 sm:grid-cols-2"
                            : "flex flex-col",
                        )}
                      >
                        {it.question.options.map((o) => {
                          const isKey =
                            effectiveKeyMode === "inline" && (o.isCorrect || correct.includes(o.label));
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

                  {/* Render khusus untuk soal matrix_grid (Tabel Pernyataan) */}
                  {it.question.questionType === "matrix_grid" && (() => {
                    const dp = it.question.dataPayload as { labels?: string[]; rows?: { text: string; answer?: string }[] } | null;
                    const labels = dp?.labels ?? ["Benar", "Salah"];
                    const rows = dp?.rows ?? [];
                    if (rows.length === 0) return null;
                    return (
                      <div className="mt-2 overflow-x-auto break-inside-avoid">
                        <table className="w-full border-collapse border border-gray-300 text-xs print:border-black">
                          <thead>
                            <tr className="bg-gray-100 print:bg-gray-200">
                              <th className="border border-gray-300 p-1.5 text-left font-medium print:border-black">Pernyataan</th>
                              {labels.map((l, li) => (
                                <th key={li} className="w-16 border border-gray-300 p-1.5 text-center font-medium print:border-black">{l}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((r, ri) => (
                              <tr key={ri} className="border-t border-gray-200 print:border-black">
                                <td className="border border-gray-300 p-1.5 print:border-black">
                                  <MathContent content={r.text} />
                                </td>
                                {labels.map((l, li) => {
                                  const isSelected = effectiveKeyMode === "inline" && r.answer === l;
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
                  })()}

                  {/* Render khusus untuk soal matching (Premis & Pilihan Respons) */}
                  {it.question.questionType === "matching" && (() => {
                    const dp = it.question.dataPayload as { premises?: { id: string; contentMarkdown: string }[]; responses?: { id: string; contentMarkdown: string }[] } | null;
                    const premises = dp?.premises ?? [];
                    const responses = dp?.responses ?? [];
                    const matchingPairs = (it.question.answerKey as { matchingPairs?: Record<string, string> } | null)?.matchingPairs ?? {};
                    if (premises.length === 0 && responses.length === 0) return null;
                    return (
                      <div className="mt-2 grid grid-cols-2 gap-4 text-xs break-inside-avoid">
                        <div className="flex flex-col gap-1.5 border-r border-gray-200 pr-2 print:border-black">
                          <span className="font-semibold text-gray-700 print:text-black">Premis / Pertanyaan:</span>
                          {premises.map((p, pi) => (
                            <div key={p.id ?? pi} className="flex gap-1.5 rounded border border-gray-200 bg-gray-50 p-1 print:border-black print:bg-transparent">
                              <span className="font-bold">{pi + 1}.</span>
                              <div className="flex-1">
                                <MathContent content={p.contentMarkdown} />
                                {effectiveKeyMode === "inline" && matchingPairs[p.id] && (
                                  <span className="ml-1 text-[10px] font-bold text-green-700 print:text-black">
                                    → {matchingPairs[p.id]}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="flex flex-col gap-1.5 pl-2">
                          <span className="font-semibold text-gray-700 print:text-black">Pilihan Jawaban:</span>
                          {responses.map((res, ri) => (
                            <div key={res.id ?? ri} className="flex gap-1.5 rounded border border-gray-200 bg-gray-50 p-1 print:border-black print:bg-transparent">
                              <span className="font-bold">{String.fromCharCode(65 + ri)}.</span>
                              <div className="flex-1">
                                <MathContent content={res.contentMarkdown} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Area ruang jawaban untuk soal isian / esai (Axiom answerSpaceCm) */}
                  {!isOptionBased(it.question.questionType as never) && (
                    <div
                      className="mt-2.5 rounded border border-dashed border-gray-300 break-inside-avoid print:border-gray-400"
                      style={{ height: `${answerSpaceCm}cm` }}
                    >
                      <span className="block p-1 text-[9px] text-gray-400 select-none no-print">
                        Area Jawaban Siswa ({answerSpaceCm} cm)
                      </span>
                    </div>
                  )}

                  {/* Pembahasan tepat di bawah soal (inline mode) */}
                  {effectiveExplanationMode === "inline" && (() => {
                    const exp = explanationOf(it);
                    if (!exp) return null;
                    return (
                      <div className="mt-2.5 rounded border-l-2 border-[#0b6b3a] bg-gray-50 p-2.5 text-xs text-gray-800 break-inside-avoid print:bg-transparent print:border-l print:text-black">
                        <span className="mb-1 block font-bold text-[#0b6b3a] print:text-black">
                          Pembahasan:
                        </span>
                        <MathContent content={exp} />
                      </div>
                    );
                  })()}
                </div>
              </li>
            );
          })}
        </ol>

        {/* Lembar kunci jawaban terpisah */}
        {effectiveKeyMode === "separate" && canShowKey && (
          <section className="print-sheet-answerkey mt-8 border-t pt-4">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide">Kunci Jawaban</h2>
            <ol className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm sm:grid-cols-3">
              {questionItems.map((it, i) => {
                const correct = itemCorrectLabels(it);
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

        {/* Lembar pembahasan terpisah di akhir naskah (end mode) */}
        {effectiveExplanationMode === "end" && canShowExplanation && (
          <section className="print-sheet-explanation mt-8 border-t pt-4">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide">Pembahasan</h2>
            <ol className="flex flex-col gap-4 text-sm leading-relaxed">
              {questionItems.map((it, i) => {
                const explanation = explanationOf(it);
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
