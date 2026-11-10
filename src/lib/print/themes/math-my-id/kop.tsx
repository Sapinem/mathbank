import { BundlePrintKop } from "@/components/bundles/print/bundle-print-kop";
import type { ThemeKopProps } from "../types";

export function MathMyIdKop({
  title,
  grade,
  year,
  questionCount,
  durationMinutes,
  exerciseLabel,
  institutionName,
  tagline,
  logoUrl,
  onLogoError,
}: ThemeKopProps) {
  return (
    <BundlePrintKop
      title={title}
      grade={grade}
      year={year}
      questionCount={questionCount}
      durationMinutes={durationMinutes}
      exerciseLabel={exerciseLabel}
      institutionName={institutionName}
      tagline={tagline ?? undefined}
      logoUrl={logoUrl}
      onLogoError={onLogoError}
    />
  );
}
