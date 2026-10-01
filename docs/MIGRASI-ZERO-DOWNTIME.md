# MIGRASI-ZERO-DOWNTIME.md — Prosedur Migrasi Skema (M16)

> **Tujuan:** mengubah skema DB produksi **tanpa downtime** dan dengan **rollback
> yang teruji**. Prinsip: perpindahan bertahap **expand → migrate → contract**.
> **Rujukan:** `RENCANA-DEPLOY.md` §5, `BACKUP-RECOVERY.md`, `SKEMA-DB-DETAIL.md`.

---

## 1. Aturan wajib

1. **Selalu** `pnpm db:migrate` + `pnpm db:verify`. **Jangan** `db:push` di produksi.
2. **Backup sebelum migrasi** (`pnpm backup:db`) — migrasi bersifat *forward-only*;
   satu-satunya rollback data = pulihkan backup.
3. Migrasi yang **merusak (destruktif)** DILARANG digabung dengan rilis kode.
   Pisah jadi beberapa deploy (expand dulu, contract belakangan).
4. SQL tulis-tangan krusial → `drizzle/manual/` (idempotent), dijalankan via
   `pnpm db:safety` (otomatis dari `db:migrate`). Lihat `CONSTRAINTS #26`.

---

## 2. Pola Expand → Migrate → Contract

Agar **versi lama & baru** kode bisa hidup bersama selama rilis bergulir:

| Tahap | Deploy | Yang dilakukan | Aman untuk kode lama? |
|---|---|---|---|
| **Expand** | #1 | Tambah kolom/tabel **nullable**, index **CONCURRENTLY**, nilai default longgar | ✅ ya (kode lama abaikan kolom baru) |
| **Migrate** | #2 | Backfill data (batch), kode mulai **tulis** ke kolom baru & **baca** dari keduanya | ✅ ya (dual-read/dual-write) |
| **Contract** | #3 | Buang kolom/constraint lama, jadikan `NOT NULL`, hapus jalur lama | ✅ ya (kode lama sudah pensiun) |

**Jangan** dalam satu langkah: `ADD COLUMN … NOT NULL` tanpa default ke tabel
besar (mengunci tulis), `DROP COLUMN` sebelum kode berhenti memakainya, atau
`CREATE INDEX` tanpa `CONCURRENTLY` (memblokir tulis).

---

## 3. Contoh aman per operasi

```sql
-- Tambah kolom baru (expand): nullable dulu, tanpa rewrite besar.
ALTER TABLE questions ADD COLUMN IF NOT EXISTS ai_tagged_at timestamptz;

-- Index tanpa mengunci tabel.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_questions_ai_tagged
  ON questions (ai_tagged_at);

-- Backfill batch (hindari transaksi raksasa) — jalankan di luar jam sibuk.
UPDATE questions SET ai_tagged_at = updated_at
  WHERE ai_tagged_at IS NULL AND id IN (SELECT id FROM questions WHERE ai_tagged_at IS NULL LIMIT 5000);

-- Contract (deploy terpisah, setelah kode lama pensiun):
-- ALTER TABLE questions ALTER COLUMN ai_tagged_at SET NOT NULL;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_lama;
```

> **Catatan pgvector/HNSW:** buat index HNSW **setelah** backfill embedding,
> bukan sebelum — hindari biaya indeks ulang tiap baris.

---

## 4. Prosedur rilis (produksi systemd)

```bash
cd ~/projects/mathbank

# 0) BACKUP dulu — wajib.
pnpm backup:db

# 1) Hentikan app (systemd) — cegah kode lama menulis saat skema berubah.
systemctl --user stop mathbank.service

# 2) Migrasi + verifikasi invarian.
pnpm db:migrate                # skema (drizzle) + safety SQL (drizzle/manual)
pnpm db:verify                 # WAJIB hijau: tabel/CHECK/HNSW/trigger/uuidv7

# 3) Build & nyalakan.
git checkout <tag/commit>
pnpm install --frozen-lockfile
rm -rf .next && pnpm build
systemctl --user start mathbank.service

# 4) Verifikasi.
curl -s localhost:1234/api/health | jq      # 200
curl -s localhost:1234/api/ready  | jq      # status: ready
```

> Downtime di sini singkat (beberapa detik–menit saat stop→start). Untuk
> **benar-benar nol** downtime dengan dua instance bergulir, pakai pola
> expand→migrate→contract (§2) sehingga app lama & baru hidup di skema yang sama,
> lalu rilis bergulir (blue-green) di balik reverse-proxy.

---

## 5. Rollback

| Skenario | Tindakan |
|---|---|
| Kode baru bermasalah, skema **kompatibel** | `git checkout` commit lama → build → start (§4 langkah 3–4) |
| Skema berubah **merusak** data | **Pulihkan backup**: `pnpm restore:check <dump>` untuk uji, lalu restore ke DB produksi |
| Migrasi gagal di tengah | Perbaiki migrasi (buat migrasi kompensasi), JANGAN edit migrasi yang sudah diterapkan |

Migrasi **tak boleh** diedit setelah diterapkan (checksum drizzle-kit). Perbaikan
= migrasi baru. Simpan riwayat di `drizzle/`.

---

## 6. Uji migrasi (wajib sebelum rilis berisiko)

1. Pulihkan backup terbaru ke DB sementara (`pnpm restore:check`).
2. Jalankan migrasi terhadap DB sementara itu (`DATABASE_URL=<tmp> pnpm db:migrate`).
3. `pnpm db:verify` harus hijau.
4. Ukur waktu & catat (perkirakan durasi di produksi).
5. Baru jalankan di produksi.

---

## 7. Rujukan

- Deploy: `RENCANA-DEPLOY.md`
- Backup/restore: `BACKUP-RECOVERY.md`
- Detail skema & invarian: `SKEMA-DB-DETAIL.md`
- Operasi harian: `RUNBOOK.md`
