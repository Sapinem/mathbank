import type { ThemeFooterProps } from "../types";
import { FOOTER_VARIANTS } from "./footer-variants";
import type { FooterCode } from "./types";
import { cn } from "@/lib/utils";

export function MathMyIdFooter({
  institutionName = "Math My ID",
  options,
}: ThemeFooterProps) {
  const rawCode =
    typeof options.footerCode === "string"
      ? options.footerCode.trim().toUpperCase()
      : "F1";
  const footerCode = (rawCode in FOOTER_VARIANTS ? rawCode : "F1") as FooterCode;
  const pageNumber =
    typeof options.pageNumber === "number" || typeof options.pageNumber === "string"
      ? options.pageNumber
      : 1;
  const totalPages =
    typeof options.totalPages === "number" || typeof options.totalPages === "string"
      ? options.totalPages
      : undefined;

  const renderVariant = FOOTER_VARIANTS[footerCode] ?? FOOTER_VARIANTS.F1;

  return (
    <footer
      data-slot="bundle-print-footer"
      data-theme-footer="math-my-id"
      data-footer-code={footerCode}
      className={cn(
        "bundle-print-footer math-my-id-footer print-running-footer w-full bg-white text-[#111111] select-none mt-auto",
      )}
      style={{
        printColorAdjust: "exact",
        WebkitPrintColorAdjust: "exact",
      }}
    >
      {renderVariant({
        pageNumber,
        totalPages,
        handle: "mathmyid",
        brand: institutionName || "Math My ID",
      })}
    </footer>
  );
}
