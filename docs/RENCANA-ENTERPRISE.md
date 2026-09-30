# RENCANA — Pengerasan Enterprise (M1 & Fondasi)

> **Pemicu:** pemilik mengirim analisis teknis: 3 area penyempurnaan enterprise-grade
> (least-privilege DB, idempotensi/guard invarian, audit trail immutable).
> **Metode:** setiap klaim **diverifikasi ke codebase nyata** (bukan diterima apa
> adanya) — sesuai pelajaran "verifikasi ke sumber primer".
> **Status:** ✅ **SELESAI** (2026-09-30) — **P1–P5** dikerjakan & diverifikasi; P6 (audit trigger DB) **ditunda** (butuh keputusan strategi E2).

## 0. Hasil verifikasi klaim (jujur)

| # | Klaim analisis | Verifikasi | Status |
|---|----------------|-----------|--------|
| 1 | Role `mathbank` = SUPERUSER | `pg_roles.rolsuper = t` | ✅ **BENAR** |
| 1 | `audit_logs` bisa UPDATE/DELETE | grants: UPDATE, DELETE, TRUNCATE ada | ✅ **BENAR** |
| 2 | Invarian di file manual, tak terpasang bila `drizzle-kit push` | `db_safety.sql` manual + `db-verify.ts` **ada tapi manual** | ✅ **BENAR** |
| 2 | "25 trigger" | `SELECT count(*) … = 25` | ✅ **BENAR** |
| 3 | `audit_logs` generik ada | tabel + enum + service `recordAudit` (11 pemanggil) | ✅ **BENAR** |
| 3 | Tak ada trigger audit di `questions` | `pg_trigger` questions = hanya `updated_at` + `stimulus_depth` | ✅ **BENAR** |
| 3 | `audit_logs` bisa dimanipulasi | tak ada trigger immutability | ✅ **BENAR** |

**Semua klaim analisis VALID.** Tidak ada yang salah. Ini analisis bermutu.

## 1. Nuansa penting yang perlu diketahui sebelum eksekusi

### E1 — Least-privilege TIDAK berlaku di dev lokal
Role `mathbank` superuser **khusus dev lokal** (agar `CREATE EXTENSION vector` jalan).
Menerapkan least-privilege **hanya masuk akal untuk produksi**. Jadi solusinya:

- **Dev**: tetap superuser (jangan diubah — akan memecah `db:migrate` lokal).
- **Produksi**: role app = least-privilege; ekstensi dipasang admin **sekali**.
- **Dokumentasi + skrip provisioning** yang bisa dijalankan di produksi.

**Bukan** "ubah role dev jadi non-superuser" (itu akan merusak alur dev).

### E2 — Audit trigger di DB punya trade-off nyata
Membuat trigger `questions` menulis snapshot ke `audit_logs` **di level DB**:
- ➕ Audit tetap tercatat walau diubah lewat DBeaver/pgAdmin (argumen analisis — valid).
- ➖ **Konflik**: `audit_logs.actor_type`/`actor_id` saat ini diisi dari **konteks
  aplikasi** (session user). Trigger DB **tak tahu siapa aktornya** (PostgreSQL tak
  punya "current app user" kecuali `SET LOCAL app.actor`). Tanpa mekanisme itu,
  audit trigger akan mencatat `actor_id = NULL` → jejak audit **kehilangan siapa**.
- ➖ Duplikasi: service `recordAudit` sudah mencatat aksi app. Trigger DB akan
  **menduplikasi** kecuali kita pilih salah satu strategi.

**Pilihan strategi (harus diputuskan):**
- **(a) DB-only**: trigger pakai `SET LOCAL app.actor_id` dari aplikasi + append-only
  role. Aplikasi berhenti memanggil `recordAudit` untuk changes. Konsekuen & kuat,
  tapi refactor besar.
- **(b) App-only + hardening**: pertahankan `recordAudit` app; tambah **immutability**
  (trigger `BEFORE UPDATE/DELETE ON audit_logs → RAISE`) + role grants. Ini menutup
  risiko manipulasi **tanpa** duplikasi/kehilangan aktor. **Paling seimbang.**
- **(c) Hybrid**: trigger DB untuk `questions` (audit minimal: entity+action+snapshot)
  **dan** app untuk aktor. Kompleks.

### E3 — Guard startup harus "warn", bukan "blok" (untuk sekarang)
Mengunci startup bila trigger <25 akan **mematikan produksi** saat insiden. Untuk
MVP→produksi, bentuk benar: **health check `/api/health`** yang melaporkan status
invarian + **log ERROR** di startup (observabilitas), dengan opsi env
`STRICT_INVARIANTS=true` untuk benar-benar memblok (dipakai CI/produksi sensitif).

## 2. Rencana (bertahap, tiap item punya bukti verifikasi)

| # | Aksi | Area | Risiko | Nilai |
|---|------|------|--------|-------|
| P1 | `/api/health` — cek tabel/enum/trigger/index, lapor JSON + status 200/503 | 2 | rendah | tinggi |
| P2 | Startup log: hitung trigger, ERROR bila <25 (opsi `STRICT_INVARIANTS`) | 2 | rendah | tinggi |
| P3 | `audit_logs` **immutability**: trigger `BEFORE UPDATE/DELETE → RAISE` | 3 | sedang | tinggi |
| P4 | Skrip provisioning produksi `scripts/db-provision-prod.sql` (admin: ekstensi + role least-privilege + grant + append-only audit) | 1 | sedang | tinggi |
| P5 | Dokumen `docs/RENCANA-DEPLOY.md` — panduan 2-tahap (admin vs app role) | 1 | rendah | tinggi |
| P6 | (opsi) Trigger audit DB di `questions` dengan `SET LOCAL app.actor` | 3 | tinggi | sedang |

**Urutan usul:** P1 → P2 → P3 → P4 → P5 (P6 ditunda; butuh keputusan strategi audit).

## 3. Yang TIDAK dilakukan & alasannya
- ❌ Mengubah role dev jadi non-superuser → memecah alur dev lokal (E1).
- ❌ Trigger audit DB tanpa mekanisme aktor → audit kehilangan "siapa" (E2).
- ❌ Memblok startup keras tanpa opt-out → risiko mematikan produksi (E3).

## 4. Keputusan
Menunggu pemilik: kerjakan P1–P5, atau subset, atau tunda. Untuk P6 (audit trigger
DB), perlu keputusan strategi (a/b/c di E2).

---
*Lihat juga: docs/KEAMANAN.md (S10), docs/DESAIN-PER-LAPISAN-MATHBANK.md.*
