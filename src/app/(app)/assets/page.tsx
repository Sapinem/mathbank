import { Suspense } from "react";
import { AssetGalleryView } from "@/components/media/asset-gallery-view";
import { LoadingState } from "@/components/ui/states";

export const metadata = { title: "Galeri Aset — MathBank" };

export default function AssetsPage() {
  return (
    <Suspense fallback={<LoadingState label="Memuat Galeri Aset…" />}>
      <AssetGalleryView />
    </Suspense>
  );
}
