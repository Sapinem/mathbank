/**
 * Persiapan lingkungan untuk generator OpenAPI — **harus diimpor paling awal**.
 *
 * Dua hal yang harus terjadi SEBELUM modul route dievaluasi:
 *  1. `.env` dimuat (modul route membaca env saat impor);
 *  2. `DATABASE_URL` diberi placeholder bila kosong — generator hanya membaca
 *     deklarasi skema, tidak pernah menyentuh basis data, sehingga
 *     `pnpm openapi:check` tetap bisa jalan di CI tanpa .env.
 *
 * Dipisah ke modul sendiri karena ESM mengevaluasi seluruh import lebih dulu
 * daripada badan modul pengimpor: menaruh kedua baris ini di badan
 * `generate-openapi.ts` akan terlambat.
 */
import "dotenv/config";

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "postgres://placeholder@127.0.0.1:5432/placeholder";
}
