import { PageHeader } from "@/components/layout/page-header";
import { ComingSoon } from "@/components/ui/states";

export default function TikzPage() {
  return (
    <>
      <PageHeader title="TikZ Studio" description="Editor diagram TikZ → SVG." />
      <ComingSoon milestone="G4 — Studio Media" />
    </>
  );
}
