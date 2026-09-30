import Link from "next/link";
import { ShieldX } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { PageState } from "@/components/layout/page-state";
import { cn } from "@/lib/utils";

/**
 * Halaman 403 — akses ditolak (M15).
 *
 * Ditampilkan saat pengguna terautentikasi tetapi tak berwenang atas sumber
 * daya (mis. buka halaman admin sebagai guru). Alasan tak diungkap detail
 * (cegah enumerasi) — hanya arahan.
 */
export default function ForbiddenPage() {
  return (
    <PageState
      code="403"
      icon={<ShieldX className="size-6" />}
      title="Akses ditolak"
      description="Akun Anda tidak memiliki izin untuk membuka halaman ini. Bila ini keliru, hubungi administrator."
    >
      <Link href="/" className={cn(buttonVariants({ variant: "default" }))}>
        Ke Dasbor
      </Link>
      <Link href="/questions" className={cn(buttonVariants({ variant: "outline" }))}>
        Bank Soal
      </Link>
    </PageState>
  );
}
