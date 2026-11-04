"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Fragment, useState } from "react";
import {
  ArrowLeft,
  Printer,
  SlidersHorizontal,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { MathContent } from "@/components/math/math-content";
import { readMatchingPayload } from "@/components/questions/matching-view";
import {
  matchingKeySummary,
  matchingResponseLabel,
  premiseLabel,
  responseLabel,
} from "@/components/questions/matching-labels";
import { readMatrixGridPayload } from "@/components/questions/matrix-grid-view";
import { isOptionBased, correctLabelsOf } from "@/lib/contracts/question";
import { useBundle, useUpdateBundle } from "@/lib/hooks/use-bundles";
import type { BundleItemView } from "@/lib/hooks/use-bundles";
import type { BundlePrintConfig } from "@/lib/db/schema/bundle";
import { PrintWatermark } from "./print-watermark";
import { BundlePrintKop } from "./print/bundle-print-kop";
import { BundlePrintSettingsDrawer } from "./print/bundle-print-settings-drawer";
import { BundlePrintHeader } from "./print/bundle-print-header";
import { BundlePrintFooter } from "./print/bundle-print-footer";
import { cn } from "@/lib/utils";

/**
 * Tampilan cetak paket soal (MAT-40 / Pilar 4) - standar cetak A4 / PDF.
 *
 * Alur:
 *  - Layar utama menampilkan naskah A4 secara WYSIWYG (bersih & fokus).
 *  - Bilah atas sticky memuat navigasi kembali, judul naskah, tombol aksi cetak,
 *    dan tombol pembuka Sliding Panel (Sheet Drawer).
 *  - Pengaturan cetak (kolom naskah, opsi, kunci, pembahasan, tinggi coret-coretan)
 *    dikelola di dalam Sliding Panel kanan (`@/components/ui/sheet`).
 *  - Pengaturan dapat disimpan permanen sebagai baku paket ke database (`useUpdateBundle`).
 *  - Ruang coret-coretan siswa (scratch space) 100% kosong tanpa keterangan teks,
 *    dan otomatis menyusut jika pembahasan di bawah soal aktif.
 *  - Running header judul naskah disuntikkan via CSS Custom Property
 *    (`--print-bundle-title`) agar tampil di Chromium (menggantikan `string-set` yang diabaikan Blink).
 */

export type ColumnMode = "1" | "2";
/** Cara kunci jawaban disajikan. */
export type KeyMode = "hidden" | "inline" | "separate";
/** Cara pembahasan disajikan (Axiom 3-Way Mode). */
export type ExplanationMode = "none" | "inline" | "end";

/**
 * Nilai `size` CSS untuk tiap `pageSize`. `null` = pakai `@page` bawaan
 * `print.css` (A4). Peta eksplisit dipakai supaya nilai dari DB tidak pernah
 * diinterpolasi mentah ke dalam CSS.
 */
const PRINT_PAGE_SIZE_CSS: Record<NonNullable<BundlePrintConfig["pageSize"]>, string | null> = {
  A4: null,
  Letter: "Letter",
};

/** Pilihan ukuran ruang coret-coretan (cm). */
const ANSWER_SPACE_OPTIONS = [0, 2, 3, 4, 5] as const;

/** Preset palet warna brand institusi (Axiom Multi-brand parity). */
const BRAND_PRESET_COLORS = [
  { label: "Biru MathBank", value: "#0158ca" },
  { label: "Hijau Zamrud", value: "#0b6b3a" },
  { label: "Hitam Formal", value: "#111111" },
] as const;

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

export function BundlePrintView({
  initialSettingsOpen,
}: {
  initialSettingsOpen?: boolean;
} = {}) {
  const params = useParams<{ id: string }>();
  const bundleId = params.id;
  const { data: bundle, isPending, isError, error } = useBundle(bundleId);
  const updateBundle = useUpdateBundle(bundleId, bundle?.version);
  const [isSaving, setIsSaving] = useState(false);

  const [isSettingsOpen, setIsSettingsOpen] = useState(initialSettingsOpen ?? false);

  const [columns, setColumns] = useState<ColumnMode>("1");
  // Kolom NASKAH (bukan opsi) - default dari printConfig, bisa ditimpa sesi ini.
  const [bodyColumns, setBodyColumns] = useState<ColumnMode | null>(null);
  const [keyModeOverride, setKeyModeOverride] = useState<KeyMode | null>(null);
  const [includeAnswerSheet, setIncludeAnswerSheet] = useState(true);
  const [explanationModeOverride, setExplanationModeOverride] = useState<ExplanationMode | null>(null);
  const [answerSpaceCmOverride, setAnswerSpaceCmOverride] = useState<number | null>(null);
  const [fitToScreen, setFitToScreen] = useState(false);
  const [backgroundGridOverride, setBackgroundGridOverride] = useState<boolean | null>(null);
  const [backgroundWatermarkOverride, setBackgroundWatermarkOverride] = useState<boolean | null>(null);
  const [columnBreaksOverride, setColumnBreaksOverride] = useState<string[] | null>(null);
  const [brandColorOverride, setBrandColorOverride] = useState<string | null>(null);
  const [logoFailed, setLogoFailed] = useState(false);

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

  // Default TIDAK diduplikasi di sini - setiap field dibaca dengan fallback
  // masing-masing di bawah (satu sumber: DEFAULT_BUNDLE_PRINT_CONFIG di skema).
  const config: BundlePrintConfig = bundle.printConfig ?? {};
  const effectiveKeyMode: KeyMode =
    keyModeOverride ?? (config.includeAnswerKey ? "separate" : "hidden");
  const effectiveExplanationMode: ExplanationMode =
    explanationModeOverride ?? config.explanationPlacement ?? "none";
  const effectiveAnswerSpaceCm: number =
    answerSpaceCmOverride ?? (config.answerSpaceCm ?? 3);
  const effectiveBackgroundGrid: boolean =
    backgroundGridOverride ?? (config.backgroundGrid ?? false);
  const effectiveBackgroundWatermark: boolean =
    backgroundWatermarkOverride ?? (config.backgroundWatermark ?? true);
  const effectiveColumnBreaks: string[] =
    columnBreaksOverride ?? (config.columnBreaks ?? []);
  const effectiveBrandColor: string =
    brandColorOverride ?? (config.brandColor ?? "#0158ca");

  const toggleColumnBreak = (questionId: string) => {
    setColumnBreaksOverride((prev) => {
      const current = prev ?? config.columnBreaks ?? [];
      if (current.includes(questionId)) {
        return current.filter((id) => id !== questionId);
      }
      return [...current, questionId];
    });
  };

  const institution = config.institutionName || "MATH MY ID";
  const tagline = config.tagline ?? null;
  const instructions = config.instructions ?? bundle.instructions;
  const durationMinutes = config.durationMinutes ?? bundle.durationMinutes;
  const isTwoColumn = bodyColumns ? bodyColumns === "2" : config.twoColumnLayout !== false;
  const pageSizeCss = PRINT_PAGE_SIZE_CSS[config.pageSize ?? "A4"];

  // Preset A: Mode Ujian Siswa (Bersih)
  const applyStudentPreset = () => {
    setBodyColumns("2");
    setColumns("1");
    setKeyModeOverride("hidden");
    setExplanationModeOverride("none");
    setAnswerSpaceCmOverride(3);
    setIncludeAnswerSheet(true);
    setBackgroundGridOverride(false);
    setBackgroundWatermarkOverride(true);
  };

  // Preset B: Pedoman Guru (Lengkap dengan Pembahasan)
  const applyTeacherPreset = () => {
    setBodyColumns("2");
    setColumns("1");
    if (canShowKey) setKeyModeOverride("inline");
    if (canShowExplanation) setExplanationModeOverride("inline");
    setAnswerSpaceCmOverride(0);
    setIncludeAnswerSheet(false);
    setBackgroundGridOverride(false);
    setBackgroundWatermarkOverride(false);
  };

  // Simpan pengaturan aktif sebagai baku naskah ke database
  const handleSaveDefault = async () => {
    if (!updateBundle) return;
    setIsSaving(true);
    try {
      await updateBundle.mutateAsync({
        printConfig: {
          twoColumnLayout: isTwoColumn,
          includeAnswerKey: effectiveKeyMode === "separate",
          explanationPlacement: effectiveExplanationMode,
          answerSpaceCm: effectiveAnswerSpaceCm,
          backgroundGrid: effectiveBackgroundGrid,
          backgroundWatermark: effectiveBackgroundWatermark,
          columnBreaks: effectiveColumnBreaks,
          brandColor: effectiveBrandColor,
        },
        version: bundle.version,
      });
      toast.success("Pengaturan cetak disimpan sebagai baku paket.");
    } catch (err) {
      toast.error("Gagal menyimpan pengaturan", {
        description: (err as Error).message,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const safeBrandColor = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(effectiveBrandColor)
    ? effectiveBrandColor
    : "#0158ca";
  const safePrintBundleTitle = JSON.stringify(bundle.title).replace(/<\/style/gi, "<\\/style");

  return (
    <div className="print-page-root flex flex-col gap-6 bg-muted/20 min-h-screen pb-12 print:block print:min-h-0 print:p-0 print:m-0 print:bg-white">
      {/* Suntikkan CSS Custom Property untuk running header Chromium (aman dari injeksi style/XSS) */}
      <style>{`
        @media print {
          :root {
            --print-bundle-title: ${safePrintBundleTitle};
            --paper-brand: ${safeBrandColor};
          }
        }
      `}</style>

      {/* pageSize tidak bisa diatur lewat class (`@page` adalah konteks dokumen),
          jadi ukuran kertas non-A4 disuntik sebagai stylesheet khusus cetak. */}
      {pageSizeCss && (
        <style>{`@media print { @page { size: ${pageSizeCss} portrait; } }`}</style>
      )}

      {/* ── Bilah Atas Sticky (no-print) ────────────────────────── */}
      <div className="no-print sticky top-0 z-10 flex items-center justify-between gap-2 sm:gap-3 border-b bg-background/95 px-3 py-2 sm:px-4 sm:py-2.5 backdrop-blur shadow-xs">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Button
            variant="outline"
            size="sm"
            render={<Link href={`/bundles/${bundleId}`} />}
            nativeButton={false}
            className="min-h-[44px] min-w-[44px] px-2.5 sm:px-3 shrink-0"
            aria-label="Kembali"
            title="Kembali ke Detail Paket"
          >
            <ArrowLeft data-icon="inline-start" />
            <span className="hidden sm:inline">Kembali</span>
          </Button>

          <div className="flex flex-col min-w-0">
            <span
              data-slot="topbar-title"
              className="font-semibold text-sm truncate max-w-[130px] xs:max-w-[180px] sm:max-w-xs md:max-w-md"
            >
              Naskah: {bundle.title}
            </span>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
              <span>{questionItems.length} Soal</span>
              <span>·</span>
              <span>{isTwoColumn ? "2 Kolom" : "1 Kolom"}</span>
              <span className="hidden xs:inline">·</span>
              <span className="hidden xs:inline">
                {effectiveKeyMode === "hidden"
                  ? "Tanpa Kunci"
                  : effectiveKeyMode === "inline"
                    ? "Kunci Tebal"
                    : "Kunci Terpisah"}
              </span>
              {effectiveExplanationMode !== "none" && (
                <>
                  <span className="hidden sm:inline">·</span>
                  <span className="hidden sm:inline">
                    {effectiveExplanationMode === "inline" ? "Bahas di Soal" : "Bahas di Akhir"}
                  </span>
                </>
              )}
              {effectiveAnswerSpaceCm > 0 && effectiveExplanationMode !== "inline" && (
                <>
                  <span className="hidden md:inline">·</span>
                  <span className="hidden md:inline">Coretan {effectiveAnswerSpaceCm}cm</span>
                </>
              )}
              {effectiveBackgroundWatermark && (
                <>
                  <span className="hidden md:inline">·</span>
                  <span className="hidden md:inline">Tanda Air</span>
                </>
              )}
              {effectiveBackgroundGrid && (
                <>
                  <span className="hidden md:inline">·</span>
                  <span className="hidden md:inline">Kertas Kotak</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 ml-auto shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setFitToScreen((prev) => !prev)}
            className="min-h-[44px] min-w-[44px] px-2 sm:px-2.5 text-xs shrink-0"
            aria-label={fitToScreen ? "Ukuran Asli (100%)" : "Pas Layar"}
            title={fitToScreen ? "Ukuran Asli (100%)" : "Pas Layar"}
          >
            {fitToScreen ? (
              <Minimize2 className="size-4" data-icon="inline-start" />
            ) : (
              <Maximize2 className="size-4" data-icon="inline-start" />
            )}
            <span className="hidden sm:inline">{fitToScreen ? "100%" : "Pas Layar"}</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsSettingsOpen(true)}
            className="min-h-[44px] min-w-[44px] px-2.5 sm:px-3 shrink-0"
            aria-label="Pengaturan Cetak"
            title="Pengaturan Cetak"
          >
            <SlidersHorizontal data-icon="inline-start" />
            <span className="hidden sm:inline">Pengaturan</span>
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => window.print()}
            className="min-h-[44px] min-w-[44px] px-2.5 sm:px-3 shrink-0"
            aria-label="Cetak atau simpan PDF"
            title="Cetak atau simpan PDF"
          >
            <Printer data-icon="inline-start" />
            <span className="hidden sm:inline">Cetak PDF</span>
          </Button>
        </div>
      </div>

      {/* ── Sliding Panel (Sheet Drawer Kanan) ──────────────────── */}
      <BundlePrintSettingsDrawer
        open={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
        applyStudentPreset={applyStudentPreset}
        applyTeacherPreset={applyTeacherPreset}
        canShowKey={canShowKey}
        canShowExplanation={canShowExplanation}
        isTwoColumn={isTwoColumn}
        setBodyColumns={setBodyColumns}
        columns={columns}
        setColumns={setColumns}
        effectiveBackgroundWatermark={effectiveBackgroundWatermark}
        setBackgroundWatermarkOverride={setBackgroundWatermarkOverride}
        effectiveBackgroundGrid={effectiveBackgroundGrid}
        setBackgroundGridOverride={setBackgroundGridOverride}
        questionItems={questionItems}
        effectiveColumnBreaks={effectiveColumnBreaks}
        toggleColumnBreak={toggleColumnBreak}
        effectiveBrandColor={effectiveBrandColor}
        setBrandColorOverride={setBrandColorOverride}
        brandPresetColors={BRAND_PRESET_COLORS}
        effectiveAnswerSpaceCm={effectiveAnswerSpaceCm}
        setAnswerSpaceCmOverride={setAnswerSpaceCmOverride}
        answerSpaceOptions={ANSWER_SPACE_OPTIONS}
        effectiveKeyMode={effectiveKeyMode}
        setKeyModeOverride={setKeyModeOverride}
        effectiveExplanationMode={effectiveExplanationMode}
        setExplanationModeOverride={setExplanationModeOverride}
        includeAnswerSheet={includeAnswerSheet}
        setIncludeAnswerSheet={setIncludeAnswerSheet}
        handleSaveDefault={handleSaveDefault}
        isSaving={isSaving}
      />

      {/* ── Naskah (yang dicetak) ───────────────────────────────── */}
      {/* Wrapper horizontal scroll: di mobile naskah mulai dari x=0 (kiri) dan bisa discroll ke kanan tanpa terpotong di kiri */}
      <div
        className={cn(
          "print-scroll-wrapper w-full p-2 sm:p-8 print:p-0 print:m-0 print:overflow-visible print:block",
          fitToScreen ? "overflow-x-hidden" : "overflow-x-auto",
        )}
      >
        <div
          className={cn(
            "print-sheet worksheet mx-auto bg-white text-black border rounded-sm print:border-0 print:p-0 print:shadow-none print:w-full print:min-w-0 print:max-w-none print:min-h-0",
            fitToScreen && "worksheet-fit-screen",
            effectiveBackgroundGrid && "worksheet-grid",
            effectiveBackgroundWatermark && "worksheet-watermark",
          )}
          style={{ "--paper-brand": effectiveBrandColor } as React.CSSProperties}
        >
        {effectiveBackgroundWatermark && <PrintWatermark />}

        {/* Running Header Halaman Lanjutan (Halaman 2+) */}
        <BundlePrintHeader
          title={bundle.title}
          exerciseLabel="Latihan 1"
        />

        {/* Kop Resmi Naskah Halaman Pertama (Mockup kop.png) */}
        <BundlePrintKop
          title={bundle.title}
          grade={bundle.grade}
          year={bundle.year}
          questionCount={questionItems.length}
          durationMinutes={durationMinutes}
          exerciseLabel="Latihan 1"
          institutionName={institution}
          tagline={tagline ?? undefined}
          logoUrl={config.institutionLogoUrl && !logoFailed ? config.institutionLogoUrl : undefined}
          onLogoError={() => setLogoFailed(true)}
        />

        {instructions && (
          <div
            className="instruction print-instruction border rounded-md p-2.5 mb-4 text-xs italic"
            style={{
              borderColor: effectiveBrandColor,
              backgroundColor: `${effectiveBrandColor}0d`,
            }}
          >
            {instructions}
          </div>
        )}

        {/* Daftar soal - 1 atau 2 kolom (Tata letak A4 statis) */}
        <ol
          className={cn(
            isTwoColumn
              ? "print-columns [&>li]:break-inside-avoid"
              : "print-single-column flex flex-col gap-5",
          )}
        >
          {items.map((it, idx) => {
            if (it.item.role === "stimulus") {
              return (
                <li key={it.item.id} className="print-question print-stimulus list-none">
                  <div className="rounded border-l-4 border-gray-300 bg-gray-50 p-3 text-sm">
                    <MathContent content={it.question.contentMarkdown} />
                  </div>
                </li>
              );
            }
            // Nomor urut soal (1..n) atau nomor butir kustom (misal "1a", "1b")
            const num = questionItems.findIndex((q) => q.item.id === it.item.id) + 1;
            const displayNumber = it.item.itemNumber
              ? (it.item.itemNumber.endsWith(".") ? it.item.itemNumber : `${it.item.itemNumber}.`)
              : `${num}.`;
            const correct = itemCorrectLabels(it);
            const showNumber = config.showQuestionNumber !== false;
            const qId = it.item.questionId ?? it.question.id;
            const isSectionStart = Boolean(it.item.sectionName && it.item.sectionName !== items[idx - 1]?.item.sectionName);
            const isForceColumn = isTwoColumn && effectiveColumnBreaks.includes(qId);
            return (
              <Fragment key={it.item.id}>
                {isSectionStart && (
                  <li
                    data-break={isForceColumn ? "force-column" : undefined}
                    className="print-section-header list-none font-bold text-xs uppercase tracking-wider text-slate-700 pt-2 pb-1 border-b border-slate-300 col-span-full"
                  >
                    {it.item.sectionName}
                  </li>
                )}
                <li
                  data-first-item={num === 1 ? "true" : undefined}
                  data-break={isForceColumn && !isSectionStart ? "force-column" : undefined}
                  className="print-question print-item flex gap-2"
                >
                  {showNumber && (
                    <span className="print-item-number w-[22px] shrink-0 text-right font-medium tabular-nums">{displayNumber}</span>
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
                            ? "grid grid-cols-2"
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
                    const { labels, rows } = readMatrixGridPayload(it.question.dataPayload);
                    if (rows.length === 0) return null;
                    return (
                      <div className="mt-2 overflow-x-auto break-inside-avoid">
                        <table className="w-full border-collapse border border-gray-300 text-xs print:border-black">
                          <thead>
                            <tr className="bg-gray-100 print:bg-gray-200">
                              <th className="w-8 border border-gray-300 p-1.5 text-center font-medium print:border-black">No.</th>
                              <th className="border border-gray-300 p-1.5 text-left font-medium print:border-black">Pernyataan</th>
                              {labels.map((l, li) => (
                                <th key={li} className="w-16 border border-gray-300 p-1.5 text-center font-medium print:border-black">{l}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((r, ri) => (
                              <tr key={ri} className="border-t border-gray-200 print:border-black">
                                <td className="border border-gray-300 p-1.5 text-center print:border-black">
                                  {ri + 1}.
                                </td>
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
                    const { premises, responses } = readMatchingPayload(it.question.dataPayload);
                    const matchingPairs = (it.question.answerKey as { matchingPairs?: Record<string, string> } | null)?.matchingPairs ?? {};
                    if (premises.length === 0 && responses.length === 0) return null;
                    return (
                      <div className="mt-2 grid grid-cols-2 gap-4 text-xs break-inside-avoid">
                        <div className="flex flex-col gap-1.5 border-r border-gray-200 pr-2 print:border-black">
                          <span className="font-semibold text-gray-700 print:text-black">Premis / Pertanyaan:</span>
                          {premises.map((p, pi) => {
                            const keyLabel = matchingResponseLabel(matchingPairs, p.id, responses);
                            return (
                            <div key={p.id ?? pi} className="flex gap-1.5 rounded border border-gray-200 bg-gray-50 p-1 print:border-black print:bg-transparent">
                              <span className="font-bold">{premiseLabel(pi)}.</span>
                              <div className="flex-1">
                                <MathContent content={p.contentMarkdown} />
                                {effectiveKeyMode === "inline" && keyLabel && (
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
                            <div key={res.id ?? ri} className="flex gap-1.5 rounded border border-gray-200 bg-gray-50 p-1 print:border-black print:bg-transparent">
                              <span className="font-bold">{responseLabel(ri)}.</span>
                              <div className="flex-1">
                                <MathContent content={res.contentMarkdown} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Area ruang coret-coretan siswa - polos & bersih tanpa kotak/border di semua tipe soal (PG, isian, esai, matriks, matching) */}
                  {effectiveExplanationMode !== "inline" && effectiveAnswerSpaceCm > 0 && (
                    <div
                      data-slot="scratch-space"
                      className="w-full break-inside-avoid"
                      style={{ height: `${effectiveAnswerSpaceCm}cm` }}
                      aria-hidden="true"
                    />
                  )}

                  {/* Pembahasan tepat di bawah soal (inline mode) */}
                  {effectiveExplanationMode === "inline" && (() => {
                    const exp = explanationOf(it);
                    if (!exp) return null;
                    return (
                      <div className="mt-2.5 rounded border-l-2 border-brand bg-brand/5 p-2.5 text-xs text-foreground break-inside-avoid print:bg-transparent print:border-l print:text-black">
                        <span className="mb-1 block font-bold text-brand print:text-black">
                          Pembahasan:
                        </span>
                        <MathContent content={exp} />
                      </div>
                    );
                  })()}
                </div>
              </li>
            </Fragment>
          );
        })}
        </ol>

        {/* Lembar kunci jawaban terpisah */}
        {effectiveKeyMode === "separate" && canShowKey && (
          <section className="print-sheet-answerkey mt-8 border-t pt-4">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide">Kunci Jawaban</h2>
            <ol className="grid grid-cols-3 gap-x-8 gap-y-1 text-sm">
              {questionItems.map((it, i) => {
                const correct = itemCorrectLabels(it);
                const text = it.question.answerKey?.text ?? null;
                const matchingPayload =
                  it.question.questionType === "matching"
                    ? readMatchingPayload(it.question.dataPayload)
                    : null;
                const matchingShown = matchingPayload
                  ? matchingKeySummary(
                      (it.question.answerKey as { matchingPairs?: Record<string, string> } | null)?.matchingPairs,
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

        {/* Running Footer Semua Halaman (Mockup footer.png) */}
        <BundlePrintFooter pageNumber={1} />
        </div>
      </div>
    </div>
  );
}
