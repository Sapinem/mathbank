"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  GraduationCap,
  ClipboardCheck,
  LogIn,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DEMO_USERS, DEMO_PASSWORD, type DemoUser } from "@/lib/auth/demo-users";

const ICONS: Record<string, typeof ShieldCheck> = {
  admin: ShieldCheck,
  guru: GraduationCap,
  penelaah: ClipboardCheck,
};

/**
 * Halaman login — form email/kata-sandi dengan **pil user demo** di atasnya.
 *
 * Klik pil demo → email & kata sandi terisi otomatis (tetap harus klik "Masuk"),
 * meniru alur login sungguhan. Mengirim ke `/api/dev/quick-login` (dev) atau
 * `/api/auth/sign-in/email` (produksi) — lihat `signIn()`.
 *
 * ⚠️ Pil demo hanya muncul bila backend mengizinkan (dev). Di produksi
 * `/api/dev/quick-login` mati (404) sehingga pil tak berguna — form tetap jalan
 * bila akun nyata sudah ada.
 */
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [demoAvailable, setDemoAvailable] = useState(false);

  // Tampilkan pil demo hanya bila backend mengizinkan.
  useEffect(() => {
    let alive = true;
    fetch("/api/dev/demo-status")
      .then((r) => r.json())
      .then((j) => alive && setDemoAvailable(j?.data?.demo === true))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  function pickDemo(u: DemoUser) {
    setActiveKey(u.key);
    setEmail(u.email);
    setPassword(DEMO_PASSWORD);
    setError(null);
  }

  async function signIn() {
    setBusy(true);
    setError(null);
    try {
      // Dev: quick-login memakai kunci (lebih andal lintas origin/LAN).
      if (activeKey) {
        const res = await fetch("/api/dev/quick-login", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ key: activeKey }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j?.error?.message ?? "Gagal masuk.");
        }
      } else {
        // Jalur produksi: email + kata sandi via better-auth.
        const res = await fetch("/api/auth/sign-in/email", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        if (!res.ok) throw new Error("Email atau kata sandi salah.");
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
          <div className="mx-auto mb-3 grid size-12 place-items-center rounded-xl bg-brand/10 text-2xl font-semibold text-brand">
            ∑
          </div>
          <h1 className="text-2xl font-semibold">Masuk ke MathBank</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Bank soal matematika — kurasi, susun, terbitkan.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Log in ke akun Anda</CardTitle>
            <CardDescription>
              Masukkan email di bawah ini untuk masuk ke akun Anda
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {/* Pil user demo — klik untuk mengisi otomatis. */}
            {demoAvailable && (
              <div className="flex flex-col gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Akun demo (klik untuk isi otomatis)
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {DEMO_USERS.map((u) => {
                    const Icon = ICONS[u.key];
                    const active = activeKey === u.key;
                    return (
                      <button
                        key={u.key}
                        type="button"
                        onClick={() => pickDemo(u)}
                        aria-pressed={active}
                        title={u.description}
                        className={
                          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors " +
                          (active
                            ? "border-brand bg-brand/10 text-brand"
                            : "border-border text-muted-foreground hover:bg-accent hover:text-foreground")
                        }
                      >
                        {Icon && <Icon className="size-3.5" />}
                        {u.name.replace(" Demo", "")}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <label htmlFor="login-email" className="text-sm font-medium">
                Email
              </label>
              <Input
                id="login-email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setActiveKey(null);
                }}
                placeholder="nama@sekolah.sch.id"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="login-password" className="text-sm font-medium">
                Kata sandi
              </label>
              <Input
                id="login-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setActiveKey(null);
                }}
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}

            <Button
              className="w-full"
              disabled={busy || !email || !password}
              onClick={signIn}
            >
              {busy ? (
                <>
                  <Loader2 className="animate-spin" data-icon="inline-start" />
                  Masuk…
                </>
              ) : (
                <>
                  <LogIn data-icon="inline-start" />
                  Masuk
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          {demoAvailable
            ? "Demo: pilih akun demo lalu klik Masuk. Autentikasi penuh menyusul (M15)."
            : "Masukkan email & kata sandi akun Anda."}
        </p>
      </div>
    </div>
  );
}
