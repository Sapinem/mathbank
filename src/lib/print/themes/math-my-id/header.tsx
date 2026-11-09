import type { ThemeHeaderProps } from "../types";
import { HEADER_VARIANTS } from "./header-variants";
import type { HeaderCode } from "./types";
import { cn } from "@/lib/utils";

export function MathMyIdHeader({
  title,
  exerciseLabel = "Latihan 1",
  options,
}: ThemeHeaderProps) {
  const rawCode =
    typeof options.headerCode === "string"
      ? options.headerCode.trim().toUpperCase()
      : "A1";
  const headerCode = (rawCode in HEADER_VARIANTS ? rawCode : "A1") as HeaderCode;
  const is1Line = Boolean(options.is1Line ?? options.runningHeader ?? false);
  const course =
    typeof options.course === "string"
      ? options.course
      : typeof options.grade === "string"
        ? options.grade
        : null;
  const durationMinutes =
    typeof options.durationMinutes === "number" ? options.durationMinutes : null;
  const logoStyle = options.logoStyle === "circle" ? "circle" : "mi";

  const renderVariant = HEADER_VARIANTS[headerCode] ?? HEADER_VARIANTS.A1;

  return (
    <div
      data-slot="math-my-id-header"
      data-header-code={headerCode}
      className={cn(
        "math-my-id-header print-running-header w-full bg-white text-[#111111] select-none",
      )}
      style={{
        printColorAdjust: "exact",
        WebkitPrintColorAdjust: "exact",
      }}
    >
      {renderVariant({
        title,
        course,
        exerciseLabel,
        durationMinutes,
        brand: "Math My ID",
        logoStyle,
        is1Line,
      })}
    </div>
  );
}
