import { PageHeader } from "@/components/layout/page-header";
import { ComingSoon } from "@/components/ui/states";

export default function SumberPage() {
  return (
    <>
      <PageHeader title="Sumber & Asal" description="Buku, situs, sekolah, dan institusi asal soal." />
      <ComingSoon milestone="M5" />
    </>
  );
}
