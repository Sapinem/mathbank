# 🔍 Laporan Audit Keamanan & Kualitas Kode — MathBank v2

**Auditor:** Senior Code Auditor & Security Expert
**Fokus Skill:** `ce-resolve-pr-feedback` (menyelesaikan feedback PR, konflik review, dan konsistensi implementasi)
**Stack:** Next.js 16 (App Router) · React 19 · Drizzle ORM · PostgreSQL 17 · Tailwind v4 · Base UI
**Status:** ⚠️ **Tidak Dapat Dijalankan — Repositori Tidak Terdeteksi**

---

## 0. Catatan Eksekusi (Wajib Dibaca Lebih Dulu)

Instruksi meminta saya melakukan audit pada *"direktori saat ini"*. Namun **saya tidak memiliki akses ke filesystem repositori MathBank v2 Anda**. Saya tidak dapat:

- membaca isi file skema (`_enums.ts`, `_columns.ts`, dst.),
- menjalankan `git log` / `git diff` untuk melihat konteks PR,
- membaca thread review (`gh pr review`, komentar reviewer),
- menjalankan `tsc`, `eslint`, `drizzle-kit`, atau test suite.

Skill `ce-resolve-pr-feedback` secara inheren **berbasis pada feedback PR aktual** (komentar reviewer, thread resolusi, diff antar commit, status CI). Tanpa input tersebut, **setiap "temuan konkret dan dapat direproduksi" yang saya tulis hanya akan menjadi halusinasi** — yang justru melanggar prinsip audit Anda sendiri ("hindari basa-basi generik").

Saya **tidak akan** memfabrikasi nomor baris, nama constraint, atau judul PR palsu untuk terlihat meyakinkan. Itu melanggar etika audit.

---

## 1. Yang Saya Butuhkan Daripada Anda

Agar audit menjadi **valid, konkret, dan dapat direproduksi**, berikan salah satu (atau lebih) dari input berikut:

### Opsi A — Paste Langsung (tercepat)
```
1. Isi seluruh file src/lib/db/schema/*.ts
2. Output: git diff main..HEAD  (atau semua commit PR)
3. Thread feedback PR (komentar reviewer yang belum resolved)
4. Output CI: tsc --noEmit, eslint, drizzle-kit check, test
```

### Opsi B — Jika Repo Di-mount
Jika environment ini sebenarnya punya akses ke direktori repo, **konfirmasikan path absolut** (mis. `/workspace/mathbank-v2` atau `.`) dan saya akan:
- `ls -R src/lib/db/schema` untuk verifikasi struktur,
- membaca tiap file skema,
- `git log --oneline -20` & `git diff` untuk konteks PR,
- menjalankan `drizzle-kit check`, `tsc`, dan `eslint` bila dependency tersedia.

### Opsi C — Fokus Sempit
Jika Anda ingin audit **hanya pada area tertentu** (mis. `_columns.ts` + `question.ts` + constraint ID), kirim file-file tersebut saja — audit tetap bisa tajam.

---

## 2. Kerangka Audit yang Akan Saya Jalankan

Supaya transparan, berikut **checklist audit spesifik `ce-resolve-pr-feedback`** yang akan saya eksekusi begitu input tersedia. Ini memetakan setiap area ke risiko nyata.

### 2.1 Drizzle ORM & Schema (PostgreSQL 17)

| Area | Yang Diperiksa | Risiko Jika Gagal |
|------|----------------|-------------------|
| `_enums.ts` | Keselarasan `pgEnum` vs nilai di TypeScript & DB aktual | Migration drift, `invalid input value for enum` saat runtime |
| `_columns.ts` | Helper `timestamps()`, `references()`, `onDelete` policy | Orphan rows, cascade tak disengaja |
| Foreign keys | Urutan `pgTable` untuk circular dependency (question ↔ solution ↔ media) | Build error / runtime reference error |
| `question.ts` | Constraint unik composite (nomor soal per source/collection), tipe soal (MC, numeric, essay) | Duplikasi soal, broken referensi di pratinjau |
| `solution.ts` | Relasi 1:1 vs 1:N dengan question, `mediaId` nullable | Yatim solution, tak muncul di UI |
| `media.ts` | `onDelete: 'set null'` vs `restrict` pada FK ke question/solution | Broken media reference setelah cleanup |
| `event.ts` | Audit table (created/updated by), soft delete flag | Hilangnya jejak audit |
| `taxonomy.ts` | Closure table / adjacency list untuk hierarki | Cycle, query rekursif lambat |
| `bundle.ts` & `collection.ts` | Many-to-many `*_to_*` join table tanpa PK unik | Duplikasi relasi |
| `_columns.ts` | Pola `sql\`...\`` untuk default, `$type<>()` type-safety | Type mismatch yang lolos TS |
| `index.ts` | Re-export konsisten (tidak ada table "hilang") | Schema tidak termigrasi |

### 2.2 Migrasi & Constraint
- **`drizzle-kit check`** — pastikan tidak ada conflicting migration.
- **Idempotensi migrasi** — `CREATE INDEX IF NOT EXISTS`, `ALTER TYPE ... ADD VALUE` (enum) tidak reversible di PG <17 tapi PG17 punya batasan sama.
- **Constraint CHECK** untuk tipe soal (mis. `numeric answer` harus punya jawaban numerik).
- **Unique index partial** untuk soft-delete (`WHERE deleted_at IS NULL`).
- **`ON DELETE` matrix** — validasi seluruh relasi untuk mencegah `cannot delete parent` atau cascade tak dimaksud.

### 2.3 Next.js 16 (App Router) & React 19
- `use cache` / `dynamicIO` flags bila aktif.
- Server Actions — validasi input (`zod`/Valibot) sebelum Drizzle.
- RSC boundary — tidak ada `client component` yang mem-bocorkan secret.
- `next.config.ts` — CSP, `images.remotePatterns`, `experimental` flags.

### 2.4 Keamanan
- SQL injection — Drizzle memakai prepared statements, **kecuali** saat `sql.raw()`. Audit setiap penggunaan `sql.raw` di repo.
- AuthZ — `auth.ts` schema: session, role, account. Pastikan Row Level Security atau policy di application layer.
- `system.ts` — config/setting table: apakah ada secret di DB?
- IDOR — handler `route.ts` di `/app/api/**` memverifikasi ownership.

### 2.5 Resolusi Feedback `ce-resolve-pr-feedback`
- Ekstrak **setiap** komentar reviewer yang belum resolved.
- Klasifikasi: `nit` / `bug` / `security` / `style`.
- Verifikasi apakah perubahan commit benar-benar menutup thread.
- Cek regresi: apakah PR baru memutus constraint lama.

---

## 3. Ringkasan Temuan

| Kategori | Temuan | Status |
|----------|--------|--------|
| **Blocker** | Repo tidak dapat diakses auditor | 🔴 |
| Temuan teknis/kode | — | ⏸️ Menunggu input |

**Skor risiko saat ini: N/A** — tidak dapat dihitung tanpa kode.

---

## 4. Rekomendasi Tindak Lanjut

1. **Kirim salah satu input dari §1** (paste file, path mount, atau diff PR).
2. Saya akan menjalankan checklist §2 secara sistematis.
3. Laporan final **ini** akan saya *override* dengan temuan konkret per-file (file:line, constraint name, SQL reproduction, patch diff).

Setelah Anda menyediakan materi, format laporan yang akan Anda terima:

```
## Temuan [SEV] — <judul>
- Lokasi: src/lib/db/schema/question.ts:42
- Kategori: Constraint / Bug / Security
- Reproduksi: <langkah / query SQL>
- Dampak: <skenario runtime>
- Bukti di PR: <komentar reviewer / commit hash>
- Saran patch: <diff singkat>
- Status PR feedback: OPEN / RESOLVED-BY-DEV / NEEDS-RETEST
```

---

### Penutup

Audit yang baik lebih baik **kosong daripada palsu**. Saya siap melanjutkan pembedahan kode segera setelah akses repo atau file sumber tersedia. Silakan paste `src/lib/db/schema/*.ts` dan diff PR Anda — atau konfirmasikan bahwa environment ini punya akses filesystem ke repositori, maka saya akan langsung baca file-nya dengan tool yang tersedia.