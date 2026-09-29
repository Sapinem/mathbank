import { PageHeader } from "@/components/layout/page-header";
import { ComingSoon } from "@/components/ui/states";

export default function PengaturanPage() {
  return (
    <>
      <PageHeader title="Pengaturan" description="Umum, AI, pengguna, dan sistem." />
      <ComingSoon milestone="M4" />
    </>
  );
}
