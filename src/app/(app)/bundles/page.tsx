import { Suspense } from "react";
import { BundleListView } from "@/components/bundles/bundle-list-view";
import { LoadingState } from "@/components/ui/states";

export const metadata = { title: "Paket Soal — MathBank" };

export default function BundlesPage() {
  return (
    <Suspense fallback={<LoadingState label="Memuat paket…" />}>
      <BundleListView />
    </Suspense>
  );
}
