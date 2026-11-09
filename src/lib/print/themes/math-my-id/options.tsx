import type { ThemeOptionsRenderProps } from "../types";
import { HEADER_GROUPS, FOOTER_GROUPS } from "./types";
import { Button } from "@/components/ui/button";

export function MathMyIdOptions({ options, onChange }: ThemeOptionsRenderProps) {
  const headerCode = typeof options.headerCode === "string" ? options.headerCode.toUpperCase() : "A1";
  const footerCode = typeof options.footerCode === "string" ? options.footerCode.toUpperCase() : "F1";
  const logoStyle = options.logoStyle === "circle" ? "circle" : "mi";
  const runningHeader = options.runningHeader !== false;

  return (
    <div className="flex flex-col gap-4 p-3 bg-muted/40 rounded-md border border-border text-xs">
      {/* ── Pemilihan Variasi Header A1–F4 ── */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="mmi-header-select"
          className="font-bold text-foreground flex items-center justify-between"
        >
          <span>Gaya Strip Header</span>
          <span className="font-mono text-blue-600 dark:text-blue-400 font-extrabold">{headerCode}</span>
        </label>
        <select
          id="mmi-header-select"
          value={headerCode}
          onChange={(e) => onChange("headerCode", e.target.value)}
          className="w-full min-h-[44px] px-3 py-2 rounded-md bg-background border border-input text-xs font-medium focus:ring-2 focus:ring-ring focus:outline-hidden"
        >
          {HEADER_GROUPS.map((group) => (
            <optgroup key={group.id} label={group.title}>
              {group.codes.map((code) => (
                <option key={code} value={code}>
                  Header {code} ({group.title.split("(")[0].replace(/^[A-Z]\.\s*Variasi\s*/i, "").trim()})
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {/* ── Pemilihan Variasi Footer F1–G16 ── */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="mmi-footer-select"
          className="font-bold text-foreground flex items-center justify-between"
        >
          <span>Gaya Strip Footer</span>
          <span className="font-mono text-emerald-600 dark:text-emerald-400 font-extrabold">{footerCode}</span>
        </label>
        <select
          id="mmi-footer-select"
          value={footerCode}
          onChange={(e) => onChange("footerCode", e.target.value)}
          className="w-full min-h-[44px] px-3 py-2 rounded-md bg-background border border-input text-xs font-medium focus:ring-2 focus:ring-ring focus:outline-hidden"
        >
          {FOOTER_GROUPS.map((group) => (
            <optgroup key={group.id} label={group.title}>
              {group.codes.map((code) => (
                <option key={code} value={code}>
                  Footer {code} ({group.id === "F" ? "Minimalis" : "Dekoratif"})
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {/* ── Pilihan Gaya Logo Resmi Kita ── */}
      <div className="flex flex-col gap-1.5">
        <span className="font-bold text-foreground">Gaya Logo Resmi</span>
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            size="sm"
            variant={logoStyle === "mi" ? "default" : "outline"}
            onClick={() => onChange("logoStyle", "mi")}
            className="min-h-[44px] text-xs font-semibold"
          >
            Huruf &quot;mi&quot; (Standar)
          </Button>
          <Button
            type="button"
            size="sm"
            variant={logoStyle === "circle" ? "default" : "outline"}
            onClick={() => onChange("logoStyle", "circle")}
            className="min-h-[44px] text-xs font-semibold"
          >
            Lambang Lingkaran
          </Button>
        </div>
      </div>

      {/* ── Sakelar Running Header Otomatis ── */}
      <div className="flex flex-col gap-1.5">
        <span className="font-bold text-foreground">Running Header Lanjutan (Hal. 2+)</span>
        <Button
          type="button"
          size="sm"
          variant={runningHeader ? "default" : "outline"}
          onClick={() => onChange("runningHeader", !runningHeader)}
          className="min-h-[44px] text-xs justify-start px-3"
          aria-pressed={runningHeader}
        >
          {runningHeader
            ? "✓ Running Header Otomatis (1 Baris Hal. 2+)"
            : "✕ Seragam Semua Halaman (2 Baris)"}
        </Button>
      </div>
    </div>
  );
}
