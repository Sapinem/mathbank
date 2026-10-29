/**
 * Tanda air (watermark) logo resmi MathBank untuk lembar cetak naskah soal.
 *
 * Menggunakan inline SVG berorientasi overflow: visible agar:
 *  1. Tetap tercetak pada perangkat mobile (HP Android & iOS) yang mematikan CSS background-image.
 *  2. Menembus batas margin kanan (1 cm) dan margin bawah (1,2 cm) hingga mentok ke tepi fisik kertas (full-bleed).
 *  3. Menjaga kotak pembungkus CSS tetap di (bottom: 0, right: 0) sehingga mesin fragmentasi
 *     Chromium tidak memotong luapan dan membocorkannya ke bagian atas halaman berikutnya.
 */
export function PrintWatermark() {
  return (
    <div className="worksheet-watermark-container" aria-hidden="true">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 1574 1627"
        width="100%"
        height="100%"
        className="worksheet-watermark-svg"
      >
        <defs>
          <linearGradient id="wmArcGrad" x1="7.58" y1="0" x2="1996.62" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="var(--paper-brand, #003399)" />
            <stop offset="50%" stopColor="var(--paper-brand, #3399ff)" stopOpacity="0.8" />
            <stop offset="100%" stopColor="var(--paper-brand, #003399)" />
          </linearGradient>
          <linearGradient id="wmBlueGrad" x1="0" y1="515.91" x2="0" y2="1618.98" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="var(--paper-brand, #0080ff)" stopOpacity="0.85" />
            <stop offset="100%" stopColor="var(--paper-brand, #003399)" />
          </linearGradient>
          <linearGradient id="wmGoldVertGrad" x1="0" y1="515.73" x2="0" y2="1619.02" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="var(--paper-accent, #ffdd33)" />
            <stop offset="100%" stopColor="var(--paper-accent, #996600)" />
          </linearGradient>
          <linearGradient id="wmGoldHorzGrad" x1="755.46" y1="0" x2="1229.60" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="var(--paper-accent, #996600)" />
            <stop offset="100%" stopColor="var(--paper-accent, #ffdd33)" />
          </linearGradient>
        </defs>

        <g className="worksheet-watermark-paths">
          {/* Outer Blue Crescent Arc */}
          <path
            d="M 143.01 1627 A 994.52 994.52 0 0 1 1574 312.34 L 1574 393.05 A 965.34 965.34 0 0 0 151.39 1627 Z"
            fill="url(#wmArcGrad)"
          />

          {/* Left Blue 'M' Wing */}
          <path
            d="M 432.91 515.91 L 1001.86 1084.86 L 1229.60 857.12 L 1229.60 1180.85 L 1001.79 1408.67 L 661.83 1068.71 L 661.83 1627 L 440.93 1627 L 432.91 1618.98 Z"
            fill="url(#wmBlueGrad)"
          />

          {/* Right Gold Segmented Pillar (Upper & Lower) */}
          <path
            d="M 1341.72 744.64 L 1570.63 515.73 L 1570.63 904.04 L 1341.72 1132.95 Z M 1341.72 1201.13 L 1570.63 972.22 L 1570.63 1619.02 L 1562.65 1627 L 1341.72 1627 Z"
            fill="url(#wmGoldVertGrad)"
          />

          {/* Center-Bottom Gold Chevron */}
          <path
            d="M 755.46 1294.74 L 1001.79 1541.07 L 1229.60 1313.25 L 1229.60 1627 L 764.00 1627 L 755.46 1618.46 Z"
            fill="url(#wmGoldHorzGrad)"
          />
        </g>
      </svg>
    </div>
  );
}
