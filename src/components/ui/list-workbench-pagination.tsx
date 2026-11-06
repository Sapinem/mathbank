"use client";

import { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ListWorkbenchPaginationProps {
  /** Halaman aktif saat ini (0-based). */
  page: number;
  /** Jumlah baris per halaman (limit). */
  pageSize: number;
  /** Total keseluruhan item yang cocok dengan filter. */
  total: number;
  /** Pilihan jumlah baris per halaman (default: [20, 50, 100]). */
  pageSizeOptions?: readonly number[];
  /** Label jenis item (mis. "soal", "paket", "topik", default: "item"). */
  itemLabel?: string;
  /** Callback saat pengguna berpindah halaman. */
  onPageChange: (newPage: number) => void;
  /** Callback saat pengguna mengubah ukuran halaman (limit). */
  onPageSizeChange: (newPageSize: number) => void;
  className?: string;
  ariaLabel?: string;
}

const DEFAULT_PAGE_SIZE_OPTIONS = [20, 50, 100] as const;

/**
 * Komponen paginasi terpadu MathBank (Linear / IBM Carbon Workbench Model).
 *
 * Mendukung:
 *  - Pilihan jumlah baris per halaman (20, 50, 100).
 *  - Jangkauan data monospaced ("Menampilkan 1–20 dari 579 paket").
 *  - Input lompat cepat ke nomor halaman tertentu.
 *  - Tombol Pertama, Sebelumnya, Nomor Halaman aktif, Berikutnya, Terakhir.
 *  - Target sentuh aksesibel (pointer-coarse:min-h-[44px]).
 */
export function ListWorkbenchPagination({
  page,
  pageSize,
  total,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  itemLabel = "item",
  onPageChange,
  onPageSizeChange,
  className,
  ariaLabel = `Navigasi halaman ${itemLabel}`,
}: ListWorkbenchPaginationProps) {
  const [jumpInput, setJumpInput] = useState("");

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const from = total === 0 ? 0 : safePage * pageSize + 1;
  const to = Math.min(total, (safePage + 1) * pageSize);

  function handleJump(e: React.FormEvent) {
    e.preventDefault();
    const target = Number(jumpInput.trim());
    if (!Number.isNaN(target) && target >= 1 && target <= totalPages) {
      onPageChange(target - 1);
      setJumpInput("");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function handlePageClick(targetPage: number) {
    onPageChange(targetPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (total === 0) {
    return null;
  }

  return (
    <nav
      aria-label={ariaLabel}
      className={cn(
        "flex flex-wrap items-center justify-between gap-2.5 border-t border-border bg-background/80 px-3 py-2 text-xs sm:px-4 backdrop-blur-xs",
        className,
      )}
    >
      {/* Sisi Kiri: Pilihan Jumlah Baris & Jangkauan Data */}
      <div className="flex items-center gap-3">
        {/* Pilihan jumlah baris */}
        <div className="hidden sm:flex items-center gap-1.5 text-muted-foreground">
          <span>Baris:</span>
          <div className="flex items-center rounded-md border border-border bg-muted/20 p-0.5">
            {pageSizeOptions.map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => onPageSizeChange(size)}
                aria-label={`Tampilkan ${size} ${itemLabel} per halaman`}
                className={cn(
                  "rounded px-2 py-0.5 text-xs font-mono font-medium transition-colors pointer-coarse:min-h-[44px]",
                  pageSize === size
                    ? "bg-background font-bold text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {size}
              </button>
            ))}
          </div>
        </div>

        {/* Jangkauan Data */}
        <span className="text-muted-foreground font-mono">
          <span className="hidden sm:inline">Menampilkan </span>
          <strong className="font-semibold text-foreground">
            {from}–{to}
          </strong>{" "}
          dari{" "}
          <strong className="font-semibold text-foreground">
            {total.toLocaleString("id-ID")}
          </strong>
          <span className="hidden sm:inline"> {itemLabel}</span>
        </span>
      </div>

      {/* Sisi Kanan: Lompat Cepat & Kontrol Navigasi Halaman */}
      <div className="flex items-center gap-1 sm:gap-1.5">
        {/* Input Lompat Cepat */}
        <form onSubmit={handleJump} className="hidden lg:flex items-center gap-1.5 mr-1">
          <span className="text-muted-foreground">Lompat:</span>
          <input
            type="number"
            min={1}
            max={totalPages}
            value={jumpInput}
            onChange={(e) => setJumpInput(e.target.value)}
            placeholder={String(safePage + 1)}
            aria-label="Lompat ke nomor halaman"
            className="h-7 w-12 rounded-md border border-border bg-background px-1.5 text-center font-mono text-xs text-foreground focus-visible:border-brand focus-visible:outline-none"
          />
        </form>

        {/* Tombol Halaman Pertama (|<) */}
        <Button
          variant="outline"
          size="icon"
          disabled={safePage === 0}
          onClick={() => handlePageClick(0)}
          aria-label="Halaman pertama"
          className="relative hidden sm:inline-flex h-8 w-8 after:absolute after:-inset-1.5 after:content-['']"
        >
          <ChevronsLeft className="size-3.5" />
        </Button>

        {/* Tombol Sebelumnya */}
        <Button
          variant="outline"
          size="sm"
          disabled={safePage === 0}
          onClick={() => handlePageClick(Math.max(0, safePage - 1))}
          className="relative h-8 gap-1 px-2.5 after:absolute after:-inset-1.5 after:content-['']"
        >
          <ChevronLeft className="size-3.5" />
          Sebelumnya
        </Button>

        {/* Nomor Halaman */}
        <span className="px-1 text-muted-foreground font-mono whitespace-nowrap">
          Hal. {safePage + 1}/{totalPages}
        </span>

        {/* Tombol Berikutnya */}
        <Button
          variant="outline"
          size="sm"
          disabled={safePage + 1 >= totalPages}
          onClick={() => handlePageClick(Math.min(totalPages - 1, safePage + 1))}
          className="relative h-8 gap-1 px-2.5 after:absolute after:-inset-1.5 after:content-['']"
        >
          Berikutnya
          <ChevronRight className="size-3.5" />
        </Button>

        {/* Tombol Halaman Terakhir (>|) */}
        <Button
          variant="outline"
          size="icon"
          disabled={safePage + 1 >= totalPages}
          onClick={() => handlePageClick(totalPages - 1)}
          aria-label="Halaman terakhir"
          className="relative hidden sm:inline-flex h-8 w-8 after:absolute after:-inset-1.5 after:content-['']"
        >
          <ChevronsRight className="size-3.5" />
        </Button>
      </div>
    </nav>
  );
}
