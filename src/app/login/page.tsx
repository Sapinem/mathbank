"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  GraduationCap,
  ClipboardCheck,
  LogIn,
  Loader2,
  Eye,
  EyeOff,
  AlertCircle,
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
import { cn } from "@/lib/utils";
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
  const emailInputRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [demoAvailable, setDemoAvailable] = useState(false);

  // Fokuskan otomatis pada perangkat ber-pointer halus (desktop)
  useEffect(() => {
    if (typeof window !== "undefined" && !window.matchMedia("(pointer: coarse)").matches) {
      emailInputRef.current?.focus();
    }
  }, []);

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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!busy && email && password) {
      signIn();
    }
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
          <div className="relative mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl border border-brand/20 bg-card shadow-xs overflow-hidden p-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element -- logo resmi MathBank */}
            <img
              src="/icon.png"
              alt="MathBank"
              width={40}
              height={40}
              className="size-full object-contain"
            />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Masuk ke MathBank</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Bank soal matematika - kurasi, susun, terbitkan.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Masuk ke akun Anda</CardTitle>
            <CardDescription>
              Gunakan email institusi atau akun terdaftar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {/* Pil user demo (klik untuk isi otomatis) */}
              {demoAvailable && (
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    Akun demo (klik untuk isi otomatis)
                  </span>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
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
                          className={cn(
                            "flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all active:scale-98",
                            active
                              ? "border-brand bg-brand/10 text-brand shadow-2xs font-semibold"
                              : "border-border text-muted-foreground hover:bg-accent hover:text-foreground",
                          )}
                        >
                          {Icon && <Icon className="size-3.5 shrink-0" />}
                          <span>{u.name.replace(" Demo", "")}</span>
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
                  ref={emailInputRef}
                  id="login-email"
                  type="email"
                  required
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
                <div className="relative">
                  <Input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setActiveKey(null);
                    }}
                    placeholder="••••••••"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                    className="absolute right-0 top-1/2 flex min-h-[44px] min-w-[44px] -translate-y-1/2 items-center justify-center text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div
                  className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive"
                  role="alert"
                >
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <span className="leading-snug">{error}</span>
                </div>
              )}

              <Button
                type="submit"
                className="w-full min-h-[44px]"
                disabled={busy || !email || !password}
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
            </form>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          {demoAvailable
            ? "Demo: pilih akun demo lalu klik Masuk."
            : "Masukkan email & kata sandi akun Anda."}
        </p>
      </div>
    </div>
  );
}
