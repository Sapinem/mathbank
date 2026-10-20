/**
 * Verifikasi ACT-04 (sekali pakai): halaman /bundles hanya memanggil
 * `/api/bundles` SEKALI per halaman, tanpa loop sekuensial.
 *
 * Jalankan: node scripts/verify-act04.mjs http://127.0.0.1:3010
 */
import { chromium } from "@playwright/test";

const BASE = process.argv[2] ?? "http://127.0.0.1:3010";

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });

// Login demo lewat API, teruskan cookie ke context.
const login = await ctx.request.post(`${BASE}/api/dev/quick-login`, {
  data: { key: "admin" },
});
console.log("login:", login.status());

const page = await ctx.newPage();
page.setDefaultTimeout(120000);
const hits = [];
page.on("request", (req) => {
  const u = req.url();
  if (u.includes("/api/bundles")) hits.push({ url: u, method: req.method() });
});

await page.goto(`${BASE}/bundles`, { waitUntil: "domcontentloaded" });
await page.locator("text=/paket/").first().waitFor({ timeout: 60000 }).catch(() => {});
await page.waitForTimeout(3000);

const firstLoad = [...hits];
console.log(`\n[buka /bundles] request /api/bundles: ${firstLoad.length}`);
for (const h of firstLoad) console.log("  ", h.method, h.url.replace(BASE, ""));

const rowCount = await page.locator("article").count();
const tableRows = await page.locator("tbody tr").count();
console.log("kartu terlihat:", rowCount, "| baris tabel:", tableRows);
const counter = await page.locator("text=/\\d+ dari \\d+ paket/").first().textContent().catch(() => null);
console.log("penghitung:", counter);

// Halaman 2
hits.length = 0;
const next = page.getByRole("button", { name: /Berikutnya/i });
await next.click();
await page.waitForTimeout(1500);
console.log(`\n[klik Berikutnya] request /api/bundles: ${hits.length}`);
for (const h of hits) console.log("  ", h.method, h.url.replace(BASE, ""));
const p2 = await page.locator("text=/hal\\. \\d+\\/\\d+/").first().textContent().catch(() => null);
console.log("indikator halaman:", p2);

// Pencarian server-side (1 request, bukan per karakter)
hits.length = 0;
await page.getByLabel("Cari naskah").fill("matematika");
await page.waitForTimeout(1800);
console.log(`\n[cari "matematika"] request /api/bundles: ${hits.length}`);
for (const h of hits) console.log("  ", h.method, h.url.replace(BASE, ""));
console.log("penghitung setelah cari:", await page.locator("text=/\\d+ dari \\d+ paket/").first().textContent().catch(() => null));

// Filter status server-side
hits.length = 0;
await page.getByRole("combobox").first().click();
await page.getByRole("option", { name: "Draf" }).click();
await page.waitForTimeout(1500);
console.log(`\n[filter status=Draf] request /api/bundles: ${hits.length}`);
for (const h of hits) console.log("  ", h.method, h.url.replace(BASE, ""));

// Konsol error / hydration?
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(1200);
console.log("\nkonsol error:", errors.length ? errors : "tidak ada");

await browser.close();
