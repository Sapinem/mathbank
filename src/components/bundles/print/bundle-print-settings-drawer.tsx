"use client";

import {
  SlidersHorizontal,
  GraduationCap,
  BookOpen,
  Save,
  Palette,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { getPrintTheme, listPrintThemes, DEFAULT_THEME_ID } from "@/lib/print/themes/registry";
import type { BundleItemView } from "@/lib/hooks/use-bundles";
import type { ColumnMode, KeyMode, ExplanationMode } from "./types";

export interface BundlePrintSettingsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeThemeId?: string;
  onThemeChange?: (themeId: string) => void;
  themeOptions?: Record<string, Record<string, unknown>>;
  onThemeOptionChange?: (themeId: string, key: string, value: unknown) => void;
  applyStudentPreset: () => void;
  applyTeacherPreset: () => void;
  canShowKey: boolean;
  canShowExplanation: boolean;
  isTwoColumn: boolean;
  setBodyColumns: (col: ColumnMode) => void;
  columns: ColumnMode;
  setColumns: (col: ColumnMode) => void;
  effectiveBackgroundWatermark: boolean;
  setBackgroundWatermarkOverride: (val: boolean) => void;
  effectiveBackgroundGrid: boolean;
  setBackgroundGridOverride: (val: boolean) => void;
  questionItems: BundleItemView[];
  effectiveColumnBreaks: string[];
  toggleColumnBreak: (qId: string) => void;
  effectiveBrandColor: string;
  setBrandColorOverride: (color: string) => void;
  brandPresetColors: readonly { label: string; value: string }[];
  effectiveAnswerSpaceCm: number;
  setAnswerSpaceCmOverride: (cm: number) => void;
  answerSpaceOptions: readonly number[];
  effectiveKeyMode: KeyMode;
  setKeyModeOverride: (mode: KeyMode) => void;
  effectiveExplanationMode: ExplanationMode;
  setExplanationModeOverride: (mode: ExplanationMode) => void;
  includeAnswerSheet: boolean;
  setIncludeAnswerSheet: (include: boolean | ((prev: boolean) => boolean)) => void;
  handleSaveDefault: () => void;
  isSaving: boolean;
}

export function BundlePrintSettingsDrawer({
  open,
  onOpenChange,
  activeThemeId,
  onThemeChange,
  themeOptions,
  onThemeOptionChange,
  applyStudentPreset,
  applyTeacherPreset,
  canShowKey,
  canShowExplanation,
  isTwoColumn,
  setBodyColumns,
  columns,
  setColumns,
  effectiveBackgroundWatermark,
  setBackgroundWatermarkOverride,
  effectiveBackgroundGrid,
  setBackgroundGridOverride,
  questionItems,
  effectiveColumnBreaks,
  toggleColumnBreak,
  effectiveBrandColor,
  setBrandColorOverride,
  brandPresetColors,
  effectiveAnswerSpaceCm,
  setAnswerSpaceCmOverride,
  answerSpaceOptions,
  effectiveKeyMode,
  setKeyModeOverride,
  effectiveExplanationMode,
  setExplanationModeOverride,
  includeAnswerSheet,
  setIncludeAnswerSheet,
  handleSaveDefault,
  isSaving,
}: BundlePrintSettingsDrawerProps) {
  const effectiveThemeId = activeThemeId || DEFAULT_THEME_ID;
  const activeTheme = getPrintTheme(effectiveThemeId);
  const currentThemeOptions = themeOptions?.[effectiveThemeId] || {};
  const themes = listPrintThemes();

  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
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

          {/* 2. Tema Naskah Cetak */}
          <div className="flex flex-col gap-2.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-primary" /> Tema Naskah Cetak
            </span>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="print-theme-select" className="text-xs font-medium">
                Pilih Format Bingkai & Kop
              </label>
              <select
                id="print-theme-select"
                aria-label="Pilih Format Bingkai & Kop"
                value={effectiveThemeId}
                onChange={(e) => onThemeChange?.(e.target.value)}
                className="min-h-[44px] w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-medium shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
              >
                {themes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-muted-foreground leading-snug">
                {activeTheme.description}
              </p>
            </div>

            {/* Slot Kontrol Opsi Kustom Tema Aktif */}
            {activeTheme.renderOptions && (
              <div className="flex flex-col gap-1.5 mt-1" data-slot="theme-options-slot">
                <span className="text-xs font-medium text-foreground">
                  Opsi Khusus: {activeTheme.name}
                </span>
                {activeTheme.renderOptions({
                  options: currentThemeOptions,
                  onChange: (key, val) => onThemeOptionChange?.(activeTheme.id, key, val),
                })}
              </div>
            )}
          </div>

          {/* 3. Tata Letak Naskah & Opsi */}
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
                {brandPresetColors.map((bc) => (
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
              {answerSpaceOptions.map((cm) => (
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
            Menyimpan tata letak aktif ke kolom print_config paket ini.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
