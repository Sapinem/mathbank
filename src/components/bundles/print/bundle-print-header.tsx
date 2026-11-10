import { cn } from "@/lib/utils";
import { SlantedHeaderStripes } from "./bundle-print-icons";

export interface BundlePrintHeaderProps {
  title: string;
  exerciseLabel?: string;
  className?: string;
}

/**
 * Komponen Running Header untuk Halaman Lanjutan (Halaman 2+) pada naskah cetak (Mockup `Header.png`).
 * Tampil ringkas di puncak halaman 2, 3, dst., dan tersembunyi pada halaman pertama.
 */
export function BundlePrintHeader({
  title,
  exerciseLabel = "Latihan 1",
  className,
}: BundlePrintHeaderProps) {
  return (
    <div
      data-slot="bundle-print-header"
      className={cn(
        "bundle-print-header print-running-header w-full bg-white text-[#111111] select-none pb-1",
        className,
      )}
      style={{
        printColorAdjust: "exact",
        WebkitPrintColorAdjust: "exact",
      }}
    >
      <div className="flex items-center justify-between gap-3 px-1 py-1">
        {/* Sisi Kiri: Brand + 3 Garis Miring + Judul Materi */}
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
          <span className="font-black text-xs sm:text-sm text-[var(--paper-navy,#002b66)] tracking-tight shrink-0">
            Math My ID
          </span>

          {/* 3 Aksen Garis Miring (Emas & 2x Navy) */}
          <SlantedHeaderStripes className="h-3.5" />

          {/* Judul Materi / Bab */}
          <span className="text-xs sm:text-sm text-slate-800 font-medium truncate min-w-0">
            {title}
          </span>
        </div>

        {/* Sisi Kanan: Nomor/Label Latihan & Aksen Garis Miring Kanan */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="font-bold text-xs sm:text-sm text-[var(--paper-navy,#002b66)]">
            {exerciseLabel}
          </span>

          {/* Aksen 2 Garis Miring Emas di Kanan */}
          <div className="flex items-center gap-0.5 -skew-x-[28deg] shrink-0" aria-hidden="true">
            <span
              className="w-1.5 h-3.5 bg-[var(--paper-gold,#f59e0b)] rounded-xs"
              style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}
            />
            <span
              className="w-1.5 h-3.5 bg-[var(--paper-gold,#f59e0b)] rounded-xs"
              style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}
            />
          </div>
        </div>
      </div>

      {/* Garis Pembatas Bawah Hairline dengan Lekukan Sudut */}
      <div className="w-full h-1 relative overflow-hidden" aria-hidden="true">
        <svg viewBox="0 0 1000 4" preserveAspectRatio="none" className="w-full h-1 block">
          <path
            d="M 0 3 L 80 3 L 86 1 L 1000 1"
            fill="none"
            stroke="var(--paper-navy, #002b66)"
            strokeWidth="1.5"
            opacity="0.75"
          />
        </svg>
      </div>
    </div>
  );
}
