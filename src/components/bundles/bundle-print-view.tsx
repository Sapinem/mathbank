"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
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
import { useBundle, useUpdateBundle } from "@/lib/hooks/use-bundles";
import type { BundlePrintConfig } from "@/lib/db/schema/bundle";
import { getPrintTheme, DEFAULT_THEME_ID } from "@/lib/print/themes/registry";
import { PrintWatermark } from "./print-watermark";
import { BundlePrintSettingsDrawer } from "./print/bundle-print-settings-drawer";
import { BundlePrintStudioToolbar } from "./print/bundle-print-studio-toolbar";
import { HeaderCatalogView } from "@/lib/print/themes/math-my-id/catalog/header-catalog-view";
import { FooterCatalogView } from "@/lib/print/themes/math-my-id/catalog/footer-catalog-view";
import { BundlePrintHeader } from "./print/bundle-print-header";
import { BundlePrintFooter } from "./print/bundle-print-footer";
import { PrintQuestionItem } from "./print/print-question-item";
import { PrintAnswerKeySheet } from "./print/print-answer-key-sheet";
import { PrintExplanationSheet } from "./print/print-explanation-sheet";
import { PrintAnswerSheet } from "./print/print-answer-sheet";
import { explanationOf } from "./print/item-helpers";
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
 *
 * Komposisi (sejak pemecahan 717 → 526 baris):
 *  - berkas ini memegang STATE sesi cetak + bilah atas + kanvas naskah;
 *  - satu butir soal → `print/print-question-item.tsx`;
 *  - lembar kunci/pembahasan/jawaban → `print/print-*-sheet.tsx`;
 *  - pembaca data soal → `print/item-helpers.ts`.
 * Pembagian ini sengaja: komponen turunan tidak menerima setter, hanya nilai
 * jadi, sehingga tidak ada dua tempat yang bisa mengubah state cetak.
 */

import type { ColumnMode, KeyMode, ExplanationMode } from "./print/types";
export type { ColumnMode, KeyMode, ExplanationMode };

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
  const [studioViewMode, setStudioViewMode] = useState<"a4" | "catalog-header" | "catalog-footer">("a4");
  const [backgroundGridOverride, setBackgroundGridOverride] = useState<boolean | null>(null);
  const [backgroundWatermarkOverride, setBackgroundWatermarkOverride] = useState<boolean | null>(null);
  const [columnBreaksOverride, setColumnBreaksOverride] = useState<string[] | null>(null);
  const [brandColorOverride, setBrandColorOverride] = useState<string | null>(null);
  const [themeIdOverride, setThemeIdOverride] = useState<string | null>(null);
  const [themeOptionsOverride, setThemeOptionsOverride] = useState<Record<string, Record<string, unknown>> | null>(null);
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
  const effectiveThemeId: string =
    themeIdOverride ?? (config.themeId || DEFAULT_THEME_ID);
  const effectiveThemeOptions: Record<string, Record<string, unknown>> =
    themeOptionsOverride ?? (config.themeOptions || {});
  const activeTheme = getPrintTheme(effectiveThemeId);

  const handleThemeChange = (newThemeId: string) => {
    setThemeIdOverride(newThemeId);
  };

  const handleThemeOptionChange = (tId: string, key: string, value: unknown) => {
    setThemeOptionsOverride((prev) => {
      const current = prev ?? config.themeOptions ?? {};
      const themeSpecific = current[tId] ?? {};
      return {
        ...current,
        [tId]: {
          ...themeSpecific,
          [key]: value,
        },
      };
    });
  };

  const mathMyIdOpts = (effectiveThemeOptions["math-my-id"] ?? {}) as Record<string, unknown>;
  const currentHeaderCode = typeof mathMyIdOpts.headerCode === "string" ? mathMyIdOpts.headerCode : "A1";
  const currentFooterCode = typeof mathMyIdOpts.footerCode === "string" ? mathMyIdOpts.footerCode : "F1";
  const is1Line = Boolean(mathMyIdOpts.is1Line ?? false);

  const handleHeaderCodeChange = (code: string) => {
    handleThemeOptionChange("math-my-id", "headerCode", code);
  };

  const handleFooterCodeChange = (code: string) => {
    handleThemeOptionChange("math-my-id", "footerCode", code);
  };

  const handleToggleLines = () => {
    handleThemeOptionChange("math-my-id", "is1Line", !is1Line);
  };

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
          themeId: effectiveThemeId,
          themeOptions: effectiveThemeOptions,
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

      {/* ── Bilah Atas Studio (no-print) ────────────────────────── */}
      <BundlePrintStudioToolbar
        bundleId={bundleId}
        title={bundle.title}
        studioViewMode={studioViewMode}
        onViewModeChange={setStudioViewMode}
        headerCode={currentHeaderCode}
        onHeaderCodeChange={handleHeaderCodeChange}
        footerCode={currentFooterCode}
        onFooterCodeChange={handleFooterCodeChange}
        is1Line={is1Line}
        onToggleLines={handleToggleLines}
        onToggleSettings={() => setIsSettingsOpen(true)}
        onPrint={() => window.print()}
        isMathMyIdTheme={effectiveThemeId === "math-my-id"}
        fitToScreen={fitToScreen}
        onToggleFitToScreen={() => setFitToScreen((prev) => !prev)}
      />

      {/* ── Sliding Panel (Sheet Drawer Kanan) ──────────────────── */}
      <BundlePrintSettingsDrawer
        open={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
        activeThemeId={effectiveThemeId}
        onThemeChange={handleThemeChange}
        themeOptions={effectiveThemeOptions}
        onThemeOptionChange={handleThemeOptionChange}
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

      {/* ── Mode Galeri Katalog (Khusus di Layar, Tersembunyi saat Cetak) ── */}
      {studioViewMode === "catalog-header" && (
        <div className="no-print print:hidden w-full">
          <HeaderCatalogView
            title={bundle.title}
            course={bundle.grade ? `Kelas ${bundle.grade}` : tagline}
            exerciseLabel="Latihan 1"
            durationMinutes={durationMinutes}
            currentHeaderCode={currentHeaderCode}
            logoStyle={mathMyIdOpts.logoStyle === "circle" ? "circle" : "mi"}
            onSelectHeader={(code) => {
              handleHeaderCodeChange(code);
              setStudioViewMode("a4");
            }}
            onBackToA4={() => setStudioViewMode("a4")}
          />
        </div>
      )}

      {studioViewMode === "catalog-footer" && (
        <div className="no-print print:hidden w-full">
          <FooterCatalogView
            pageNumber={1}
            totalPages={6}
            currentFooterCode={currentFooterCode}
            onSelectFooter={(code) => {
              handleFooterCodeChange(code);
              setStudioViewMode("a4");
            }}
            onBackToA4={() => setStudioViewMode("a4")}
          />
        </div>
      )}

      {/* ── Naskah (yang dicetak) ───────────────────────────────── */}
      {/* Wrapper horizontal scroll: di mobile naskah mulai dari x=0 (kiri) dan bisa discroll ke kanan tanpa terpotong di kiri */}
      <div
        className={cn(
          "print-scroll-wrapper w-full p-2 sm:p-8 print:p-0 print:m-0 print:overflow-visible print:block",
          fitToScreen ? "overflow-x-hidden" : "overflow-x-auto",
          studioViewMode !== "a4" && "hidden print:block",
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

        {/* Cover blok putih halaman 1 di cetak agar fixed running header tidak bocor ke halaman 1 */}
        <div data-slot="print-page1-header-cover" className="print-page1-header-cover hidden print:block" aria-hidden="true" />

        {/* Running Header Halaman Lanjutan (Halaman 2+) */}
        {activeTheme.Header ? (
          <activeTheme.Header
            title={bundle.title}
            exerciseLabel="Latihan 1"
            options={effectiveThemeOptions[activeTheme.id] ?? {}}
          />
        ) : (
          <BundlePrintHeader
            title={bundle.title}
            exerciseLabel="Latihan 1"
          />
        )}

        {/* Kop Resmi Naskah Halaman Pertama dari Tema Aktif */}
        <activeTheme.Kop
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
          options={effectiveThemeOptions[activeTheme.id] ?? {}}
          instructions={instructions}
          brandColor={effectiveBrandColor}
        />

        {activeTheme.id === "math-my-id" && instructions && (
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
            const isSectionStart = Boolean(
              it.item.sectionName && it.item.sectionName !== items[idx - 1]?.item.sectionName,
            );
            const qId = it.item.questionId ?? it.question.id;
            const isForceColumn = isTwoColumn && effectiveColumnBreaks.includes(qId);
            const ordinal =
              it.item.role === "stimulus"
                ? 0
                : questionItems.findIndex((q) => q.item.id === it.item.id) + 1;
            return (
              <PrintQuestionItem
                key={it.item.id}
                item={it}
                ordinal={ordinal}
                isFirst={idx === 0}
                sectionName={isSectionStart ? (it.item.sectionName ?? null) : null}
                forceColumn={isForceColumn}
                showNumber={config.showQuestionNumber !== false}
                optionColumns={columns}
                keyMode={effectiveKeyMode}
                explanationMode={effectiveExplanationMode}
                answerSpaceCm={effectiveAnswerSpaceCm}
              />
            );
          })}
        </ol>

        {effectiveKeyMode === "separate" && canShowKey && (
          <PrintAnswerKeySheet items={questionItems} />
        )}

        {effectiveExplanationMode === "end" && canShowExplanation && (
          <PrintExplanationSheet items={questionItems} />
        )}

        {includeAnswerSheet && <PrintAnswerSheet items={questionItems} />}

        {/* Seksi Tambahan Khusus Tema (Bila Ada) */}
        {activeTheme.ExtraSection && (
          <activeTheme.ExtraSection
            title={bundle.title}
            institutionName={institution}
            options={effectiveThemeOptions[activeTheme.id] ?? {}}
          />
        )}

        {/* Running Footer Semua Halaman */}
        {activeTheme.Footer ? (
          <activeTheme.Footer
            institutionName={institution}
            options={effectiveThemeOptions[activeTheme.id] ?? {}}
          />
        ) : (
          <BundlePrintFooter pageNumber={1} />
        )}
        </div>
      </div>
    </div>
  );
}
