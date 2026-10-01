#!/usr/bin/env node
/**
 * Pemindai rahasia (M13 — S6). Murni Node, TANPA dependency/binary eksternal.
 *
 * Memindai berkas yang akan di-commit (staged) terhadap pola rahasia umum,
 * agar kredensial tak pernah masuk riwayat Git. Dipasang sebagai **pre-commit
 * hook** (lihat package.json `prepare`/`scripts`). Bisa juga dijalankan manual:
 *
 *   node scripts/secret-scan.mjs            # memindai berkas staged
 *   node scripts/secret-scan.mjs --all      # memindai SELURUH berkas terlacak
 *   node scripts/secret-scan.mjs <berkas>…  # memindai berkas tertentu
 *
 * Keluar dengan kode 1 bila ada temuan (memblokir commit).
 */

import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";

/** @typedef {{name: string, re: RegExp}} Rule */

/** Pola rahasia. Setiap `re` pakai flag `g` agar bisa berulang. */
const RULES = [
  { name: "Privat key PEM", re: /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/g },
  { name: "OpenAI/9router key", re: /\bsk-[A-Za-z0-9_-]{20,}\b/g },
  { name: "Anthropic key", re: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g },
  { name: "GitHub token", re: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/g },
  { name: "Google API key", re: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { name: "Slack token", re: /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/g },
  { name: "AWS access key", re: /\bAKIA[0-9A-Z]{16}\b/g },
  { name: "JWT", re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g },
  {
    // URI DB ber-kredensial. Password placeholder (***, xxx, REDACTED, <pwd>)
    // TIDAK dianggap temuan — itu contoh dokumentasi lazim.
    name: "URI DB ber-kredensial",
    re: /\b(?:postgres(?:ql)?|mysql|mongodb|redis):\/\/([^\s:@/]+):([^\s:@/]+)@/g,
    allowPassword: /^(\*+|[xX]+|REDACTED|CHANGEME|PASSWORD|<[^>]+>|\.\.\.|YOUR[A-Z_]*)$/i,
  },
  // Rahasia terenkripsi MathBank (AES-GCM v1) — jangan pernah ke repo.
  { name: "Rahasia aplikasi v1:", re: /\bv1:[0-9a-f]{8,}:[0-9a-f]{8,}:[0-9a-f]{8,}\b/g },
  // Penugasan variabel rahasia dengan nilai tampak (bukan placeholder).
  // Nilai berupa **pemanggilan fungsi / akses env** (mis. `resolveAuthSecret(...)`,
  // `process.env.X`, berisi `(`, `.`, `[`) BUKAN rahasia literal → difilter
  // lewat `looksLikeCode()` di `scanFile`.
  {
    name: "Penugasan rahasia",
    re: /(?:SECRET|TOKEN|PASSWORD|API_KEY|PRIVATE_KEY|ENC_KEY)\s*[:=]\s*["']?([A-Za-z0-9+/_=.-]{12,})["']?/gi,
    skipIfCode: true,
  },
];

/** Nama fungsi yang jelas-jelas pemroses nilai (bukan literal rahasia). */
const FUNCTION_NAME_RE = /^(?:decode|encode|parse|stringify|resolve|build|create|get|load|read|format|merge|pick|make|use|with|from|to)[A-Za-z]*$/;

/** Nilai yang jelas-jelas potongan KODE, bukan rahasia literal. */
function looksLikeCode(value) {
  if (/[()[\]]/.test(value)) return true; // pemanggilan/indeks: f(...), a[b]
  if (/\./.test(value)) return true; // akses properti: process.env.X, mod.fn
  if (FUNCTION_NAME_RE.test(value)) return true; // nama fungsi (mis. decodeURIComponent)
  // Identifier KONSTANTA (mis. DEMO_PASSWORD, API_KEY_ENV): huruf besar + garis
  // bawah, tanpa huruf kecil → referensi variabel, bukan literal.
  if (/^[A-Z][A-Z0-9_]*$/.test(value)) return true;
  return false;
}

/** Nilai mengandung interpolasi template (`${…}`) → dinamis, bukan literal. */
function hasTemplateInterpolation(value) {
  return /\$\{/.test(value);
}

/** Nilai yang jelas-jelas placeholder → abaikan. */
const PLACEHOLDERS = new Set([
  "changeme",
  "change-me",
  "example",
  "placeholder",
  "your-key-here",
  "xxx",
  "todo",
  "redacted",
  "[redacted]",
  "***",
  // Sentinel uji (nilai sengaja buat menguji kebocoran) — bukan rahasia nyata.
  "jangan-bocor",
  "janganbocor",
  "do-not-leak",
  "test-secret",
  "fake-secret",
]);

/** Ekstensi/berkas yang dikecualikan dari pemindaian. */
const SKIP_FILES = new Set([
  "pnpm-lock.yaml",
  "package-lock.json",
  "yarn.lock",
  // Berkas UJI pemindai ini sendiri memuat contoh rahasia NYATA sebagai input
  // verifikasi (agar deteksi terbukti). Ia bukan kebocoran — bukan kode produksi.
  "secret-scan.test.ts",
]);
const SKIP_EXT = /\.(png|jpe?g|gif|webp|ico|pdf|zip|gz|tgz|woff2?|ttf|otf|mp4|mp3|wasm)$/i;

/**
 * Ambil daftar berkas staged (default) atau seluruh berkas terlacak (`--all`).
 * @returns {string[]}
 */
function targetFiles() {
  const args = process.argv.slice(2);
  if (args.length > 0 && !args.includes("--all")) return args.filter(Boolean);
  const cmd = args.includes("--all")
    ? ["ls-files"]
    : ["diff", "--cached", "--name-only", "--diff-filter=ACMR"];
  const out = execFileSync("git", cmd, { encoding: "utf8" });
  return out.split("\n").map((s) => s.trim()).filter(Boolean);
}

/** Awam: apakah nilai cocok placeholder (mis. "changeme")? */
function isPlaceholder(value) {
  const v = value.toLowerCase();
  if (PLACEHOLDERS.has(v)) return true;
  if (/^(todo|xxx+|\.\.\.|<.*>)$/.test(v)) return true; // samaran khas
  return false;
}

/**
 * Nilai placeholder yang JELAS bukan rahasia (nilai CI/dummy/build).
 * Sengaja sempit agar rahasia nyata tetap tertangkap.
 */
function isObviousPlaceholder(value) {
  const v = value.toLowerCase();
  // Kata kunci penanda dummy.
  if (/changeme|placeholder|dummy|sample|example|redacted|testpass|testpass|^ci-|^build-|-placeholder-|-not-a-secret|-injected-/.test(v)) return true;
  // Huruf/angka sama berulang ≥16× (mis. "0000…", "aaaa…").
  if (/(.)\1{15,}/.test(v)) return true;
  // Panjang ≥16 tapi hanya 1 karakter unik (mis. 32 nol).
  if (v.length >= 16 && new Set(v).size === 1) return true;
  return false;
}

/** Berkas templat/contoh (dokumentasi, nilai = contoh). */
function isExampleFile(file) {
  return /\.example$|\.sample$|\.template$/i.test(file) || /(^|\/)\.env\.[^/]*\.example$/.test(file);
}

/**
 * Nilai pada berkas contoh yang aman (placeholder yang jelas, bukan rahasia nyata).
 * Lebih longgar dari isObviousPlaceholder tapi tetap menolak nilai alfanumerik
 * acak yang menyerupai rahasia asli.
 */
function isPlaceholderLike(value) {
  if (isObviousPlaceholder(value)) return true;
  const v = value.toLowerCase();
  // Semua huruf (kata biasa, mis. "changeme-strong-password") = contoh.
  if (/^[a-z-]+$/.test(v)) return true;
  // Mengandung kata penanda umum.
  if (/pass|secret|key|token|user|db|host|domain|email|ion|it/.test(v)) return true;
  // Akhiran khusus CI/uji (mis. "mathbank_ci", "app_test", "test_db").
  if (/_ci$|_test$|^ci_|^test_|_e2e$|_dummy$/.test(v)) return true;
  // Placeholder bersudut/bergaris: <...>, ${...}, YOUR_*, *_HERE.
  if (/<[^>]*>|\$\{|^your_|_here$|^xxx/.test(v)) return true;
  return false;
}

/**
 * Pindai satu berkas. Kembalikan daftar temuan.
 * @param {string} file
 * @returns {{file: string, rule: string, line: number}[]}
 */
function scanFile(file) {
  const findings = [];
  try {
    if (statSync(file).isDirectory()) return findings;
  } catch {
    return findings;
  }
  if (SKIP_EXT.test(file) || SKIP_FILES.has(file.split("/").pop() ?? "")) return findings;

  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    return findings; // biner / tak terbaca
  }
  if (text.includes("\u0000")) return findings; // biner

  const lines = text.split("\n");
  for (const rule of RULES) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      rule.re.lastIndex = 0;
      let m;
      while ((m = rule.re.exec(line)) !== null) {
        // Aturan ber-`allowPassword`: grup 2 = password. Bila password berupa
        // placeholder (***, xxx, REDACTED) ATAU interpolasi template (`${…}`,
        // nilai dinamis) ATAU placeholder jelas (build/test/ci/dummy) →
        // bukan rahasia literal, lewati.
        if (rule.allowPassword) {
          if (
            m[2] &&
            (rule.allowPassword.test(m[2]) ||
              hasTemplateInterpolation(m[2]) ||
              isObviousPlaceholder(m[2]) ||
              isPlaceholderLike(m[2]))
          )
            continue;
          // Password nyata (bukan placeholder) → temuan.
          findings.push({ file, rule: rule.name, line: i + 1 });
          continue;
        }
        const captured = m[1] ?? m[0];
        if (isPlaceholder(captured)) continue;
        if (rule.skipIfCode && looksLikeCode(captured)) continue;
        // Abaikan contoh dokumentasi bernilai (…/REDACTED/contoh) ATAU nilai
        // yang sengaja ditandai publik/demo oleh komentar di sekitar baris.
        if (/REDACTED|example|contoh|placeholder/i.test(line)) continue;
        // Nilai placeholder yang jelas (bukan rahasia): "changeme", "build",
        // "test*", "dummy", "ci-*", "*-placeholder", string huruf-ulang.
        if (isObviousPlaceholder(captured)) continue;
        // Berkas templat (mis. `.env.*.example`) = dokumentasi; nilainya contoh.
        if (isExampleFile(file) && isPlaceholderLike(captured)) continue;
        // Cek juga beberapa baris SEBELUMNYA (komentar penjelas sering di atas
        // kode, dipisah baris kosong / docblock).
        const context = lines.slice(Math.max(0, i - 4), i + 1).join(" ");
        if (/sengaja publik|bukan rahasia|sengaja|demo-only|intentionally public/i.test(context)) continue;
        findings.push({ file, rule: rule.name, line: i + 1 });
      }
    }
  }
  return findings;
}

function main() {
  const files = targetFiles();
  const findings = files.flatMap(scanFile);
  if (findings.length === 0) {
    console.log(`✅ Pemindai rahasia: bersih (${files.length} berkas diperiksa).`);
    process.exit(0);
  }
  console.error("⛔ Pemindai rahasia MENEMUKAN kemungkinan kredensial:\n");
  for (const f of findings) {
    console.error(`  ${f.file}:${f.line}  [${f.rule}]`);
  }
  console.error(
    "\nPerbaiki: hapus/pindahkan nilai ke .env (jangan di-commit), atau tandai " +
      "'REDACTED' bila memang contoh dokumentasi.",
  );
  process.exit(1);
}

main();
