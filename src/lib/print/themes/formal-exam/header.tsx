import type { ThemeHeaderProps } from "../types";
import { cn } from "@/lib/utils";

/**
 * Running Header Halaman Lanjutan (Halaman 2+) khusus Tema Ujian Formal.
 * Format bersih, formal tanpa branding eksternal Math My ID.
 */
export function FormalExamHeader({
  title,
  exerciseLabel,
  options,
}: ThemeHeaderProps) {
  const examTitle = (typeof options.examTypeTitle === "string" && options.examTypeTitle.trim())
    ? options.examTypeTitle.trim()
    : title;

  return (
    <div
      data-slot="formal-exam-header"
      className={cn(
        "formal-exam-header print-running-header w-full bg-white text-[#111111] select-none pb-1 border-b border-black",
      )}
      style={{
        printColorAdjust: "exact",
        WebkitPrintColorAdjust: "exact",
      }}
    >
      <div className="flex items-center justify-between gap-3 px-1 py-1 text-xs">
        <span className="font-bold uppercase tracking-wide">
          {examTitle}
        </span>
        {exerciseLabel && (
          <span className="text-slate-600 font-medium">
            {exerciseLabel}
          </span>
        )}
      </div>
    </div>
  );
}
