import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { DotMatrixOrnament, TechnicalKopBorder } from "./bundle-print-icons";

export interface BundlePrintKopProps {
  title: string;
  exerciseLabel?: string;
  packageCode?: string;
  sectionNumber?: string;
  grade?: string | null;
  year?: number | null;
  questionCount?: number;
  durationMinutes?: number | null;
  logoUrl?: string;
  institutionName?: string;
  tagline?: string;
  onLogoError?: () => void;
  className?: string;
}

/**
 * Komponen Kop Resmi Naskah Halaman Pertama (Mockup `kop.png`).
 * Dikonstruksi murni menggunakan HTML, CSS modern, dan SVG vektor (bebas raster background).
 */
export function BundlePrintKop({
  title,
  exerciseLabel = "Latihan 1",
  grade,
  year,
  questionCount,
  durationMinutes,
  logoUrl,
  institutionName,
  tagline,
  onLogoError,
  className,
}: BundlePrintKopProps) {
  return (
    <header
      data-slot="bundle-print-kop"
      className={cn(
        "bundle-print-kop print-header relative w-full bg-white text-[#111111] overflow-hidden select-none pb-1 mb-4",
        className,
      )}
      style={{
        printColorAdjust: "exact",
        WebkitPrintColorAdjust: "exact",
      }}
    >
      {/* ── Area Atas Kop: Logo Resmi di Paling Kiri, Judul & Ornamen Teknis ── */}
      <div className="flex items-center justify-between gap-2.5 sm:gap-3.5 relative z-10 pt-0.5 px-0.5">
        {/* Sisi Kiri: Logo Resmi Langsung di Paling Kiri */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          {/* Logo / Brand Institusi */}
          <div className="flex items-center gap-2">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt={institutionName || "Logo Institusi"}
                className="h-7 sm:h-8 w-auto object-contain shrink-0"
                onError={onLogoError}
                style={{
                  height: "28px",
                  maxHeight: "28px",
                  width: "auto",
                  printColorAdjust: "exact",
                  WebkitPrintColorAdjust: "exact",
                }}
              />
            ) : (!institutionName || institutionName.toLowerCase() === "math my id") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src="/brand/logo-text-lite.png"
                alt="Math My ID"
                className="h-7 sm:h-8 w-auto object-contain shrink-0"
                onError={onLogoError}
                style={{
                  height: "28px",
                  maxHeight: "28px",
                  width: "auto",
                  printColorAdjust: "exact",
                  WebkitPrintColorAdjust: "exact",
                }}
              />
            ) : null}

            {institutionName && institutionName.toLowerCase() !== "math my id" && (
              <div className="flex flex-col justify-center">
                <span className="font-bold text-xs sm:text-sm text-[var(--paper-navy,#002b66)] uppercase leading-tight">
                  {institutionName.toUpperCase()}
                </span>
                {tagline && (
                  <span className="text-[10px] text-gray-600 font-normal leading-tight">
                    {tagline}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Garis Vertikal Pemisah */}
          <div className="h-7 sm:h-8 w-[1.5px] bg-slate-200 shrink-0" />
        </div>

        {/* Sisi Tengah: Judul Naskah & Pill Badge Latihan (Perkecil agar muat leluasa) */}
        <div className="flex flex-col justify-center min-w-0 flex-1 px-1">
          <h1 className="text-xs sm:text-sm md:text-[15px] font-extrabold text-[var(--paper-navy,#002b66)] tracking-tight uppercase leading-snug truncate">
            {title.toUpperCase()}
          </h1>

          <div className="mt-0.5 flex items-center gap-2">
            {/* Pill Badge Latihan */}
            <div
              className="inline-flex items-center gap-1 bg-[var(--paper-navy,#002b66)] text-white text-[9px] sm:text-[10px] font-semibold px-2 py-0.5 rounded-full shadow-xs shrink-0"
              style={{
                printColorAdjust: "exact",
                WebkitPrintColorAdjust: "exact",
              }}
            >
              <FileText className="size-2.5" aria-hidden="true" />
              <span className="uppercase tracking-wider">{exerciseLabel.toUpperCase()}</span>
            </div>
          </div>
        </div>

        {/* Sisi Kanan: Ornamen Geometris Teknis (Garis Miring & Matriks Titik) */}
        <div className="flex items-center gap-1 shrink-0 relative">
          {/* Aksen 2 Garis Miring Diagonal */}
          <div className="flex items-center gap-0.5 -skew-x-[28deg] shrink-0" aria-hidden="true">
            <span
              className="w-1.5 h-5 sm:h-6 bg-[var(--paper-navy,#002b66)] rounded-xs"
              style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}
            />
            <span
              className="w-1.5 h-5 sm:h-6 bg-[var(--paper-gold,#f59e0b)] rounded-xs"
              style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}
            />
          </div>

          {/* Matriks Titik-Titik Geometris */}
          <DotMatrixOrnament className="w-11 sm:w-12 h-7 sm:h-8 text-[var(--paper-navy,#002b66)]" />
        </div>
      </div>

      {/* ── Garis Bawah Teknikal Kop dengan Simpul & Lekukan ── */}
      <TechnicalKopBorder className="mt-2" />

      {/* ── Baris Informasi Naskah (Kelas, Tahun, Soal, Durasi) ── */}
      {(grade || year || durationMinutes || questionCount) && (
        <div className="flex justify-between items-center text-xs text-slate-600 px-1 pt-1.5 font-medium border-b border-slate-100 pb-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <b>{grade ? `Kelas ${grade}` : "Matematika"}</b>
            {(year || questionCount) && (
              <>
                <span className="text-slate-300">·</span>
                <span>
                  {[year ? `Tahun ${year}` : null, questionCount ? `${questionCount} Soal` : null]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </>
            )}
          </div>
          <div className="text-right shrink-0">
            {durationMinutes && <span>Waktu: {durationMinutes} menit</span>}
          </div>
        </div>
      )}
    </header>
  );
}
