import { cn } from "@/lib/utils";
import {
  YouTubeIcon,
  InstagramIcon,
  FacebookIcon,
  TelegramIcon,
  TwitterIcon,
} from "./bundle-print-icons";

export interface BundlePrintFooterProps {
  pageNumber?: number | string;
  className?: string;
}

/**
 * Komponen Running Footer untuk Semua Halaman Naskah Cetak (Mockup `footer.png`).
 * Memuat 5 kanal media sosial resmi Math My ID dan badge nomor halaman poligon bersudut miring.
 */
export function BundlePrintFooter({
  pageNumber = 1,
  className,
}: BundlePrintFooterProps) {
  return (
    <footer
      data-slot="bundle-print-footer"
      className={cn(
        "bundle-print-footer print-running-footer w-full bg-white text-[#111111] select-none border-t border-slate-200 mt-auto",
        className,
      )}
      style={{
        printColorAdjust: "exact",
        WebkitPrintColorAdjust: "exact",
      }}
    >
      <div className="flex items-center justify-between min-h-[32px] sm:min-h-[36px] pl-1 pr-0">
        {/* Sisi Kiri: 5 Kanal Media Sosial Resmi */}
        <div className="flex items-center gap-1 sm:gap-2 text-[10px] sm:text-xs font-semibold text-[var(--paper-navy,#002b66)] flex-wrap py-1">
          {/* YouTube */}
          <div className="flex items-center gap-1 shrink-0">
            <YouTubeIcon className="size-3.5 text-[var(--paper-navy,#002b66)]" />
            <span>mathmyid</span>
          </div>

          <span className="text-slate-300 font-normal shrink-0">|</span>

          {/* Instagram */}
          <div className="flex items-center gap-1 shrink-0">
            <InstagramIcon className="size-3.5 text-[var(--paper-navy,#002b66)]" />
            <span>mathmyid</span>
          </div>

          <span className="text-slate-300 font-normal shrink-0">|</span>

          {/* Facebook */}
          <div className="flex items-center gap-1 shrink-0">
            <FacebookIcon className="size-3.5 text-[var(--paper-navy,#002b66)]" />
            <span>mathmyid</span>
          </div>

          <span className="text-slate-300 font-normal shrink-0 hidden xs:inline">|</span>

          {/* Telegram */}
          <div className="flex items-center gap-1 shrink-0">
            <TelegramIcon className="size-3.5 text-[var(--paper-navy,#002b66)]" />
            <span>mathmyid</span>
          </div>

          <span className="text-slate-300 font-normal shrink-0 hidden xs:inline">|</span>

          {/* Twitter / X */}
          <div className="flex items-center gap-1 shrink-0">
            <TwitterIcon className="size-3.5 text-[var(--paper-navy,#002b66)]" />
            <span>mathmyid</span>
          </div>
        </div>

        {/* Sisi Kanan: Badge Nomor Halaman Poligon Miring (Mockup `footer.png`) */}
        <div className="shrink-0 h-8 sm:h-9 relative flex items-center justify-end" aria-label={`Halaman ${pageNumber}`}>
          <svg
            viewBox="0 0 130 36"
            className="h-8 sm:h-9 w-auto block select-none"
            aria-hidden="true"
          >
            {/* Garis Aksen Diagonal Luar */}
            <line
              x1="12"
              y1="36"
              x2="34"
              y2="0"
              stroke="var(--paper-navy, #002b66)"
              strokeWidth="1.5"
              opacity="0.8"
            />

            {/* Poligon Chevron Aksen Kuning Emas */}
            <polygon
              points="26,36 48,0 72,0 50,36"
              fill="var(--paper-gold, #f59e0b)"
              style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}
            />

            {/* Poligon Utama Biru Navy Solid untuk Angka Halaman */}
            <polygon
              points="54,36 76,0 130,0 130,36"
              fill="var(--paper-navy, #002b66)"
              style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}
            />

            {/* Teks Nomor Halaman di Layar */}
            <text
              x="103"
              y="25"
              fill="#ffffff"
              fontSize="20"
              fontWeight="900"
              fontFamily="system-ui, -apple-system, sans-serif"
              textAnchor="middle"
              className="print:hidden"
            >
              {pageNumber}
            </text>
          </svg>

          {/* Nomor Halaman Dinamis saat Cetak Fisik/PDF (CSS Paged Media Counter) */}
          <div
            className="hidden print:flex absolute right-4 sm:right-5 top-0 bottom-0 items-center justify-center font-black text-white text-base font-sans select-none pointer-events-none print-page-counter"
            aria-hidden="true"
          />
        </div>
      </div>
    </footer>
  );
}
