import { PageHeader } from "@/components/layout/page-header";
import { ComingSoon } from "@/components/ui/states";

export default function TopikPage() {
  return (
    <>
      <PageHeader title="Topik" description="Kelola hierarki topik matematika." />
      <ComingSoon milestone="M5" />
    </>
  );
}
