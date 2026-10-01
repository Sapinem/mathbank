import { PageHeader } from "@/components/layout/page-header";
import { ComingSoon } from "@/components/ui/states";

export default function AssetsPage() {
  return (
    <>
      <PageHeader title="Galeri Aset" description="Kelola aset media: gambar, SVG, dan diagram TikZ." />
      <ComingSoon milestone="M6" />
    </>
  );
}
