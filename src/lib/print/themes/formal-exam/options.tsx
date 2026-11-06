import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ThemeOptionsRenderProps } from "../types";

export function FormalExamOptions({ options, onChange }: ThemeOptionsRenderProps) {
  const showSupervisorSignature = Boolean(options.showSupervisorSignature);
  const examTypeTitle = typeof options.examTypeTitle === "string" ? options.examTypeTitle : "";

  return (
    <div className="flex flex-col gap-3 p-3 bg-muted/40 rounded-md border border-border">
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-foreground">
          Tanda Tangan Pengawas
        </span>
        <Button
          type="button"
          size="sm"
          variant={showSupervisorSignature ? "default" : "outline"}
          onClick={() => onChange("showSupervisorSignature", !showSupervisorSignature)}
          className="min-h-[44px] text-xs justify-start px-3"
          aria-pressed={showSupervisorSignature}
        >
          {showSupervisorSignature
            ? "✓ Kolom Tanda Tangan Ditampilkan"
            : "✕ Sembunyikan Tanda Tangan"}
        </Button>
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="formal-exam-title-input"
          className="text-xs font-semibold text-foreground"
        >
          Judul / Keterangan Naskah Ujian (Opsional)
        </label>
        <Input
          id="formal-exam-title-input"
          type="text"
          placeholder="Contoh: PENILAIAN AKHIR SEMESTER"
          value={examTypeTitle}
          onChange={(e) => onChange("examTypeTitle", e.target.value)}
          className="min-h-[44px] text-xs"
        />
        <div className="flex gap-1.5 flex-wrap mt-1">
          {["PAS", "ASAJ", "Ujian Sekolah"].map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => onChange("examTypeTitle", preset.toUpperCase())}
              className="text-[10px] bg-background hover:bg-muted border border-border px-2 py-1 rounded-xs min-h-[32px] cursor-pointer"
            >
              +{preset}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
