import { Suspense } from "react";
import { ReviewView } from "@/components/questions/review-view";
import { LoadingState } from "@/components/ui/states";

export const metadata = { title: "Telaah — MathBank" };

export default function ReviewPage() {
  return (
    <Suspense fallback={<LoadingState label="Memuat Telaah…" />}>
      <ReviewView />
    </Suspense>
  );
}
