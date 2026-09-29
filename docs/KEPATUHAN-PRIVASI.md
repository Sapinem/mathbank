# KEPATUHAN-PRIVASI.md — Kepatuhan Data Pribadi & Privasi

> **Status:** 📝 rencana (fondasi; belum ada data pengguna nyata per 2026-09-29).
> **Regulasi acuan:** **UU PDP No. 27/2022** (Indonesia) + prinsip **GDPR** bila ada pengguna EU.
> **Sifat:** dokumen hidup — ratifikasi & lengkapi sebelum produksi.
> **Prinsip:** minimalkan data; jangan simpan yang tak perlu.

---

## 1. Data Pribadi yang Disimpan (nyata, dari skema)

| Tabel | Data pribadi | Sensitivitas | Tujuan |
|-------|-------------|:------------:|--------|
| `user` | `name`, `email`, `image` | 🟠 sedang | identitas akun |
| `session` | **`ip_address`, `user_agent`** | 🟠 sedang | keamanan sesi (deteksi anomali) |
| `account` | `password` (hash), `access_token`, `refresh_token`, `id_token` | 🔴 tinggi | kredensial |
| `apikey` | `key` (hash), `metadata` | 🔴 tinggi | kredensial agen/mesin |
| `audit_logs` | `actor_id`, `diff_payload` | 🟠 sedang | jejak audit (siapa ubah apa) |
| `app_settings` | `ai.api_key` (rahasia!) | 🔴 tinggi | konfigurasi AI |

**Catatan penting:**
- **Tidak** ada data siswa (nama siswa, nilai) — MathBank = bank soal, bukan LMS. *(Bila kelak ada, dokumen ini wajib diperluas.)*
- `ip_address` & `user_agent` = **data pribadi** (dapat mengidentifikasi) → masuk cakupan UU PDP.
- Password **di-hash** (bukan plaintext) — Better Auth pakai scrypt.
- `ai.api_key` di `app_settings` = **rahasia** — jangan pernah tampilkan ke klien.

---

## 2. Peran Sesuai UU PDP

| Peran | Siapa | Tanggung jawab |
|-------|-------|----------------|
| **Pengendali Data** (controller) | Operator MathBank (sekolah/institusi) | Menentukan tujuan pemrosesan |
| **Prosesor** (processor) | Tim teknis/host | Memproses atas perintah pengendali |
| **Subjek Data** (data subject) | guru, reviewer, admin (pengguna) | pemilik data pribadinya |

> Sekarang: pengendali = prosesor = satu pihak. Saat multi-institusi, **pemetaan peran wajib ditinjau**.

---

## 3. Hak Subjek Data (UU PDP)

| Hak | Cara memenuhi (rencana) |
|-----|-------------------------|
| **Akses** — tahu data apa disimpan | ekspor data akun (endpoint admin) |
| **Perbaikan** — koreksi data | halaman profil / kelola pengguna |
| **Penghapusan** — "hak dilupakan" | hapus akun → `user_roles` cascade; `audit_logs` **anonimkan** (bukan hapus — jejak audit) |
| **Penarikan persetujuan** | nonaktifkan akun |

> **Kendala teknis:** `audit_logs` sengaja **immutable** (jejak audit). Penghapusan akun → **anonimkan** `actor_id`/`diff_payload`, **jangan** hapus baris audit (integritas forensik).

---

## 4. Dasar Hukum Pemrosesan

| Data | Dasar |
|------|-------|
| Akun (nama, email) | **kontrak** (perlu untuk layanan) |
| IP/User-Agent | **kepentingan sah** (keamanan) |
| Audit log | **kewajiban**/kepentingan sah |
| Rahasia (kredensial) | kontrak + keamanan |

---

## 5. Retensi (usulan)

| Data | Retensi | Aksi pasca-retensi |
|------|---------|---------------------|
| `session` | sampai kedaluwarsa (`expires_at`) | hapus otomatis |
| `account` (token) | selama akun aktif | hapus saat akun dihapus |
| `audit_logs` | **2–3 tahun** (usulan) | anonimkan `actor_id`, pertahankan entitas |
| `user` (nonaktif) | sampai permintaan hapus | anonimkan/hapus |
| Backup | sesuai `BACKUP-RECOVERY.md` | rotasi |

> **Belum ada** pekerjaan pembersihan otomatis (cron) — utang.

---

## 6. Kontrol Teknis yang Sudah Ada

- ✅ Password **hash** (scrypt), bukan plaintext.
- ✅ Rahasia di ENV (bukan kode); `BETTER_AUTH_SECRET` wajib di produksi.
- ✅ Guard `KEAMANAN.md` (RBAC, `own`).
- ✅ API key **per-key** (bukan dibagikan).
- ✅ Audit log untuk mutasi.

---

## 7. Yang Belum Ada (utang)

- [ ] Kebijakan privasi tertulis (untuk pengguna)
- [ ] Persetujuan terdokumentasi (bila perlu)
- [ ] Endpoint ekspor/hapus data akun
- [ ] Anonimisasi `audit_logs` saat akun dihapus
- [ ] Pembersihan sesi kedaluwarsa (cron)
- [ ] Retensi terotomatisasi
- [ ] Catatan pemrosesan (record of processing)
- [ ] DPA (perjanjian pemrosesan) bila multi-institusi
- [ ] Prosedur pelanggaran data (72 jam notifikasi) → lihat `KEAMANAN.md` §Respons Insiden

---

## 8. Pelanggaran Data (notifikasi)

Bila ada kebocoran data pribadi:
1. Isolasi & hentikan (lihat `KEAMANAN.md` §Respons Insiden).
2. Nilai dampak.
3. **Notifikasi otoritas & subjek data** dalam **≤ 72 jam** (UU PDP).
4. Catat & analisis akar masalah.

---

## 9. Rujukan

- Keamanan: `KEAMANAN.md`
- Skema: `SKEMA-DB-DETAIL.md`
- Backup: `BACKUP-RECOVERY.md`
- Riset Better Auth (CVE, kredensial): `RISET-BETTER-AUTH.md`
