import Link from "next/link";
import { ArrowLeft, Printer, SlidersHorizontal, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MathMyIdMiLogo } from "./bundle-print-icons";
import { HEADER_CODES, FOOTER_CODES } from "@/lib/print/themes/math-my-id/types";

export interface BundlePrintStudioToolbarProps {
  bundleId: string;
  title: string;
  studioViewMode: "a4" | "catalog-header" | "catalog-footer";
  onViewModeChange: (mode: "a4" | "catalog-header" | "catalog-footer") => void;
  headerCode: string;
  onHeaderCodeChange: (code: string) => void;
  footerCode: string;
  onFooterCodeChange: (code: string) => void;
  is1Line: boolean;
  onToggleLines: () => void;
  onToggleSettings: () => void;
  onPrint: () => void;
  isMathMyIdTheme?: boolean;
  fitToScreen?: boolean;
  onToggleFitToScreen?: () => void;
}

export function BundlePrintStudioToolbar({
  bundleId,
  title,
  studioViewMode,
  onViewModeChange,
  headerCode,
  onHeaderCodeChange,
  footerCode,
  onFooterCodeChange,
  is1Line,
  onToggleLines,
  onToggleSettings,
  onPrint,
  isMathMyIdTheme = true,
  fitToScreen = false,
  onToggleFitToScreen,
}: BundlePrintStudioToolbarProps) {
  const activeHeader = headerCode.trim().toUpperCase() || "A1";
  const activeFooter = footerCode.trim().toUpperCase() || "F1";

  return (
    <header
      data-slot="bundle-print-studio-toolbar"
      className="no-print print:hidden sticky top-0 z-40 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-3 py-2 sm:px-4 sm:py-2.5 shadow-lg select-none"
    >
      <div className="max-w-7xl mx-auto flex flex-col gap-2">
        {/* ── Baris 1: Brand/Kembali, Judul Naskah, 3 Tab View Switcher, & Tombol Aksi ── */}
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {/* Sisi Kiri: Tombol Kembali & Brand/Judul */}
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <Button
              variant="outline"
              size="sm"
              render={<Link href={`/bundles/${bundleId}`} />}
              nativeButton={false}
              className="min-h-[38px] px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700 shrink-0"
              aria-label="Kembali"
              title="Kembali ke Detail Paket"
            >
              <ArrowLeft data-icon="inline-start" className="size-4" />
              <span className="hidden sm:inline text-xs font-semibold">Kembali</span>
            </Button>

            <div className="size-8 rounded-lg bg-white px-1 flex items-center justify-center shrink-0 shadow-xs">
              <MathMyIdMiLogo className="h-4 w-auto" />
            </div>

            <div className="flex flex-col min-w-0">
              <span
                data-slot="topbar-title"
                className="text-xs sm:text-sm font-extrabold text-white truncate max-w-[140px] xs:max-w-[200px] sm:max-w-xs md:max-w-md"
              >
                Naskah: {title}
              </span>
              <span className="text-[10px] sm:text-[11px] text-slate-400 truncate">
                Studio Cetak Naskah A4 &bull; Lebar Efektif 200 mm
              </span>
            </div>
          </div>

          {/* Sisi Tengah: 3 Tab Utama Studio */}
          <div className="flex flex-wrap items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 shrink-0">
            <button
              type="button"
              data-testid="tab-mode-a4"
              onClick={() => onViewModeChange("a4")}
              className={`min-h-[44px] px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center ${
                studioViewMode === "a4"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              📄 Lembar A4
            </button>
            <button
              type="button"
              data-testid="tab-mode-catalog-header"
              onClick={() => onViewModeChange("catalog-header")}
              className={`min-h-[44px] px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center ${
                studioViewMode === "catalog-header"
                  ? "bg-amber-500 text-slate-950 font-black shadow-xs"
                  : "text-amber-300 hover:bg-slate-800"
              }`}
            >
              🗂️ Katalog Header (A1–F4)
            </button>
            <button
              type="button"
              data-testid="tab-mode-catalog-footer"
              onClick={() => onViewModeChange("catalog-footer")}
              className={`min-h-[44px] px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center ${
                studioViewMode === "catalog-footer"
                  ? "bg-emerald-500 text-slate-950 font-black shadow-xs"
                  : "text-emerald-300 hover:bg-slate-800"
              }`}
            >
              🗂️ Katalog Footer (F1–G16)
            </button>
          </div>

          {/* Sisi Kanan: Kustomisasi & Cetak PDF */}
          <div className="flex items-center gap-1.5 shrink-0">
            {onToggleFitToScreen && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onToggleFitToScreen}
                className="min-h-[44px] px-2.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700 shrink-0"
                aria-label={fitToScreen ? "Ukuran Asli (100%)" : "Pas Layar"}
                title={fitToScreen ? "Ukuran Asli (100%)" : "Pas Layar"}
              >
                {fitToScreen ? (
                  <Minimize2 className="size-4" data-icon="inline-start" />
                ) : (
                  <Maximize2 className="size-4" data-icon="inline-start" />
                )}
                <span className="hidden md:inline">{fitToScreen ? "100%" : "Pas Layar"}</span>
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onToggleSettings}
              aria-label="Pengaturan Cetak"
              title="Pengaturan Cetak"
              className="min-h-[44px] px-2.5 sm:px-3 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700 shrink-0"
            >
              <SlidersHorizontal className="size-4" data-icon="inline-start" />
              <span className="hidden sm:inline">Pengaturan</span>
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={onPrint}
              aria-label="Cetak PDF"
              className="min-h-[44px] px-3 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs shrink-0"
              title="Cetak Naskah atau Simpan ke PDF (Ctrl+P)"
            >
              <Printer className="size-4" data-icon="inline-start" />
              <span>Cetak PDF</span>
            </Button>
          </div>
        </div>

        {/* ── Baris 2: Pemilih Cepat Quick Pills (Khusus Mode A4 pada tema Math My ID) ── */}
        {studioViewMode === "a4" && isMathMyIdTheme && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-2 items-center bg-slate-950/90 px-3 py-1.5 rounded-xl border border-slate-800 text-xs">
            {/* Header Quick Pills (A1..F4) */}
            <div className="xl:col-span-5 flex items-center gap-1.5 overflow-x-auto py-0.5">
              <span className="font-extrabold text-blue-400 shrink-0 text-[11px]">HEADER:</span>
              <div className="flex items-center gap-1 shrink-0">
                {HEADER_CODES.map((code) => {
                  const isCur = activeHeader === code;
                  return (
                    <button
                      key={code}
                      type="button"
                      data-testid={`pill-header-${code}`}
                      onClick={() => onHeaderCodeChange(code)}
                      className={`min-h-[44px] px-2 py-1 rounded-md font-mono text-[10px] font-bold transition shrink-0 flex items-center justify-center ${
                        isCur
                          ? "bg-blue-600 text-white shadow-xs"
                          : "bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
                      }`}
                      title={`Pilih Variasi Header ${code}`}
                    >
                      {code}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Running Header Toggle Mode Switch */}
            <div className="xl:col-span-2 flex items-center justify-center border-t xl:border-t-0 xl:border-x border-slate-800 py-1 xl:py-0 xl:px-2 shrink-0">
              <button
                type="button"
                data-testid="toggle-lines-mode"
                onClick={onToggleLines}
                className="w-full min-h-[44px] px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 font-semibold border border-slate-700 text-[11px] truncate transition flex items-center justify-center"
                title="Beralih antara Header 2 Baris (Hal. 1) vs Running Header 1 Baris (Hal. 2+)"
              >
                {is1Line ? "Mode: 1 Baris (Hal. 2+)" : "Mode: 2 Baris (Hal. 1)"}
              </button>
            </div>

            {/* Footer Quick Pills (F1..G16) */}
            <div className="xl:col-span-5 flex items-center gap-1.5 overflow-x-auto py-0.5">
              <span className="font-extrabold text-emerald-400 shrink-0 text-[11px]">FOOTER:</span>
              <div className="flex items-center gap-1 shrink-0">
                {FOOTER_CODES.map((code) => {
                  const isCur = activeFooter === code;
                  return (
                    <button
                      key={code}
                      type="button"
                      data-testid={`pill-footer-${code}`}
                      onClick={() => onFooterCodeChange(code)}
                      className={`min-h-[44px] px-2 py-1 rounded-md font-mono text-[10px] font-bold transition shrink-0 flex items-center justify-center ${
                        isCur
                          ? "bg-emerald-600 text-white shadow-xs"
                          : "bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
                      }`}
                      title={`Pilih Variasi Footer ${code}`}
                    >
                      {code}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
