# VERIFIKASI — Audit M2 lanjutan (trustedOrigins & mustChangePassword)

> **Pemicu:** pemilik mengirim 2 temuan lanjutan (trustedOrigins produksi,
> mustChangePassword guard). **Metode:** verifikasi ke kode nyata.

## Temuan #2 — `trustedOrigins` bercampur dev & produksi → ✅ **BENAR (nyata)**

**Bukti:** `src/lib/auth/server.ts:95-109` — `trustedOrigins` **selalu** memuat
`http://localhost:3000/3001`, `127.0.0.1`, dan LAN (`192.168.18.100`), bahkan saat
`NODE_ENV=production`.

**Risiko:** origin dev diterima di produksi → memperluas permukaan CORS/CSRF
(seharusnya produksi hanya menerima domain resmi).

**Perbaikan benar:** origin dev hanya dimasukkan bila **bukan produksi**
(gerbang `NODE_ENV`/`APP_ENV`), sama seperti pola pagar yang sudah kita pakai.
Produksi selalu menerima `APP_URL` + domain resmi.

**Status:** ⬜ belum — menunggu keputusan.

## Temuan #3 — `mustChangePassword` guard → ❌ **SALAH, tapi menyingkap isu lain**

**Klaim laporan:** "belum ada middleware/guard di wrapRoute yang memblokir endpoint."

**Fakta:** `src/lib/api/route-wrapper.ts:161-163` **SUDAH** memblokir:
```ts
if (actor.mustChangePassword) {
  throw new ForbiddenError("Harus ganti password lebih dulu");
}
```
Jadi klaim "belum ada" **tidak benar**.

**NAMUN** — verifikasi menyingkap **masalah nyata yang berbeda**:

| # | Masalah | Bukti |
|---|---------|-------|
| M-1 | Blokir **terlalu luas** — SEMUA endpoint domain, termasuk `GET /api/auth/me` → UI **tak bisa tahu** user perlu ganti password | `route-wrapper.ts:161` (global) |
| M-2 | **Tak ada halaman/UI ganti password** | `find src/app -iname '*password*'` → kosong |
| M-3 | Akibatnya: user `mustChangePassword=true` **terkunci tanpa jalan keluar** (dead-end) — tak bisa buat soal, tak bisa ganti password lewat UI | kombinasi M-1 + M-2 |

**Catatan positif:** endpoint Better Auth `/api/auth/change-password` **di luar**
`wrapRoute` (`api/auth/[...all]`), jadi **secara teknis tidak terblokir** — jalur
perbaikan password ada di lapisan API. Yang hilang adalah **UI-nya**.

**Perbaikan benar (bukan seperti rekomendasi laporan):**
- Rekomendasi laporan = "blokir create/edit soal". Tapi blokir **sudah ada** & lebih luas.
- Yang **perlu**: (a) kecualikan endpoint aman (`/api/auth/me`) agar UI bisa membaca
  status; (b) bangun **halaman ganti password** + arahkan ke sana. → sederhananya:
  jangan kirim `ForbiddenError` global, tapi **redirect ke halaman wajib ganti password**.

**Status:** ⬜ belum — butuh keputusan (menyentuh alur UI, bukan sekadar guard).

## Kesimpulan
- Temuan #2: **valid**, perbaikan murah & jelas.
- Temuan #3: **klaim salah** (guard sudah ada) — tetapi investigasi menemukan
  **dead-end UX nyata** yang lebih penting daripada yang dilaporkan.

---
*Lihat juga: docs/VERIFIKASI-AUDIT-M2.md, docs/KEAMANAN.md.*
