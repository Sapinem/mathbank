import { Suspense } from "react";
import { QuestionBankView } from "@/components/questions/question-bank-view";
import { LoadingState } from "@/components/ui/states";

export const metadata = { title: "Bank Soal — MathBank" };

export default function QuestionBankPage() {
  return (
    <Suspense fallback={<LoadingState label="Memuat Bank Soal…" />}>
      <QuestionBankView />
    </Suspense>
  );
}
