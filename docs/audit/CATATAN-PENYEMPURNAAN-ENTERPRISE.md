# CATATAN PENYEMPURNAAN ENTERPRISE & BEST PRACTICES MATHBANK

**Tanggal Penyusunan:** 30 September 2026  
**Status:** 💡 Rekomendasi Arsitektural Enterprise (Lanjutan M1–M7)  
**Tujuan:** Panduan best practices rekayasa perangkat lunak modern untuk meningkatkan keandalan, performa, dan keamanan MathBank.

---

## 🚀 Status Implementasi Best Practices Enterprise

| No | Rekomendasi Best Practice | Status Implementasi | Catatan Technical & Decision |
| :-: | :--- | :---: | :--- |
| 1 | **Batasan Panjang Slug (`slugify`)** | ✅ **Selesai (`ed4ac21`)** | Ditambahkan batas pemotongan per-kolom (`100` char untuk `tags`, `255` char untuk `topics/sources/bundles`) guna mencegah error `500` saat string nama terlalu panjang. |
| 2 | **Header Traceability (`X-Request-ID`)** | ✅ **Selesai (`ed4ac21`)** | Header `X-Request-ID` disertakan pada seluruh respons API & dicatat pada log server. |
| 3 | **Header Idempotensi (`Idempotency-Key`)** | ✅ **Selesai (`ed4ac21`)** | Dikembangkan pada `wrapRoute`: Request POST/PUT ganda dengan Key yang sama dibalas instan via `Idempotent-Replay`. |
| 4 | **Server-Side `"use cache"` Next.js 16** | ⛔ **Dibatalkan (Desain Sadar)** | **Reverted:** Menyebabkan efek *Stale-While-Revalidate* (lag 2-5 detik saat mutasi data) dan mengganggu *guard auth* pada `<Suspense>`. Caching UI sudah optimal di-handle oleh React Query di sisi Klien. |
| 5 | **Transaksi Atomik (`db.transaction`)** | 🟠 **Disarankan untuk M8+** | Mutasi multi-tabel pada pembuatan soal & paket disarankan dibungkus transaksi Drizzle. |
| 6 | **Sanitasi SVG TikZ & Strict CSP** | 🟠 **Disarankan untuk M8+** | Sanitasi DOMPurify pada luaran TikZ SVG untuk mencegah potensi XSS. |

---

## 📝 CATATAN VERIFIKASI (2026-09-30)

**Verifikator:** agen pembangun (MathBank) · **Metode:** cek kode + uji live; verifikasi ke sumber primer (docs Next.js) sebelum eksekusi.

**Status: ✅ DIVERIFIKASI — diterapkan selektif (bukan asal ikut):**
- **#2 (BUG NYATA) — diperbaiki:** `slugify` overflow → 500; `NFKD` bisa memperpanjang
  input. Kini `slugify(name, maxLength)` dengan batas per-kolom. Terbukti live: 500 → 409.
- **#6 — diterapkan:** `X-Request-ID` di semua respons + log.
- **#4 — diterapkan:** `Idempotency-Key`; terbukti live (2× POST key sama → id sama).
- **#3 `"use cache"` — DIBATALKAN (keputusan sadar):** `revalidateTag(t,'max')` = SWR →
  data basi 2–5 dtk; `updateTag` hanya di Server Action; guard di `<Suspense>` menghilangkan
  307 server → **nol manfaat, turunkan mutu** → revert.
- **#1/#5** = sudah ada / belum relevan (TikZ belum dibangun).

Pelajaran → `CONSTRAINTS.md` #40–41. Detail: `docs/VERIFIKASI-CATATAN-ENTERPRISE.md`.
