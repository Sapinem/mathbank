import { PageHeader } from "@/components/layout/page-header";
import { ComingSoon } from "@/components/ui/states";

export default function EventPage() {
  return (
    <>
      <PageHeader title="Event" description="UTBK, OSN, ujian sekolah, dan subtesnya." />
      <ComingSoon milestone="M5" />
    </>
  );
}
