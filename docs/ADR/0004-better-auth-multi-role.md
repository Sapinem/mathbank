# ADR-0004 — Better Auth + multi-role (tabel `user_roles`)

- **Status:** Diterima
- **Tanggal:** 2026-09-29
- **Pengambil keputusan:** Arsitek
- **Terkait:** `DESAIN-PER-LAPISAN` (L1), `KEAMANAN.md` §3–4

## Konteks

Aplikasi butuh **dua kelas kredensial**: session cookie untuk manusia (guru, reviewer, admin) dan API key untuk agen/mesin (MCP, ingest). QBank mencampur peran dalam kolom `role` bertipe campuran (varchar/enum) dan tidak mendukung multi-role.

## Keputusan

- **Better Auth** sebagai mesin autentikasi (session + plugin `@better-auth/api-key`).
- **Peran TIDAK disimpan di `user`** — memakai tabel **`user_roles`** (relasi banyak), memungkinkan **multi-role** per akun.
- **5 peran:** `admin`, `teacher`, `reviewer`, `agent`, `machine`.
- Izin didefinisikan sebagai **matriks** `PERMISSIONS` (L1).

## Alternatif yang Dipertimbangkan

| Alternatif | Kenapa ditolak |
|------------|----------------|
| NextAuth/Auth.js | Menyimpan peran di token/sesi; multi-role & API key kurang native |
| Auth buatan sendiri | Risiko keamanan; sesi/rotasi/dsb. harus dirawat manual |
| Peran tunggal di `user` | Tak cukup untuk guru-yang-juga-reviewer; melanggar kebutuhan multi-role |

## Konsekuensi

**Positif:**
- Multi-role asli; dua kelas kredensial dalam satu sistem.
- Rate limit bawaan untuk API key.
- Peran dicek per-aksi dari DB (bukan dari token yang bisa basi).

**Negatif / utang:**
- Satu query tambahan untuk memuat peran per-request (dapat di-cache nanti).
- Ketergantungan pada API Better Auth (stabil: 1.7.6, terbaru).
- `requireEmailVerification: false` — **utang keamanan** (lihat KEAMANAN S4).

## Catatan

Better Auth `admin`/`apiKey` plugin selaras pola multi-peran. Terverifikasi terbaru via Context7 (`REVIEW-TUMPUKAN-TEKNOLOGI.md`).

**Dikukuhkan oleh riset (2026-09-29)** — lihat `RISET-BETTER-AUTH.md`:
- Plugin RBAC resmi Better Auth (`admin`, `organization`) **tak menjawab** kebutuhan inti MathBank: izin **`own`** (kepemilikan resource) & **multi-role** yang mulus. Semua opsi tetap butuh kode `own` sendiri.
- **Keputusan: pakai Better Auth HANYA untuk autentikasi** (session + API key); otorisasi tetap matriks sendiri (`permissions.ts` + `guards.ts`), kini **43 tes** (kunci exhaustive).
- Boleh **nanti** pertimbangkan plugin `admin` **hanya untuk manajemen user** (bukan otorisasi).
