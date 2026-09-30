import { Suspense } from "react";
import { BankSoalView } from "@/components/questions/bank-soal-view";
import { LoadingState } from "@/components/ui/states";

export const metadata = { title: "Bank Soal — MathBank" };

export default function BankSoalPage() {
  return (
    <Suspense fallback={<LoadingState label="Memuat Bank Soal…" />}>
      <BankSoalView />
    </Suspense>
  );
}
