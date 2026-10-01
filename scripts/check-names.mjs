#!/usr/bin/env node
/**
 * Penjaga penamaan (CONSTRAINTS #28b) — M16.
 *
 * **Nama file, folder, dan route WAJIB Inggris.** Skrip ini memindai repo dan
 * GAGAL (exit 1) bila menemukan nama ber-kata Indonesia. Label teks UI (di
 * dalam kode/dokumen) tetap Indonesia — yang dijaga di sini hanya **nama**.
 *
 * Pemakaian: `node scripts/check-names.mjs` (dipanggil dari `pnpm lint:names`).
 *
 * Pendekatan: daftar kata Indonesia yang lazim muncul di nama (masuk, soal,
 * topik, pengaturan, …) + pola khusus. Daftar dapat ditambah; hindari kata
 * ambigu yang juga Inggris (mis. "label", "data", "total").
 */
import { readdirSync, statSync } from "node:fs";
import { join, relative, basename } from "node:path";

const ROOT = process.cwd();

/** Kata Indonesia yang TIDAK boleh muncul di nama file/folder/route. */
const INDONESIAN_WORDS = [
  "masuk", "keluar", "pengaturan", "pengguna", "peran", "akun", "sandi",
  "profil", "beranda", "dasbor", "soal", "topik", "telaah", "paket", "ujian",
  "nilai", "galeri", "aset", "sumber", "acara", "pratinjau", "unduh", "unggah",
  "simpan", "batal", "hapus", "ubah", "tambah", "buat", "cari", "daftar",
  "halaman", "kategori", "kesulitan", "jenjang", "riwayat", "laporan", "sandi",
  "pilih", "kirim", "tampil", "buka", "tutup", "kembali", "lanjut",
];

/** Direktori yang dilewati (bukan milik kita / hasil generate). */
const SKIP_DIRS = new Set([
  "node_modules", ".next", ".git", "coverage", "dist", "build", "out",
  "drizzle", "public", "test-results", "playwright-report", ".turbo",
]);

/** Hanya berkas/folder ini yang diperiksa (kode & sumber). */
const CHECK_EXT = /\.(ts|tsx|js|jsx|mjs|cjs)$/;

/** Ekstrak "kata" dari sebuah nama: pisah camelCase, kebab, snake, titik. */
function tokenize(name) {
  return basename(name)
    .replace(/\.[^.]+$/, "") // buang ekstensi
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2") // camelCase
    .split(/[-_.\s]+/)
    .map((t) => t.toLowerCase())
    .filter(Boolean);
}

const findings = [];

function checkName(abs, isDir) {
  const rel = relative(ROOT, abs);
  const tokens = tokenize(abs);
  // .test.tsx → token "test" aman; .db.test → "db","test" aman.
  const hit = tokens.filter((t) => INDONESIAN_WORDS.includes(t));
  if (hit.length) findings.push({ rel, hit, isDir });
}

function walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue;
    const abs = join(dir, entry);
    let st;
    try {
      st = statSync(abs);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      // hanya periksa folder di dalam src/ atau scripts/ (route & modul kita)
      const rel = relative(ROOT, abs);
      if (rel.startsWith("src") || rel.startsWith("scripts")) checkName(abs, true);
      walk(abs);
    } else if (CHECK_EXT.test(entry)) {
      const rel = relative(ROOT, abs);
      if (rel.startsWith("src") || rel.startsWith("scripts")) checkName(abs, false);
    }
  }
}

walk(ROOT);

if (findings.length === 0) {
  console.log("✅ Penamaan: semua nama file/folder/route berbahasa INGGRIS (CONSTRAINTS #28b).");
  process.exit(0);
}

console.error("⛔ Pelanggaran penamaan (CONSTRAINTS #28b) — nama wajib INGGRIS:\n");
for (const f of findings) {
  console.error(`  ${f.isDir ? "[dir] " : "      "}${f.rel}  ← kata: ${f.hit.join(", ")}`);
}
console.error(
  `\nPerbaiki: ganti nama file/folder/route ke bahasa Inggris (label UI tetap Indonesia).`,
);
process.exit(1);
