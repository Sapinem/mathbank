import Link from "next/link";
import { ClipboardList, Construction, ListChecks, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Kurasi Soal — MathBank" };

/**
 * /curate — kerangka halaman kurasi manual (Sprint 1 · MAT-127).
 *
 * KENAPA kosong tapi tetap ada: Sprint 2 membutuhkan RUTE dan TATA LETAK yang
 * sudah stabil (navigasi, judul, area kerja) agar pekerjaan inti bisa langsung
 * diisi antrean soal + panel review. Halaman ini sengaja TIDAK menampilkan data
 * palsu — hanya menjelaskan apa yang akan hadir, supaya guru tidak salah kira
 * bahwa antrean sudah berjalan.
 *
 * Rencana isi Sprint 2:
 *  - Antrean soal `review`/terflag (prioritas: tanpa kunci, media rusak).
 *  - Panel pratinjau soal + media + topik + kesulitan (komponen yang sama
 *    dengan halaman detail: QuestionImage, DifficultyBadge, TopicTagList).
 *  - Aksi cepat: setujui, kembalikan ke draf, tandai, lengkapi topik.
 */
export default function CuratePage() {
  return (
    <div className="flex flex-col gap-0">
      <PageHeader
        title="Kurasi Soal"
        description="Ruang kerja penelaahan manual — disiapkan untuk Sprint 2."
        actions={
          <Button variant="outline" size="sm" render={<Link href="/review" />}>
            <ClipboardList data-icon="inline-start" /> Buka Telaah
          </Button>
        }
      />

      <div className="w-full max-w-5xl p-4 sm:p-6">
        <Card className="rounded-xl border border-dashed border-border/80 bg-card/60 shadow-xs">
          <CardHeader className="border-b border-border/40 pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Construction aria-hidden className="size-4 shrink-0 text-gold" />
              Kerangka halaman siap — antrean menyusul
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 pt-4 text-sm text-muted-foreground">
            <p className="max-w-prose leading-relaxed">
              Rute <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">/curate</code>{" "}
              sudah aktif dan memakai App Shell yang sama dengan halaman lain.
              Antrean soal, panel pratinjau, dan aksi kurasi akan diisi pada
              Sprint 2 setelah data pengayaan (media, topik, kesulitan) terisi.
            </p>

            <ul className="flex flex-col gap-2">
              <li className="flex items-start gap-2">
                <ListChecks aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
                <span>
                  <strong className="font-medium text-foreground">Antrean telaah</strong> —
                  soal berstatus <em>review</em> dan yang bertanda, diurutkan dari
                  yang paling butuh perhatian.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Sparkles aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
                <span>
                  <strong className="font-medium text-foreground">Pratinjau pengayaan</strong> —
                  gambar soal, tag topik, tingkat kesulitan, dan tipe soal dalam
                  satu panel.
                </span>
              </li>
            </ul>

            <p className="text-xs text-muted-foreground/80">
              Sementara itu, penelaahan berjalan di{" "}
              <Link href="/review" className="text-brand underline underline-offset-2">
                halaman Telaah
              </Link>{" "}
              dan penyuntingan per butir di halaman detail soal.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
