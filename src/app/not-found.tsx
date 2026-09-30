import Link from "next/link";
import { Compass } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { PageState } from "@/components/layout/page-state";
import { cn } from "@/lib/utils";

/** Halaman 404 — tampilan bertema, bukan layar bawaan Next.js. */
export default function NotFound() {
  return (
    <PageState
      code="404"
      icon={<Compass className="size-6" />}
      title="Halaman tidak ditemukan"
      description="Tautan mungkin salah atau halaman sudah dipindahkan. Periksa kembali alamatnya."
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
