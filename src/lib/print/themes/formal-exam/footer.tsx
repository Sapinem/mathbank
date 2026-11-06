import type { ThemeFooterProps } from "../types";
import { cn } from "@/lib/utils";

/**
 * Running Footer Semua Halaman khusus Tema Ujian Formal.
 * Format resmi sekolah/madrasah tanpa promosi media sosial Math My ID.
 */
export function FormalExamFooter({
  institutionName = "Ujian Sekolah",
  options,
}: ThemeFooterProps) {
  const customSubtitle = typeof options.footerSubtitle === "string" && options.footerSubtitle.trim()
    ? options.footerSubtitle.trim()
    : "Dokumen Ujian Resmi";

  return (
    <footer
      data-slot="formal-exam-footer"
      className={cn(
        "formal-exam-footer print-running-footer w-full bg-white text-[#111111] select-none border-t border-black mt-auto",
      )}
      style={{
        printColorAdjust: "exact",
        WebkitPrintColorAdjust: "exact",
      }}
    >
      <div className="flex items-center justify-between text-xs py-1 px-1 w-full">
        <div className="flex items-center gap-2 text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-800">
          <span>{institutionName}</span>
          <span className="text-slate-400">·</span>
          <span className="text-slate-600 font-normal italic">{customSubtitle}</span>
        </div>

        <div className="shrink-0 flex items-center gap-1 text-[11px] font-bold">
          <span className="print:hidden">Halaman 1</span>
          <span className="hidden print:inline">Halaman </span>
          <span
            className="hidden print:inline-block print-page-counter text-black font-bold"
            aria-hidden="true"
          />
        </div>
      </div>
    </footer>
  );
}
