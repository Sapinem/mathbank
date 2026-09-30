import { PageHeader } from "@/components/layout/page-header";
import { QuestionEditor } from "@/components/questions/question-editor";

export const metadata = { title: "Soal Baru — MathBank" };

export default function NewQuestionPage() {
  return (
    <>
      <PageHeader
        title="Soal Baru"
        description="Susun soal, tandai kunci, lalu simpan draf atau kirim ke telaah."
      />
      <QuestionEditor />
    </>
  );
}
