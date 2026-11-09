import type { SVGProps } from "react";
import { cn } from "@/lib/utils";

/**
 * Pustaka ikon vektor & ornamen grafis teknikal untuk cetak lembar soal Math My ID.
 * Menggunakan inline SVG terstandar anti-blur 300+ DPI.
 */

export const MATH_MY_ID_COLORS = {
  navy: "#072652",
  blue: "#0047b3",
  blueLight: "#2b7fff",
  gold: "#f5b800",
  goldDark: "#d99b00",
} as const;

/**
 * Logo Huruf Kecil "mi" Khas Math My ID (Gradien Standar).
 */
export function MathMyIdMiLogo({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 120 76"
      aria-hidden="true"
      className={cn("h-5 w-auto inline-block shrink-0", className)}
      {...props}
    >
      <defs>
        <linearGradient id="mmi-blue-grad" x1="0" y1="0" x2="0" y2="76" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0080ff" />
          <stop offset="100%" stopColor="#003399" />
        </linearGradient>
        <linearGradient id="mmi-gold-grad" x1="0" y1="0" x2="0" y2="76" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffdd33" />
          <stop offset="100%" stopColor="#996600" />
        </linearGradient>
      </defs>
      <path
        d="M 0 74 L 18 74 L 18 36 L 36 74 L 54 74 L 72 36 L 72 74 L 90 74 L 90 2 L 68 2 L 45 48 L 22 2 L 0 2 Z"
        fill="url(#mmi-blue-grad)"
      />
      <path d="M 98 74 L 116 74 L 116 28 L 98 28 Z" fill="url(#mmi-gold-grad)" />
      <circle cx="107" cy="10" r="10" fill="url(#mmi-gold-grad)" />
    </svg>
  );
}

/**
 * Logo Huruf Kecil "mi" Khas Math My ID (Solid White / Terang untuk latar gelap).
 */
export function MathMyIdMiLogoLight({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 120 76"
      aria-hidden="true"
      className={cn("h-5 w-auto inline-block shrink-0", className)}
      {...props}
    >
      <path
        d="M 0 74 L 18 74 L 18 36 L 36 74 L 54 74 L 72 36 L 72 74 L 90 74 L 90 2 L 68 2 L 45 48 L 22 2 L 0 2 Z"
        fill="#ffffff"
      />
      <path d="M 98 74 L 116 74 L 116 28 L 98 28 Z" fill="#f5b800" />
      <circle cx="107" cy="10" r="10" fill="#f5b800" />
    </svg>
  );
}

/**
 * Lambang Lingkaran Penuh Math My ID (LogoSquare).
 */
export function MathMyIdFullLogo({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="50 120 1900 1850"
      aria-hidden="true"
      className={cn("size-5 inline-block shrink-0", className)}
      {...props}
    >
      <defs>
        <linearGradient id="mmi-full-arc" x1="7.58" y1="0" x2="1996.62" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#003399" />
          <stop offset="50%" stopColor="#3399ff" />
          <stop offset="100%" stopColor="#003399" />
        </linearGradient>
        <linearGradient id="mmi-full-blue" x1="0" y1="515.91" x2="0" y2="1618.98" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0080ff" />
          <stop offset="100%" stopColor="#003399" />
        </linearGradient>
        <linearGradient id="mmi-full-gold-vert" x1="0" y1="515.73" x2="0" y2="1619.02" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffdd33" />
          <stop offset="100%" stopColor="#996600" />
        </linearGradient>
        <linearGradient id="mmi-full-gold-horz" x1="755.46" y1="0" x2="1229.60" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#996600" />
          <stop offset="100%" stopColor="#ffdd33" />
        </linearGradient>
      </defs>
      <path
        d="M 210 1760 A 910 910 0 1 1 1790 1760 A 885 885 0 1 0 210 1760 Z"
        fill="url(#mmi-full-arc)"
      />
      <path
        d="M 432.91 515.91 L 1001.86 1084.86 L 1229.60 857.12 L 1229.60 1180.85 L 1001.79 1408.67 L 661.83 1068.71 L 661.83 1820 L 432.91 1595 Z"
        fill="url(#mmi-full-blue)"
      />
      <path
        d="M 1341.72 744.64 L 1570.63 515.73 L 1570.63 904.04 L 1341.72 1132.95 Z M 1341.72 1201.13 L 1570.63 972.22 L 1570.63 1595 L 1341.72 1820 Z"
        fill="url(#mmi-full-gold-vert)"
      />
      <path
        d="M 755.46 1294.74 L 1001.79 1541.07 L 1229.60 1313.25 L 1229.60 1610 L 1001.79 1838 L 755.46 1592 Z"
        fill="url(#mmi-full-gold-horz)"
      />
    </svg>
  );
}

export function YouTubeIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={cn("size-3.5 inline-block shrink-0", className)}
      {...props}
    >
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

export function InstagramIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn("size-3.5 inline-block shrink-0", className)}
      {...props}
    >
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

export function FacebookIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={cn("size-3.5 inline-block shrink-0", className)}
      {...props}
    >
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

export function TelegramIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={cn("size-3.5 inline-block shrink-0", className)}
      {...props}
    >
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 0 0-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
    </svg>
  );
}

export function TwitterIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={cn("size-3.5 inline-block shrink-0", className)}
      {...props}
    >
      <path d="M23.953 4.57a10 10 0 0 1-2.825.775 4.958 4.958 0 0 0 2.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 0 0-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 0 0-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 0 1-2.228-.616v.06a4.923 4.923 0 0 0 3.946 4.827 4.996 4.996 0 0 1-2.212.085 4.936 4.936 0 0 0 4.604 3.417 9.867 9.867 0 0 1-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 0 0 7.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.936 9.936 0 0 0 24 4.59z" />
    </svg>
  );
}

/**
 * Ornamen titik-titik (dot-matrix) dekoratif teknikal di pojok kanan kop.
 */
export function DotMatrixOrnament({
  rows = 5,
  cols = 8,
  dotRadius = 1.25,
  spacing = 5.5,
  className,
}: {
  rows?: number;
  cols?: number;
  dotRadius?: number;
  spacing?: number;
  className?: string;
}) {
  const circles: { cx: number; cy: number; opacity: number }[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // Bentuk segitiga/parallelogram seperti pada mockup
      if (c >= r - 1) {
        const cx = 8 + c * spacing;
        const cy = 6 + r * spacing;
        // Variasi opasitas halus
        const opacity = 0.45 + (c / cols) * 0.45;
        circles.push({ cx, cy, opacity });
      }
    }
  }

  const width = 16 + cols * spacing;
  const height = 12 + rows * spacing;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={cn("pointer-events-none select-none", className)}
      aria-hidden="true"
    >
      {circles.map((dot, idx) => (
        <circle
          key={idx}
          cx={dot.cx}
          cy={dot.cy}
          r={dotRadius}
          fill="currentColor"
          opacity={dot.opacity}
        />
      ))}
    </svg>
  );
}

/**
 * Garis pembatas bawah teknikal (Technical Border) untuk kop halaman pertama.
 * Memiliki garis horizontal, aksen takik miring 45 derajat, dan lingkaran simpul (*node*).
 */
export function TechnicalKopBorder({ className }: { className?: string }) {
  return (
    <div className={cn("w-full overflow-hidden leading-none", className)}>
      <svg
        viewBox="0 0 1000 16"
        preserveAspectRatio="none"
        className="w-full h-4 block"
        aria-hidden="true"
      >
        {/* Garis atas aksen tipis */}
        <path
          d="M 0 4 L 920 4 L 935 12 L 1000 12"
          fill="none"
          stroke="var(--paper-navy, #002b66)"
          strokeWidth="1.5"
          opacity="0.25"
        />
        {/* Garis teknikal utama */}
        <path
          d="M 0 10 L 220 10 L 235 4 L 750 4 L 760 10 L 980 10 L 990 4 L 1000 4"
          fill="none"
          stroke="var(--paper-navy, #002b66)"
          strokeWidth="2.5"
        />
        {/* Lingkaran simpul aksen */}
        <circle cx="235" cy="4" r="2.5" fill="var(--paper-gold, #f59e0b)" />
        <circle cx="760" cy="10" r="2" fill="var(--paper-navy, #002b66)" />
        <circle cx="980" cy="10" r="2" fill="var(--paper-gold, #f59e0b)" />
      </svg>
    </div>
  );
}

/**
 * Aksen 3 garis miring paralel pada running header:
 * Garis 1: Kuning emas (#f59e0b)
 * Garis 2 & 3: Biru navy (#002b66)
 */
export function SlantedHeaderStripes({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-1 shrink-0", className)} aria-hidden="true">
      <span
        data-slot="stripe"
        className="w-1.5 h-4.5 -skew-x-[28deg] bg-[var(--paper-gold,#f59e0b)] rounded-xs"
        style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}
      />
      <span
        data-slot="stripe"
        className="w-1.5 h-4.5 -skew-x-[28deg] bg-[var(--paper-navy,#002b66)] rounded-xs"
        style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}
      />
      <span
        data-slot="stripe"
        className="w-1.5 h-4.5 -skew-x-[28deg] bg-[var(--paper-navy,#002b66)] rounded-xs"
        style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}
      />
    </div>
  );
}
