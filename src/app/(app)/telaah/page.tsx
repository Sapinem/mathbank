import { Suspense } from "react";
import { TelaahView } from "@/components/questions/telaah-view";
import { LoadingState } from "@/components/ui/states";

export const metadata = { title: "Telaah — MathBank" };

export default function TelaahPage() {
  return (
    <Suspense fallback={<LoadingState label="Memuat Telaah…" />}>
      <TelaahView />
    </Suspense>
  );
}
