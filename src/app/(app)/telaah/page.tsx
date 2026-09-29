import { PageHeader } from "@/components/layout/page-header";
import { ComingSoon } from "@/components/ui/states";

export default function TelaahPage() {
  return (
    <>
      <PageHeader title="Telaah" description="Kurasi soal: perlu telaah, ditandai, dan kategorisasi." />
      <ComingSoon milestone="M4" />
    </>
  );
}
