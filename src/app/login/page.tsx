"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, GraduationCap, ClipboardCheck, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DEMO_USERS } from "@/lib/auth/demo-users";

const ICONS: Record<string, typeof ShieldCheck> = {
  admin: ShieldCheck,
  guru: GraduationCap,
  penelaah: ClipboardCheck,
};

/**
 * Halaman login (DEMO). Menampilkan login cepat per-peran.
 *
 * ⚠️ Ini pintu masuk SEMENTARA untuk demo; autentikasi email/password penuh &
 * halaman login produksi = utang M15. Tombol di sini memanggil
 * `/api/dev/quick-login` (mati total di produksi).
 */
export default function LoginPage() {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function quickLogin(key: string) {
    setBusy(key);
    setError(null);
    try {
      const res = await fetch("/api/dev/quick-login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error?.message ?? "Gagal masuk.");
      }
      router.push("/");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-3xl">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold">Masuk ke MathBank</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Demo — pilih peran untuk menjelajah. Tanpa kata sandi.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {DEMO_USERS.map((u) => {
            const Icon = ICONS[u.key] ?? ArrowRight;
            return (
              <Card key={u.key} className="flex flex-col">
                <CardHeader>
                  <div className="mb-2 grid size-10 place-items-center rounded-lg bg-brand/10 text-brand">
                    <Icon />
                  </div>
                  <CardTitle>{u.name}</CardTitle>
                  <CardDescription>{u.description}</CardDescription>
                </CardHeader>
                <CardContent className="mt-auto">
                  <Button
                    className="w-full"
                    disabled={busy !== null}
                    onClick={() => quickLogin(u.key)}
                  >
                    {busy === u.key ? (
                      <>
                        <Loader2 className="animate-spin" data-icon="inline-start" />
                        Masuk…
                      </>
                    ) : (
                      <>
                        Masuk sebagai {u.roles[0]}
                        <ArrowRight data-icon="inline-end" />
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {error && (
          <p className="mt-4 text-center text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Halaman ini untuk demo. Autentikasi email/kata-sandi penuh menyusul (M15).
        </p>
      </div>
    </div>
  );
}
