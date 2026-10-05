/**
 * MAT-39: `collection-service` DIHAPUS.
 *
 * Wadah naskah soal digabung ke `bundles` (dibedakan via `bundle_type` +
 * `origin`). Seluruh logika koleksi (list, create, update, delete, items)
 * kini ditangani oleh `bundle-service.ts` dan modul saudaranya.
 *
 * File ini dipertahankan sebagai stub kosong (tanpa logika) agar impor
 * type-only dari `src/lib/hooks/use-collections.ts` tak mengganggu
 * typecheck. Ichsan (Frontend) akan memigrasi hook & komponen UI koleksi
 * ke `use-bundles` pada tahap berikutnya.
 */

/** @deprecated MAT-39 — gunakan `BundleRow` dari `./bundle-service`. */
export interface CollectionRow {
  id: string;
  title: string;
  slug: string;
  sourceId: string | null;
  sourceLabel: string | null;
  eventId: string | null;
  eventName: string | null;
  year: number | null;
  grade: string | null;
  description: string | null;
  itemCount: number;
  createdAt: Date;
  updatedAt: Date;
}
