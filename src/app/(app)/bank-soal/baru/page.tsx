import { DesktopOnly } from "@/components/layout/desktop-only";
import { PageHeader } from "@/components/layout/page-header";
import { QuestionEditor } from "@/components/questions/question-editor";

export const metadata = { title: "Soal Baru — MathBank" };

export default function NewQuestionPage() {
  return (
    <DesktopOnly backHref="/bank-soal" backLabel="← Bank Soal">
      <PageHeader
        title="Soal Baru"
        description="Susun soal, tandai kunci, lalu simpan draf atau kirim ke telaah."
      />
      <QuestionEditor />
    </DesktopOnly>
  );
}
