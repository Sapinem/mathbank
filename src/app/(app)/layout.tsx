import { AppShell } from "@/components/layout/app-shell";

/** Layout grup (app) — semua halaman ber-shell. */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return <AppShell>{children}</AppShell>;
}
