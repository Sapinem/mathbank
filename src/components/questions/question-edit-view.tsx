"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { LoadingState, ErrorState } from "@/components/ui/states";
import { QuestionEditor } from "@/components/questions/question-editor";
import { useQuestion } from "@/lib/hooks/use-questions";

/**
 * Halaman sunting soal `/questions/{id}/edit` (G8).
 *
 * KENAPA rute terpisah, bukan state `editing` di halaman detail:
 *   - URL bisa di-bookmark & dibagikan ("tolong perbaiki soal ini");
 *   - tombol Back browser menutup editor, bukan keluar dari halaman;
 *   - muat-ulang (F5) tetap di editor, tidak kembali ke mode lihat.
 *
 * Mengikuti pola yang sudah ada di repo: `bundles/[id]/edit`.
 * Setelah Simpan, `QuestionEditor` sendiri yang mengarahkan kembali ke halaman
 * lihat — jadi komponen ini tak perlu meneruskan callback apa pun.
 */
export function QuestionEditView() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const { data: q, isLoading, isError, error } = useQuestion(id);

  if (isLoading) return <LoadingState label="Memuat soal…" />;
  if (isError)
    return <ErrorState title="Gagal memuat soal" description={error?.message} />;
  if (!q)
    return <ErrorState title="Soal tidak ditemukan" description="Mungkin sudah dihapus." />;

  return (
    <>
      <PageHeader
        title="Sunting Soal"
        description="Perubahan tersimpan saat Anda menekan Simpan."
        actions={
          <Button
            variant="ghost"
            render={<Link href={`/questions/${id}`} />}
            nativeButton={false}
          >
            <ArrowLeft data-icon="inline-start" />
            Kembali
          </Button>
        }
      />
      <QuestionEditor existing={q} />
    </>
  );
}
