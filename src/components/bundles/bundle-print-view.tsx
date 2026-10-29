"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  GraduationCap,
  Printer,
  Save,
  SlidersHorizontal,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
  const updateBundle = useUpdateBundle(bundleId);
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
  const tagline = config.tagline ?? "Bank Soal & Kurasi Matematika";
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

  return (
    <div className="print-page-root flex flex-col gap-6 bg-muted/20 min-h-screen pb-12 print:block print:min-h-0 print:p-0 print:m-0 print:bg-white">
      {/* Suntikkan CSS Custom Property untuk running header Chromium */}
      <style>{`
        @media print {
          :root {
            --print-bundle-title: ${JSON.stringify(bundle.title)};
            --paper-brand: ${effectiveBrandColor};
          }
        }
      `}</style>

      {/* pageSize tidak bisa diatur lewat class (`@page` adalah konteks dokumen),
          jadi ukuran kertas non-A4 disuntik sebagai stylesheet khusus cetak. */}
      {pageSizeCss && (
        <style>{`@media print { @page { size: ${pageSizeCss} portrait; } }`}</style>
      )}

      {/* ── Bilah Atas Sticky (no-print) ────────────────────────── */}
      <div className="no-print sticky top-0 z-30 flex items-center justify-between gap-2 sm:gap-3 border-b bg-background/95 px-3 py-2 sm:px-4 sm:py-2.5 backdrop-blur shadow-xs">
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
      <Sheet open={isSettingsOpen} onOpenChange={setIsSettingsOpen} modal={false}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto flex flex-col p-0 no-print">
          <SheetHeader className="p-4 border-b">
            <SheetTitle className="flex items-center gap-2 text-base">
              <SlidersHorizontal className="w-4 h-4 text-primary" /> Pengaturan Cetak
            </SheetTitle>
            <SheetDescription className="text-xs">
              Sesuaikan tata letak dan isi naskah sebelum dicetak fisik atau disimpan ke PDF.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6">
            {/* 1. Preset Cepat */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Preset Cepat
              </span>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-[44px] flex flex-col items-start p-2 h-auto text-left"
                  onClick={applyStudentPreset}
                >
                  <span className="flex items-center gap-1 font-semibold text-xs text-foreground">
                    <GraduationCap className="w-3.5 h-3.5 text-primary" /> Mode Siswa
                  </span>
                  <span className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                    Bersih, tanpa kunci & pembahasan
                  </span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-[44px] flex flex-col items-start p-2 h-auto text-left"
                  disabled={!canShowKey && !canShowExplanation}
                  onClick={applyTeacherPreset}
                >
                  <span className="flex items-center gap-1 font-semibold text-xs text-foreground">
                    <BookOpen className="w-3.5 h-3.5 text-primary" /> Pedoman Guru
                  </span>
                  <span className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                    Kunci tebal & bahas di soal
                  </span>
                </Button>
              </div>
            </div>

            {/* 2. Tata Letak Naskah & Opsi */}
            <div className="flex flex-col gap-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Tata Letak & Kolom
              </span>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium">Kolom Naskah</span>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={!isTwoColumn ? "default" : "outline"}
                    onClick={() => setBodyColumns("1")}
                    className="min-h-[44px]"
                  >
                    Naskah 1 kolom
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={isTwoColumn ? "default" : "outline"}
                    onClick={() => setBodyColumns("2")}
                    className="min-h-[44px]"
                  >
                    Naskah 2 kolom
                  </Button>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium">Kolom Pilihan Opsi (A–E)</span>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={columns === "1" ? "default" : "outline"}
                    onClick={() => setColumns("1")}
                    className="min-h-[44px]"
                  >
                    1 kolom
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={columns === "2" ? "default" : "outline"}
                    onClick={() => setColumns("2")}
                    className="min-h-[44px]"
                  >
                    2 kolom
                  </Button>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium">Latar Belakang Naskah</span>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={effectiveBackgroundWatermark ? "default" : "outline"}
                    onClick={() => setBackgroundWatermarkOverride(!effectiveBackgroundWatermark)}
                    className="min-h-[44px] text-xs px-2"
                  >
                    Tanda Air Logo
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={effectiveBackgroundGrid ? "default" : "outline"}
                    onClick={() => setBackgroundGridOverride(!effectiveBackgroundGrid)}
                    className="min-h-[44px] text-xs px-2"
                  >
                    Kertas Kotak (0,5 cm)
                  </Button>
                </div>
                {effectiveBackgroundGrid && effectiveBackgroundWatermark ? (
                  <span className="text-[11px] text-muted-foreground">
                    Kombinasi: Kertas kotak membentang di atas tanda air logo.
                  </span>
                ) : !effectiveBackgroundGrid && !effectiveBackgroundWatermark ? (
                  <span className="text-[11px] text-muted-foreground">
                    Latar polos aktif tanpa kisi atau tanda air.
                  </span>
                ) : null}
              </div>

              {isTwoColumn && questionItems.length > 1 && (
                <div className="flex flex-col gap-1.5 pt-1 border-t">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">Lompat Kolom (Pindah ke Kolom 2)</span>
                    <span className="text-[11px] text-muted-foreground font-semibold">
                      {effectiveColumnBreaks.length} butir
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-normal">
                    Pilih nomor butir soal yang dipaksa pindah ke kolom kedua untuk menyeimbangkan halaman.
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {questionItems.slice(1).map((q, idx) => {
                      const num = idx + 2;
                      const qId = q.item.questionId ?? q.question.id;
                      const isBroken = effectiveColumnBreaks.includes(qId);
                      return (
                        <Button
                          key={q.item.id}
                          type="button"
                          size="sm"
                          variant={isBroken ? "default" : "outline"}
                          onClick={() => toggleColumnBreak(qId)}
                          className="min-h-[44px] min-w-[44px] px-2 text-xs font-semibold tabular-nums"
                          aria-label={`Butir nomor ${num} ${isBroken ? "pindah kolom" : "normal"}`}
                        >
                          #{num}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-1.5 pt-1 border-t">
                <span className="text-xs font-medium">Warna Identitas Brand</span>
                <div className="grid grid-cols-3 gap-1.5">
                  {BRAND_PRESET_COLORS.map((bc) => (
                    <Button
                      key={bc.value}
                      type="button"
                      size="sm"
                      variant={effectiveBrandColor === bc.value ? "default" : "outline"}
                      onClick={() => setBrandColorOverride(bc.value)}
                      className="min-h-[44px] text-xs px-1.5 sm:px-2 flex items-center justify-center gap-1.5"
                    >
                      <span
                        className="size-3 rounded-full shrink-0 border"
                        style={{ backgroundColor: bc.value }}
                      />
                      <span className="truncate">{bc.label.split(" ")[0]}</span>
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            {/* 3. Ruang Coret-coretan Siswa */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Ruang Coret-coretan Siswa
                </span>
                <span className="text-xs font-bold text-primary tabular-nums">
                  {effectiveAnswerSpaceCm} cm
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-normal">
                Ruang coretan polos (tanpa border) di bawah tiap soal (PG, isian, esai). Otomatis ditiadakan bila pembahasan di bawah soal aktif.
              </p>
              <div className="grid grid-cols-5 gap-1.5">
                {ANSWER_SPACE_OPTIONS.map((cm) => (
                  <Button
                    key={cm}
                    type="button"
                    size="sm"
                    variant={effectiveAnswerSpaceCm === cm ? "default" : "outline"}
                    onClick={() => setAnswerSpaceCmOverride(cm)}
                    className="min-h-[44px] text-xs font-medium"
                  >
                    {cm === 0 ? "0cm" : `${cm}cm`}
                  </Button>
                ))}
              </div>
            </div>

            {/* 4. Kunci Jawaban & Pembahasan */}
            <div className="flex flex-col gap-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Kunci Jawaban & Pembahasan
              </span>

              {/* Kunci Jawaban */}
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium">Pilihan Kunci</span>
                <div className="grid grid-cols-3 gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant={effectiveKeyMode === "hidden" ? "default" : "outline"}
                    onClick={() => setKeyModeOverride("hidden")}
                    className="min-h-[44px] text-xs"
                  >
                    Sembunyikan
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={effectiveKeyMode === "inline" ? "default" : "outline"}
                    disabled={!canShowKey}
                    onClick={() => setKeyModeOverride("inline")}
                    className="min-h-[44px] text-xs"
                  >
                    Tandai tebal
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={effectiveKeyMode === "separate" ? "default" : "outline"}
                    disabled={!canShowKey}
                    onClick={() => setKeyModeOverride("separate")}
                    className="min-h-[44px] text-xs"
                  >
                    Lembar terpisah
                  </Button>
                </div>
                {!canShowKey && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400">
                    Peran Anda tidak berhak melihat kunci jawaban.
                  </p>
                )}
              </div>

              {/* Pembahasan */}
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium">Pilihan Pembahasan</span>
                <div className="grid grid-cols-3 gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant={effectiveExplanationMode === "none" ? "default" : "outline"}
                    disabled={!canShowExplanation}
                    onClick={() =>
                      setExplanationModeOverride(effectiveExplanationMode === "none" ? "end" : "none")
                    }
                    className="min-h-[44px] text-xs"
                  >
                    {effectiveExplanationMode === "none" ? "Tanpa pembahasan" : "Sembunyikan"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={effectiveExplanationMode === "inline" ? "default" : "outline"}
                    disabled={!canShowExplanation}
                    onClick={() => setExplanationModeOverride("inline")}
                    className="min-h-[44px] text-xs"
                  >
                    Di bawah soal
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={effectiveExplanationMode === "end" ? "default" : "outline"}
                    disabled={!canShowExplanation}
                    onClick={() => setExplanationModeOverride("end")}
                    className="min-h-[44px] text-xs"
                  >
                    Lembar akhir
                  </Button>
                </div>
                {!canShowExplanation && (
                  <p className="text-[11px] text-muted-foreground">
                    Tidak ada pembahasan tersedia untuk paket ini.
                  </p>
                )}
              </div>

              {/* Lembar Jawaban Siswa */}
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium">Lembar Jawaban Siswa</span>
                <Button
                  type="button"
                  size="sm"
                  variant={includeAnswerSheet ? "default" : "outline"}
                  onClick={() => setIncludeAnswerSheet((v) => !v)}
                  className="min-h-[44px]"
                >
                  {includeAnswerSheet ? "Sertakan (di akhir)" : "Tanpa lembar jawaban"}
                </Button>
              </div>
            </div>
          </div>

          {/* Footer Panel: Aksi Simpan Baku ke DB */}
          <div className="p-4 border-t bg-muted/40 flex flex-col gap-2 mt-auto">
            <Button
              type="button"
              variant="default"
              onClick={handleSaveDefault}
              disabled={isSaving}
              className="min-h-[44px] w-full"
            >
              <Save data-icon="inline-start" /> {isSaving ? "Menyimpan…" : "Simpan sebagai Baku Paket Ini"}
            </Button>
            <p className="text-[10px] text-center text-muted-foreground">
              Menyimpan preferensi tata letak ke database agar naskah selalu terbuka dengan pengaturan ini.
            </p>
          </div>
        </SheetContent>
      </Sheet>

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

        {/* Kop Resmi (Format Varian C Prototype Soal) */}
        <header className="header print-header mb-4" style={{ borderColor: effectiveBrandColor }}>
          <div className="headerTop flex justify-between items-start">
            <div className="headerLeft flex items-center gap-2">
              {config.institutionLogoUrl && !logoFailed ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={config.institutionLogoUrl}
                  alt={institution}
                  className="h-9 w-auto max-w-[120px] object-contain rounded"
                  onError={() => setLogoFailed(true)}
                />
              ) : (
                <div
                  className="logo text-white px-2 py-1 rounded text-[10px] font-bold text-center leading-tight"
                  style={{ backgroundColor: effectiveBrandColor }}
                >
                  MATH<br />MY ID
                </div>
              )}
              <div className="institution text-xs font-bold leading-tight">
                {institution.toUpperCase()}
                {tagline && (
                  <span className="tagline block font-normal text-[10px] text-gray-600">
                    {tagline}
                  </span>
                )}
              </div>
            </div>
            <div
              className="title print-bundle-title text-2xl font-extrabold tracking-wide text-right"
              style={{ color: effectiveBrandColor }}
            >
              {bundle.title}
            </div>
          </div>
          <hr
            className="headerRule border-t-[2.5px] my-2"
            style={{ borderTopColor: effectiveBrandColor }}
          />
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
            const qId = it.item.questionId ?? it.question.id;
            const isForceColumn = isTwoColumn && effectiveColumnBreaks.includes(qId);
            return (
              <li
                key={it.item.id}
                data-first-item={num === 1 ? "true" : undefined}
                data-break={isForceColumn ? "force-column" : undefined}
                className="print-question print-item flex gap-2"
              >
                {showNumber && (
                  <span className="print-item-number w-[22px] shrink-0 text-right font-medium tabular-nums">{num}.</span>
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
        </div>
      </div>
    </div>
  );
}
