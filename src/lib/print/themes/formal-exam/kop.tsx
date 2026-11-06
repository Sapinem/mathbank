import type { ThemeKopProps } from "../types";
import { cn } from "@/lib/utils";

export function FormalExamKop({
  title,
  grade,
  year,
  questionCount,
  durationMinutes,
  institutionName,
  tagline,
  logoUrl,
  options,
  instructions,
}: ThemeKopProps) {
  const showSupervisorSignature = Boolean(options.showSupervisorSignature);
  const examTypeTitle = typeof options.examTypeTitle === "string" && options.examTypeTitle.trim()
    ? options.examTypeTitle.trim()
    : title;

  return (
    <header
      data-slot="formal-exam-kop"
      className="formal-exam-kop print-kop print-header relative w-full bg-white text-black pb-2 mb-4 select-none"
      style={{
        printColorAdjust: "exact",
        WebkitPrintColorAdjust: "exact",
      }}
    >
      {/* ── Area Kop Resmi: Logo + Teks Institusi + Garis Ganda ── */}
      <div className="flex items-center gap-4 pb-2 border-b-4 border-double border-black">
        {logoUrl && (
          <div className="shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoUrl}
              alt={institutionName || "Logo"}
              className="w-16 h-16 object-contain"
            />
          </div>
        )}
        <div className="flex-1 text-center">
          <div className="text-xs uppercase tracking-wider font-semibold text-slate-700">
            Pemerintah Daerah / Yayasan Pendidikan
          </div>
          <h1 className="text-base sm:text-lg font-bold uppercase tracking-tight leading-tight">
            {institutionName}
          </h1>
          {tagline && (
            <p className="text-xs text-slate-600 italic leading-snug">{tagline}</p>
          )}
        </div>
      </div>

      {/* ── Judul Naskah Ujian ── */}
      <div className="text-center my-2.5">
        <h2 className="text-sm sm:text-base font-extrabold uppercase tracking-wide">
          {examTypeTitle}
        </h2>
        <div className="text-xs text-slate-700 font-medium">
          {grade ? `Kelas: ${grade}` : ""} {year ? `· Tahun Ajaran: ${year}` : ""} · {questionCount} Soal · Alokasi Waktu: {durationMinutes ?? 90} Menit
        </div>
      </div>

      {/* ── Kotak Identitas Siswa & Pengawas ── */}
      <div className="border border-black rounded-xs text-xs p-2 grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
        <div className="flex flex-col gap-1">
          <div className="flex">
            <span className="w-24 shrink-0 font-medium">Nama Peserta</span>
            <span className="w-3">:</span>
            <span className="flex-1 border-b border-dotted border-black min-h-[16px]"></span>
          </div>
          <div className="flex">
            <span className="w-24 shrink-0 font-medium">Nomor Peserta</span>
            <span className="w-3">:</span>
            <span className="flex-1 border-b border-dotted border-black min-h-[16px]"></span>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex">
            <span className="w-24 shrink-0 font-medium">Kelas / Ruang</span>
            <span className="w-3">:</span>
            <span className="flex-1 border-b border-dotted border-black min-h-[16px]"></span>
          </div>
          <div className="flex">
            <span className="w-24 shrink-0 font-medium">Hari / Tanggal</span>
            <span className="w-3">:</span>
            <span className="flex-1 border-b border-dotted border-black min-h-[16px]"></span>
          </div>
        </div>
      </div>

      {/* ── Petunjuk & Kolom Tanda Tangan Pengawas (Bila Aktif) ── */}
      {(instructions || showSupervisorSignature) && (
        <div className={cn("flex gap-3 text-xs", showSupervisorSignature ? "items-start" : "")}>
          {instructions ? (
            <div className="flex-1 p-2 bg-slate-50 border border-slate-300 rounded-xs italic">
              <span className="font-bold not-italic">Petunjuk: </span>
              {instructions}
            </div>
          ) : (
            <div className="flex-1" />
          )}
          {showSupervisorSignature && (
            <div
              data-slot="supervisor-signature"
              className="w-36 shrink-0 border border-black rounded-xs p-1 text-center text-[10px]"
            >
              <div className="font-semibold border-b border-black pb-0.5 mb-8">
                Tanda Tangan Pengawas
              </div>
              <div className="text-[9px] text-slate-500">(................................)</div>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
