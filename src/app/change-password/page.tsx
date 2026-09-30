"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Halaman WAJIB ganti password (akun dengan `mustChangePassword=true`).
 *
 * Alur: admin me-reset password → flag `mustChangePassword` menyala → semua
 * endpoint domain diblokir (403 PASSWORD_CHANGE_REQUIRED) → user diarahkan ke
 * sini. Ganti password memakai Better Auth `/api/auth/change-password`
 * (di luar `wrapRoute`, jadi tetap bisa diakses), lalu flag dimatikan.
 */
export default function ChangePasswordPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  // Bila dipaksa (flagged), arahkan ke sini; bila tidak, boleh keluar.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/me");
        const j = await res.json().catch(() => ({}));
        if (!cancelled && res.ok && j?.data?.mustChangePassword === false) {
          router.replace("/");
        }
      } catch {
        /* biarkan tampil; user bisa mencoba ganti */
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function submit() {
    setError(null);
    if (newPassword.length < 8) {
      setError("Kata sandi baru minimal 8 karakter.");
      return;
    }
    if (newPassword !== confirm) {
      setError("Konfirmasi kata sandi tidak cocok.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.message ?? j?.error?.message ?? "Gagal ganti password.");
      }
      router.push("/");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 grid size-12 place-items-center rounded-xl bg-brand/10 text-brand">
            <KeyRound className="size-6" aria-hidden />
          </div>
          <h1 className="text-2xl font-semibold">Ganti Kata Sandi</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Demi keamanan, Anda wajib mengganti kata sandi sebelum melanjutkan.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Kata sandi baru</CardTitle>
            <CardDescription>
              Masukkan kata sandi saat ini, lalu kata sandi baru Anda.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="cp-old" className="text-sm font-medium">
                Kata sandi saat ini
              </label>
              <Input
                id="cp-old"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                disabled={checking}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="cp-new" className="text-sm font-medium">
                Kata sandi baru
              </label>
              <Input
                id="cp-new"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={checking}
              />
              <p className="text-xs text-muted-foreground">Minimal 8 karakter.</p>
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="cp-confirm" className="text-sm font-medium">
                Ulangi kata sandi baru
              </label>
              <Input
                id="cp-confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                disabled={checking}
              />
            </div>

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}

            <Button
              onClick={submit}
              disabled={busy || checking || !currentPassword || !newPassword}
              className="w-full"
            >
              {busy && <Loader2 className="animate-spin" aria-hidden />}
              Simpan kata sandi baru
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
