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

**Status: ✅ SELESAI** (2026-09-30) — origin dev dipagari `isProductionRuntime()`
(`NODE_ENV` produksi ATAU `APP_ENV` `production`/`staging`). Produksi hanya menerima
`APP_URL` + `https://b.iyo.my.id`. Terbukti runtime: `Origin: localhost:3000` → **403**,
origin resmi → 400 (bukan 403).

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

**Status: ✅ SELESAI** (2026-09-30) — (a) `/api/auth/me` dikecualikan via
`allowPasswordChangePending`; (b) halaman `/change-password` dibangun; (c) app-layout
mengalihkan akun ber-flag ke sana; (d) error diubah ke `PasswordChangeRequiredError`
(`PASSWORD_CHANGE_REQUIRED`) agar UI bisa bereaksi. Utang kecil tercatat: halaman
403 generik belum dibuat (lihat T-M2-2).

## Kesimpulan
- Temuan #2: **valid**, perbaikan murah & jelas → ✅ selesai.
- Temuan #3: **klaim salah** (guard sudah ada) — tetapi investigasi menemukan
  **dead-end UX nyata** yang lebih penting daripada yang dilaporkan → ✅ selesai.

## Sinkronisasi dokumen audit (2026-09-30)
Temuan #2 & #3 di atas mengekspos bahwa **dokumen audit lama memuat klaim basi**.
Berikut yang disinkronkan:
- `docs/REVIEW-PER-MILESTONE.md` §M2 — baris `mustChangePassword` (pesan error),
  T-M2-1 (login ✅), T-M2-2 (403 🟡), kesimpulan M2 diperbarui.
- `docs/KEAMANAN.md:48-49` — pagar dev-bypass (3 pagar) + `mustChangePassword` (code & pengecualian).
- `docs/KONTRAK-API.md:26` — aturan `mustChangePassword` diperjelas.

---
*Lihat juga: docs/VERIFIKASI-AUDIT-M2.md, docs/KEAMANAN.md.*
