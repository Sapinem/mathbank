/**
 * Gerbang `pnpm db:push` (Fase 5).
 *
 * Latar: `db:push` mentah (`drizzle-kit push`) melewati
 * `db:ensure-extensions`/`db:safety` dan tidak menghasilkan file migrasi —
 * perubahan skema yang di-push tidak pernah mendarat di `drizzle/meta`,
 * sehingga DB berikutnya yang dibangun lewat `db:migrate` bisa kehilangan
 * invarian. Skrip `db:push` di package.json kini dirantai:
 *
 *   gate ini → db:ensure-extensions → drizzle-kit push → db:safety → db:verify
 *
 * Gerbang ini hanya memutuskan BOLEH/TIDAK di lingkungan ini:
 * - DIBLOKIR bila NODE_ENV=production atau APP_ENV=production/staging
 *   (definisi production-like yang sama dengan pagar DEMO_LOGIN Fase 2).
 *   Di sana satu-satunya jalur yang sah adalah `pnpm db:migrate`.
 * - DIIZINKAN di dev/test, dengan peringatan: push BUKAN migrasi.
 *   Setelah push, jalankan `pnpm db:generate` untuk menangkap perubahan
 *   skema sebagai file migrasi sebelum commit, lalu `pnpm db:migrate`
 *   di DB lain — jangan mengandalkan push untuk menyebarkan skema.
 *
 * Batasan yang jujur: gerbang ini menutup jalur skrip repo, bukan
 * `npx drizzle-kit push` mentah yang masih bisa dipanggil langsung.
 * Memanggil drizzle-kit mentah tetap melanggar CONSTRAINTS #26 dan
 * prosedur di `docs/SKEMA-DB-DETAIL.md`; tidak ada yang bisa dicegah
 * di level package.json tanpa menghapus drizzle-kit itu sendiri.
 * `db:verify` di ujung rantai juga BUKAN rollback: bila verify gagal,
 * perubahan push sudah terlanjur diterapkan dan harus diperbaiki
 * dengan migrasi lanjutan, bukan dengan mengulang push.
 */

function isProductionLike(env) {
  const nodeEnv = (env.NODE_ENV ?? "").toLowerCase();
  const appEnv = (env.APP_ENV ?? "").toLowerCase();
  return nodeEnv === "production" || appEnv === "production" || appEnv === "staging";
}

if (isProductionLike(process.env)) {
  console.error(
    "✗ db:push DIBLOKIR di lingkungan production-like " +
      `(NODE_ENV=${process.env.NODE_ENV ?? "-"}, APP_ENV=${process.env.APP_ENV ?? "-"}) — ` +
      "pakai `pnpm db:migrate` + `pnpm db:verify` untuk perubahan skema.",
  );
  process.exit(1);
}

console.log(
  "✓ db:push diizinkan di lingkungan ini (dev/test). " +
    "Ingat: push BUKAN migrasi — setelah push, jalankan `pnpm db:generate` " +
    "untuk menangkap perubahan skema sebagai file migrasi sebelum commit.",
);
