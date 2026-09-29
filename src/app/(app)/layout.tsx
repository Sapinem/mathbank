import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { getSessionUser } from "@/lib/auth/session";

/**
 * Layout grup (app) — semua halaman ber-shell.
 *
 * **Guard:** wajib punya sesi NYATA (cookie better-auth). Tanpa sesi → alihkan
 * ke `/login` untuk memilih peran. Dev bypass `AUTH_DEV_BYPASS` sengaja TIDAK
 * dihitung di sini agar login/berbagi peran jadi bermakna saat demo.
 *
 * `AUTH_GUARD_DISABLED=true` menonaktifkan guard (dipakai e2e yang menguji
 * halaman tanpa alur login).
 */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  if (process.env.AUTH_GUARD_DISABLED !== "true") {
    const user = await getSessionUser();
    if (!user) redirect("/login");
  }
  return <AppShell>{children}</AppShell>;
}
