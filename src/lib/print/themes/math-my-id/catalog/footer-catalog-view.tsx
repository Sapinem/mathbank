import { ArrowLeft, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FOOTER_GROUPS, type FooterCode } from "../types";
import { MathMyIdFooter } from "../footer";

export interface FooterCatalogViewProps {
  pageNumber?: number | string;
  totalPages?: number | string;
  currentFooterCode: string;
  onSelectFooter: (code: FooterCode) => void;
  onBackToA4?: () => void;
}

export function FooterCatalogView({
  pageNumber = 1,
  totalPages = 6,
  currentFooterCode,
  onSelectFooter,
  onBackToA4,
}: FooterCatalogViewProps) {
  const activeCode = currentFooterCode.trim().toUpperCase();

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-6 flex flex-col gap-8 select-none">
      {/* ── Bilah Judul Katalog & Navigasi Cepat ── */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-md bg-emerald-600 text-white font-black text-xs uppercase tracking-wider">
              Katalog Footer
            </span>
            <h2 className="text-base sm:text-lg font-bold text-white">
              32 Variasi Footer Math My ID (F1–G16)
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-300">
            Seri F (Clean Minimalist) &amp; Seri G (Decorative) dengan nomor halaman dinamis.
          </p>
        </div>

        {onBackToA4 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onBackToA4}
            className="self-start sm:self-auto bg-slate-800 hover:bg-slate-700 text-white border-slate-700 gap-1.5 shrink-0"
          >
            <ArrowLeft className="size-4" />
            <span>Kembali ke Lembar A4</span>
          </Button>
        )}
      </div>

      {/* ── Navigasi Lompat Seri F / G ── */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        <span className="text-slate-400 font-bold shrink-0">Lompat ke:</span>
        {FOOTER_GROUPS.map((grp) => (
          <a
            key={grp.id}
            href={`#footer-group-${grp.id}`}
            className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700/60 font-semibold shrink-0 transition"
          >
            {grp.title.split("(")[0].trim()}
          </a>
        ))}
      </div>

      {/* ── Daftar 2 Kelompok Footer (F & G) ── */}
      {FOOTER_GROUPS.map((group) => (
        <section
          key={group.id}
          id={`footer-group-${group.id}`}
          className="flex flex-col gap-4 scroll-mt-20"
        >
          {/* Header Kelompok */}
          <div className="border-b border-slate-700 pb-2">
            <h3 className="text-sm sm:text-base font-extrabold text-white flex items-center gap-2">
              <span className="size-6 rounded-md bg-emerald-500 text-slate-950 font-black flex items-center justify-center text-xs">
                {group.id}
              </span>
              <span>{group.title}</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">{group.description}</p>
          </div>

          {/* Grid Kartu Variasi */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {group.codes.map((code) => {
              const isActive = activeCode === code;

              return (
                <div
                  key={code}
                  data-testid={`footer-card-${code}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectFooter(code)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelectFooter(code);
                    }
                  }}
                  className={`group relative rounded-xl border p-3 flex flex-col gap-3 transition cursor-pointer shadow-lg outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                    isActive
                      ? "bg-slate-900 border-emerald-400 ring-2 ring-emerald-400/40"
                      : "bg-slate-900/60 border-slate-800 hover:border-slate-600 hover:bg-slate-800/50"
                  }`}
                >
                  {/* Bilah Atas Kartu */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2.5 py-0.5 rounded-md font-black text-xs tracking-wider ${
                          isActive
                            ? "bg-emerald-400 text-slate-950"
                            : "bg-slate-800 text-slate-200 group-hover:bg-slate-700"
                        }`}
                      >
                        {code}
                      </span>
                      {isActive && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                          <Check className="size-3.5" />
                          <span>Aktif Saat Ini</span>
                        </span>
                      )}
                    </div>

                    <span
                      className={`h-7 px-3 text-xs font-semibold rounded-md inline-flex items-center justify-center border transition ${
                        isActive
                          ? "bg-emerald-500 text-white border-emerald-400"
                          : "bg-slate-800 text-slate-200 border-slate-700 group-hover:border-slate-500"
                      }`}
                    >
                      {isActive ? "Gaya Terpilih" : "Gunakan Gaya Ini"}
                    </span>
                  </div>

                  {/* Kanvas Pratinjau Strip Footer */}
                  <div className="rounded-lg bg-white overflow-hidden shadow-inner border border-slate-300">
                    <MathMyIdFooter
                      options={{
                        footerCode: code,
                        pageNumber,
                        totalPages,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
