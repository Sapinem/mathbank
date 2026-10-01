#!/usr/bin/env tsx
/**
 * Smoke test PRODUKSI (read-only) — memverifikasi deploy hidup tanpa
 * menyentuh data. Aman dijalankan ke domain publik.
 *
 * Pemakaian:
 *   pnpm smoke:prod                          # default https://b.iyo.my.id
 *   BASE_URL=http://192.168.18.100:1234 pnpm smoke:prod
 *
 * Yang diuji:
 *   1. Halaman publik hidup (200)
 *   2. Guard: halaman terlindungi → 307 ke /login
 *   3. Halaman /login 200 (tak ada loop)
 *   4. API demo-status menjawab (JSON valid)
 *   5. Quick-login: 404 di produksi (pagar dev-bypass AKTIF) — peringatan bila hidup
 *   6. Header keamanan hadir (CSP, X-Frame-Options)
 */

const BASE = process.env.BASE_URL ?? "https://b.iyo.my.id";

interface Hasil {
  nama: string;
  lulus: boolean;
  detail: string;
}

const hasil: Hasil[] = [];

function catat(nama: string, lulus: boolean, detail: string) {
  hasil.push({ nama, lulus, detail });
  console.log(`${lulus ? "✅" : "❌"} ${nama} — ${detail}`);
}

async function checkPage(path: string, harapStatus: number, tolakRedirectKe?: string) {
  try {
    const res = await fetch(`${BASE}${path}`, { redirect: "manual" });
    const ok = res.status === harapStatus;
    const loc = res.headers.get("location") ?? "";
    if (harapStatus === 307 && tolakRedirectKe) {
      catat(
        `GET ${path} → ${harapStatus}`,
        res.status === 307 && loc.includes(tolakRedirectKe),
        `status=${res.status} location=${loc || "-"}`,
      );
      return;
    }
    catat(`GET ${path} → ${harapStatus}`, ok, `status=${res.status}`);
  } catch (e) {
    catat(`GET ${path} → ${harapStatus}`, false, `error: ${(e as Error).message}`);
  }
}

async function main() {
  console.log(`\n🔎 Smoke test produksi: ${BASE}\n`);

  // 1–3. Halaman
  await checkPage("/login", 200);
  await checkPage("/", 307, "/login");
  await checkPage("/questions", 307, "/login");

  // 4. API demo-status (publik, read-only)
  try {
    const res = await fetch(`${BASE}/api/dev/demo-status`);
    const json = (await res.json()) as { data?: { demo?: boolean } };
    catat(
      "GET /api/dev/demo-status → JSON",
      res.status === 200 && typeof json.data?.demo === "boolean",
      `status=${res.status} demo=${json.data?.demo}`,
    );
  } catch (e) {
    catat("GET /api/dev/demo-status", false, `error: ${(e as Error).message}`);
  }

  // 5. Pagar quick-login. Default produksi: harus MATI (404/405). Bila
  //    demo disengaja, set EXPECT_DEMO_LOGIN=1 → hidup (200) dianggap benar.
  const demoDisengaja = process.env.EXPECT_DEMO_LOGIN === "1";
  try {
    const res = await fetch(`${BASE}/api/dev/quick-login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key: "admin" }),
    });
    if (demoDisengaja) {
      catat(
        "Login demo (sengaja diaktifkan)",
        res.status === 200,
        res.status === 200 ? "hidup (sesuai DEMO_LOGIN)" : `status=${res.status} — demo tak jalan`,
      );
    } else {
      const pagarAktif = res.status === 404 || res.status === 405;
      catat(
        "Pagar quick-login (harus mati di produksi)",
        pagarAktif,
        pagarAktif
          ? `status=${res.status} (aman)`
          : `⚠️  status=${res.status} — PINTU BELAKANG TERBUKA!`,
      );
    }
  } catch (e) {
    catat("Pagar quick-login", false, `error: ${(e as Error).message}`);
  }

  // 6. Header keamanan
  try {
    const res = await fetch(`${BASE}/login`);
    const csp = res.headers.get("content-security-policy");
    const xfo = res.headers.get("x-frame-options");
    catat(
      "Header keamanan (CSP)",
      Boolean(csp),
      csp ? `CSP ada (${csp.slice(0, 40)}…)` : "CSP TIDAK ADA",
    );
    catat("Header keamanan (X-Frame-Options)", Boolean(xfo), xfo ?? "TIDAK ADA");
  } catch (e) {
    catat("Header keamanan", false, `error: ${(e as Error).message}`);
  }

  // Ringkasan
  const gagal = hasil.filter((h) => !h.lulus);
  console.log(`\n— Ringkasan: ${hasil.length - gagal.length}/${hasil.length} lulus —\n`);
  if (gagal.length > 0) {
    console.log("Yang gagal:");
    for (const g of gagal) console.log(`  • ${g.nama}: ${g.detail}`);
    process.exit(1);
  }
  console.log("Produksi sehat. ✨\n");
}

main();
