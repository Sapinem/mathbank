import { PageHeader } from "@/components/layout/page-header";
import { ComingSoon } from "@/components/ui/states";

export const metadata = { title: "Cetak Paket — MathBank" };

export default function PaketCetakPage() {
  return (
    <>
      <PageHeader title="Cetak Paket" description="Pratinjau & ekspor PDF naskah paket." />
      <ComingSoon milestone="M8" />
    </>
  );
}
