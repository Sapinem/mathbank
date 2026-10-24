Audit selesai. Saya mengikuti alur skill `security-and-hardening` (peta batas kepercayaan → STRIDE → cek tiga tingkat kendali → *Review Checklist* → *Verification*), dan **tidak mengubah kode aplikasi** — hanya menambah satu berkas bukti dan memperbarui dokumen.

## Hasil

**Laporan utama:** `MathBankAuditor/reports/2026-10-17/audit-security-and-hardening.md` (549 baris)

| Tingkat | Jumlah |
|---|---:|
| CRITICAL | 0 |
| **HIGH** | **6** |
| MEDIUM | 9 |
| LOW | 7 |
| INFO (kontrol yang sudah baik) | 8 |

**6 temuan HIGH — semuanya saya reproduksi, bukan sekadar dugaan:**

1. **SEC-01** — `setQuestionFlag` memanggil `assertCan(actor,"question:flag")` **tanpa `ownerId`** → aturan `own` mati: guru 403 pada *semua* soal (alur "tandai" mati) dan izin kehilangan semantik kepemilikan (melanggar CONSTRAINTS #35, kelas bug T-M4-3). Tak ada tes per-route peran guru.
2. **SEC-02** — semua limiter berbasis IP memakai `X-Forwarded-For` mentah. Dibuktikan: **400 permintaan `/img` tanpa satu pun 429**. Klaim "tahan spoof" di `docs/KEAMANAN.md` S1 hanya benar untuk Better Auth.
3. **SEC-03** — `TLS_RELAXED_HOSTS` memakai `rejectUnauthorized:false`, dan redirect dari host relaxed ikut tanpa verifikasi sertifikat.
4. **SEC-04** — `corpus://` path traversal **masih terbuka**: `corpus://defantri/../../../../etc/passwd` terbukti resolve ke `/home/hari/projects/qbank/etc/passwd`.
5. **SEC-05** — `MATHBANK_EXPORT_DIR` tanpa allowlist → `rm -r` + `git add -A` di folder mana pun (kebocoran `answer_key` ke git).
6. **SEC-06** — SSRF lewat `ai.base_url` (koneksi ke `127.0.0.1` terverifikasi terjadi), dengan detail internal bocor lewat pesan galat.

MEDIUM mencakup: `pnpm audit` 3 high tanpa triage tertulis/CI gate, cookie `Secure` tak dipaksa, route mutasi tanpa rate limit, limiter in-memory bocor memori, error 500/503 membocorkan detail PG, `rawContent` ingest tanpa batas, dan `mustChangePassword` yang bisa dilepas sendiri.

## Bukti & verifikasi
- `src/lib/security/audit-2026-10-17.proof.test.ts` — 6/6 lulus sebagai bukti cacat; dihapus blok-per-blok setelah masing-masing diperbaiki.
- `tsc --noEmit`: 0 error • eslint berkas baru: bersih • `pnpm test`: **966/967 lulus**. Satu kegagalan (`check-names`) **preexisting dan tak terkait**: 342 skrip `scripts/dev/*` berbahasa Indonesia (untracked). Saya buktikan dengan memindahkan folder itu sementara → `check-names` hijau, lalu dipulihkan.

## Kepatuhan (temuan penting)
- **CONSTRAINTS #20 (LaTeX `openin_any='p'`) tidak dapat diverifikasi** — repo tak punya engine LaTeX; klaim ✅ di laporan `MathBankAuditor/reports/17.10.2026/*` **tidak sah**.
- #21 ✅, #34 ✅, #36 ✅; **#35 ❌** (SEC-01); #22/#33 sebagian.
- ⚠️ `.env` kerja berisi `AUTH_DEV_BYPASS=true` + `BETTER_AUTH_URL` produksi (pagar kode benar; ini risiko konfigurasi operator).

## Perubahan berkas
- **Baru:** laporan audit + `src/lib/security/audit-2026-10-17.proof.test.ts`.
- **Diubah:** `docs/PETA-DOKUMEN.md` (pendaftaran #31), `docs/KEAMANAN.md` (register temuan §9b, koreksi status S1, checklist pra-produksi), dan laporan lama ditandai **DIGANTIKAN**.

**Yang belum dikerjakan (jujur):** tidak ada perbaikan kode, tidak menjalankan `pnpm build` penuh, dan tidak ada uji penetrasi jaringan nyata ke `b.iyo.my.id`. Urutan remediasi ada di §8 laporan.
