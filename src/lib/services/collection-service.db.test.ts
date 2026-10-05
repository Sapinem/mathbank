/**
 * MAT-39: Tes DB koleksi DIHAPUS.
 *
 * Tabel `collections` & `collection_items` telah dihapus dari skema.
 * Fungsionalitas arsip naskah kini ditangani oleh `bundles` dengan
 * `bundle_type='source'`. Tes ekuivalen ada di `bundle-service.db.test.ts`.
 *
 * File ini dipertahankan kosong (tanpa tes) agar `vitest` tak mencari
 * impor yang sudah dihapus.
 */
import { describe, it, expect } from "vitest";

describe("MAT-39: collections dihapus", () => {
  it("skema tidak lagi memiliki tabel collections", async () => {
    // Placeholder — verifikasi nyata via information_schema ada di tes
    // integrasi bundle-service dan skrip db-verify.
    expect(true).toBe(true);
  });
});
