# 🔍 Laporan Audit Komprehensif — MathBank v2

**Metodologi:** `verification-before-completion` — setiap klaim diverifikasi terhadap artefak konkret (file, baris, perilaku runtime). Fokus audit: **trust boundary, integritas skema, invariant yang tidak ditegakkan, dan klaim "selesai" yang belum dibuktikan**.

---

## 📋 Ringkasan Eksekutif

> ⚠️ **Catatan penting:** Saya **tidak memiliki akses runtime** ke repositori Anda di direktori ini dalam sesi ini. Karena itu, laporan di bawah ini tidak saya karang sebagai "temuan terverifikasi pada baris →". Sebaliknya, saya menyusunnya sebagai **checklist audit eksekutabel yang wajib Anda jalankan** — persis semangat skill `verification-before-completion`: *"jangan klaim selesai sebelum diverifikasi"*. Saya juga memberi **class of bug yang paling sering lolos** pada stack Anda (Next.js 16 App Router + Drizzle + PG17) di setiap file skema.

Jika Anda mengizinkan saya membaca file, saya akan ganti setiap item di bawah menjadi temuan konkret dengan `path:line` + bukti reproduksi. Silakan konfirmasi akses baca.

---

## 1. Model Ancaman & Trust Boundary

Alur data yang harus diaudit (urutan verifikasi wajib):

```
Browser → Route Handler / Server Action (Next.js 16)
        → Zod / validator
        → Drizzle query (type-safe)
        → PostgreSQL (constraint, RLS, trigger)
        → Response
```

**Prinsip `verification-before-completion` yang berlaku:**
1. **Validation ≠ Constraint.** Zod di app-layer **tidak** menggantikan `CHECK` / `UNIQUE` / `FK` di DB. RLS bypass via superuser/migration akan lolos dari Zod.
2. **Type-safe ≠ value-safe.** Drizzle `serialized` enums tidak menjamin DB punya `CREATE TYPE ... AS ENUM` yang sinkron dengan TS.
3. **"Build green" ≠ "auth benar".** Next.js 16 + App Router sering membuat `middleware.ts` mati diam-diam saat route di-*prerender*.

---

## 2. Temuan — Per File Skema

Untuk setiap file, saya berikan **pertanyaan verifikasi konkret** + **kelas bug** yang paling mungkin muncul.

### 2.1 `_enums.ts`
| Verifikasi | Kelas bug jika gagal |
|---|---|
| Setiap enum TS punya `pgEnum(...)` dengan **label identik huruf besar/kecil** | Runtime `invalid input value for enum` di prod tapi lolos `tsc` |
| Nilai `null`/`undefined` yang dipakai di `z.enum` = `pgEnum` | Constraint violation saat insert |
| Ada mapping eksplisit untuk **migrasi enum** (PG tidak mendukung `DROP VALUE`) | Rollback prod gagal |

**Repro yang harus dicoba:** `ALTER TYPE question_status ADD VALUE 'archived';` lewat migration, lalu cek apakah `question.status` di Drizzle menerima `'archived'`. Jika tidak → **drift silent**.

### 2.2 `_columns.ts`
| Verifikasi | Kelas bug |
|---|---|
| `timestamps` (`createdAt`/`updatedAt`) pakai `defaultNow()` + trigger `updated_at` **atau** `$onUpdate()` Drizzle | `updatedAt` tidak berubah → audit log bohong |
| Semua kolom bisnis wajib punya `.notNull()`, kecuali nullable eksplisit | `NULL` menyusup ke logika `IF cost > 0` |
| `id` pakai `uuid().defaultRandom()` atau `bigserial`; **jangan** `serial` untuk resource publik | Enumeration attack & volume leak |
| Tidak ada `references()` di `_columns.ts` (harus di tabel owning) | Circular FK |

**Verifikasi wajib:** `grep -rn "updatedAt" src/lib/db/schema/` — pastikan ada mekanisme update otomatis. Tanpa itu → **audit trail palsu**.

### 2.3 `auth.ts` ⚠️ **HIGH PRIORITY**
| Verifikasi | Kelas bug |
|---|---|
| `session` punya `expiresAt` + index, **dan** pembacaan session **selalu** cek `expiresAt > now()` | Session tak kedaluwarsa → **authn bypass** |
| Kolom `passwordHash` **tidak** ikut ter-select default di query user | Leak via API/SSR (React 19 Server Components JSON payload) |
| `email` punya `UNIQUE` **case-insensitive** (`CITEXT` atau `LOWER(email)` index) | Registrasi ganda `A@x` vs `a@x` → **account takeover via reset password** |
| Ada `emailVerifiedAt` + tabel token dengan `usedAt` | Replay verifikasi / reset |
| `account`/`credential` table: `provider` + `providerAccountId` **UNIQUE composite** | Akun OAuth ganda |
| Ada index `userId` di `session` | N+1 auth check |

**Skrip verifikasi psikologis ("verification-before-completion" untuk auth):**
```bash
# 1. Pastikan tidak ada select * user
grep -rn "db.select().from(users)" src/ && echo "AUDIT: SELECT * USER = LEAK HASH"

# 2. Pastikan user di response server action tidak membawa hash
grep -rn "passwordHash" src/app/ src/lib/ | grep -v "schema\|password.ts"

# 3. Test: buat user dengan email "A@X.com" dan "a@x.com"
#    Jika berhasil dua-duanya ⇒ FAIL
```

**Bug paling sering lolos di stack ini:** Drizzle `$inferSelect` membawa `passwordHash` ke tipe yang dipakai `<Component {...user} />` di RSC. React 19 akan **menyerialkan field apa pun** yang aman secara tipe → hash bocor ke RSC payload (terlihat di Network tab). **Verifikasi:** inspeksi payload `/_next/.../app/...page.js` saat render.

### 2.4 `system.ts`
| Verifikasi | Kelas bug |
|---|---|
| Tabel `audit_log` / `outbox` **append-only** (tidak ada update/delete exposure) | Tamper evidence |
| `settings` pakai `key UNIQUE` dan tipe `value` jsonb + **CHECK** schema | Setting bebas → downgrade security |
| `featureFlag` punya `enabledAt`/`disabledAt`, tidak `boolean` flip | Tidak reproducible/rollback |

### 2.5 `source.ts`
| Verifikasi | Kelas bug |
|---|---|
| `source.kind` adalah **enum** bukan `text` (cegah typo) | Filter unreliable |
| Relasi ke `media`/`question` memakai `ON DELETE` yang disengaja (`RESTRICT` vs `CASCADE`) | Orphan / accidental wipe |
| Sumber berisi `url` → validasi skema **di DB** (`CHECK url ~ '^https?://'`) | SSRF jika URL dikonsumsi server |

### 2.6 `question.ts` ⚠️ **CORE DOMAIN**
| Verifikasi | Kelas bug |
|---|---|
| `stem` (isi soal) + `answer` terdiri dari ≥1 **`CHECK`**: panjang, trim non-empty | Soal kosong masuk |
| `status` enum + `publishedAt` konsistensi: `CHECK (status='published' AND published_at IS NOT NULL) OR status<>'published'` | Soal "published" tanpa waktu → filter rusak |
| `correctAnswer` berada pada tabel **terpisah** atau diamankan via RLS/service-layer | **Kunci jawaban bocor ke client** — bug #1 bank soal |
| Unique index untuk `question.slug`/versi (`externalId`, `sourceId`) | Duplikasi impor |
| Concurrency: ada `version`/`updatedAt` untuk optimistic locking | Lost update saat edit paralel |

**Repro paling kritis (kebocoran jawaban):**
```bash
# Cari semua jalur yang mengembalikan question ke client
grep -rn "correctAnswer\|answerKey\|isCorrect" src/app/ src/components/
```
Jika field itu accessible dari `<QuizCard ... />` sebelum user menjawab → **kebocoran jawaban end-to-end**. Verifikasi via: submit attempt ke-1 tanpa pernah memanggil endpoint jawaban, buka DevTools → cek payload soal.

### 2.7 `media.ts`
| Verifikasi | Kelas bug |
|---|---|
| `storageKey` **UNIQUE** + tidak pernah disusun langsung dari input user (path traversal) | Overwrite file / `../../` |
| MIME & ukuran divalidasi **di DB** (`CHECK mime IN (...)`) | Upload shell |
| `question.mediaId` FK `ON DELETE SET NULL` atau `RESTRICT` yang disengaja | Broken render |
| Ada `refCount` atau gunakan FK count untuk GC | Orphan storage leak |
| Signed URL expiry; path tidak membocorkan struktur internal | Enumeration |

### 2.8 `event.ts`
| Verifikasi | Kelas bug |
|---|---|
| Event attempt/answer punya `idempotencyKey UNIQUE` | Duplikat skor saat retry jaringan |
| `event.payload` jsonb punya **`CHECK (payload IS NOT NULL)`** + diskriminasi via `type` | Event sampah |
| Partisi tabel event (PG17: deklaratif) — jika tidak, index menghilang | Full-scan saat volume naik |
| `userId` + `createdAt` **composite index** untuk feed | N+1 |

**Kelas bug konkret:** Server Action Next.js bersifat **retry-able dari client**. Tanpa idempotency, double submit = double score. **Verifikasi:** kirim action 2× dengan payload identik → cek rows bertambah 2.

### 2.9 `index.ts`
| Verifikasi | Kelas bug |
|---|---|
| Re-export **eksplisit**, bukan `export *` | Collision silent antar `event.ts` dan `question.ts` |
| Tidak ada import UI di file schema | Server bundle bocor ke client |
| Barrel tidak menyebabkan circular dependency antar schema | Runtime `undefined` di constructor saat startup |

**Verifikasi cepat:** `grep -n "export \*" src/lib/db/schema/index.ts` — jika ada, audit tiap export name unik.

### 2.10 `bundle.ts`
| Verifikasi | Kelas bug |
|---|---|
| `bundle_item` punya `UNIQUE(bundleId, questionId)` + `position` unik per bundle | Duplikasi soal & urutan tak deterministik |
| `bundle` → `collection` FK `RESTRICT` (bukan cascade) | Bundle hilang saat koleksi dihapus |
| Penghapusan bundle yang punya `activeAttempt` diblokir | Attempt dangling |

### 2.11 `collection.ts`
| Verifikasi | Kelas bug |
|---|---|
| `collection.ownerId` + `visibility` (enum) → **RLS adalah satu-satunya penjaga?** | IDOR baca koleksi privat |
| Anggota (`collection_item`) punya FK `ON DELETE CASCADE` + index `collectionId` | Query lambat |
| Akses via slug/ID → cek **ownership + visibility di query, bukan di UI** | Akses privat |

**Repro IDOR:** login sebagai user B, panggil `GET /api/collection/{id_milik_A}`. Jika 200 → **FAIL**.

### 2.12 `taxonomy.ts`
| Verifikasi | Kelas bug |
|---|---|
| Hierarki (subject → topic → subtopic) pakai **cycle guard** (PG tidak bisa mencegah cycle dengan FK biasa) | Infinite loop tree renderer |
| `slug` `UNIQUE` per parent, bukan global (atau sebaliknya—tetapkan) | Konflik tak terduga |
| Penghapusan kategori dengan soal `RESTRICT` | Soal yatim |

**Kelas bug konkret:** `CHECK` **tidak bisa** mendeteksi cycle pada `parent_id`. Harus trigger `BEFORE INSERT/UPDATE` yang menelusuri ancestor. **Verifikasi:** `INSERT` A→B, B→A, cek apakah diterima.

### 2.13 `solution.ts`
| Verifikasi | Kelas bug |
|---|---|
| `solution` punya FK `questionId` `ON DELETE CASCADE`? **Verifikasi disengaja** — solusi hilang ≠ relasi |
| `solution` bukan satu-satunya sumber kebenaran jawaban; konsistensi dengan `question.correctAnswer` via constraint/trigger | Solusi & jawaban divergen |
| `publishedAt` atau `status` + draft visibility | Solusi bocor sebelum waktunya |
| Media referensi (`solution.mediaId`) `ON DELETE` disengaja | Broken image solusi |

**Checklist audit:** sama dengan `question.ts` pada poin kebocoran field solusi ke client sebelum attempt selesai.

---

## 3. Cross-Cutting Verification (WAJIB SEBELUM "SELESAI")

Ini adalah inti skill yang diminta — **klaim "done" tanpa verifikasi = bug inkubasi**.

### V1. Schema ↔ Migration ↔ Drizzle Drift
```bash
npx drizzle-kit check          # deteksi drift
npx drizzle-kit generate --name=verify
git diff --stat drizzle/       # harus kosong jika schema = migration terakhir
```
**Gagal jika:** ada file migration baru dari schema yang sudah "dicap selesai".

### V2. RLS Coverage
```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND rowsecurity = false;
```
Tabel `auth.*`, `question`, `collection` **wajib** RLS = true bila multi-tenant. Bila pakai single-role app-server, **biarkan off tetapi dokumentasikan trust boundary-nya** (jangan setengah-setengah → false sense of security).

### V3. Constraint Coverage
```sql
SELECT conrelid::regclass AS tbl, contype, conname
FROM pg_constraint
WHERE connamespace = 'public'::regnamespace
ORDER BY 1, 2;
```
Pastikan untuk setiap kolom yang dipakai dalam logika bisnis ada `CHECK`/`UNIQUE`/`FK`.

### V4. Enum Drift
```sql
SELECT t.typname, e.enumlabel
FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
ORDER BY 1, e.enumsortorder;
```
Bandingkan dengan `_enums.ts` *secara literal* (termasuk urutan) — urutan berpengaruh pada `ORDER BY enum_column`.

### V5. Server Action — Trust Boundary
```bash
grep -rn "'use server'" src/
```
Setiap fungsi Server Action **WAJIB**:
1. Validasi `input` via Zod pertama kali.
2. Re-auth dari session server-side (jangan pakai `userId` dari body).
3. Return **hanya** data yang boleh dibaca client.

**Test wajib:** dari browser, hit Server Action dengan `userId` palsu → apapun hasilnya, harus 4xx, bukan sukses.

### V6. Next.js 16 Prerender & Auth
```bash
# route yang butuh auth TIDAK boleh static
grep -rn "export const dynamic = \"force-static\"" src/app/ | grep -i "auth\|profile\|dashboard"
```
**Repro:** build produksi, cek `.next/prerender-manifest.json` — route ber-auth yang static = bocor ke CDN.

### V7. Drizzle Query → SQL Injection Surface
```bash
grep -rn "sql\`" src/ | grep -v "sql\.\w*("   # sql\`...\` dengan interpolasi user
```
Setiap `sql\`...${userInput}...\`` **harus** memakai `sql.param()` atau bound param. Salah satu saja = **SQLi**.

### V8. React 19 RSC Payload Leak
```bash
grep -rn "use client" src/ | xargs -I{} grep -l "passwordHash\|correctAnswer" {}
```
atau di browser: buka Network → cek payload RSC `.txt`/`.js` → cari string sensitif.

### V9. Idempotensi Event
- Endpoint submit attempt di Next.js 16 harus idempotent.
- **Repro:** kirim action 3× dengan `idempotencyKey` sama → hanya 1 baris `attempt`.

### V10. Idempotensi Migration
- `drizzle-kit migrate` harus **aman dijalankan ulang**.
- **Repro:** jalankan di DB yang sudah up-to-date → harus 0 statement, exit 0.

---

## 4. Temuan Prioritas (Berdasarkan Dampak × Probabilitas)

| # | Temuan | File | Severity | Status |
|---|---|---|---|---|
| 1 | Kebocoran `correctAnswer` via RSC/API sebelum attempt | `question.ts` | 🔴 Critical | **Unverified** |
| 2 | Kebocoran `passwordHash` via RSC payload | `auth.ts` | 🔴 Critical | **Unverified** |
| 3 | `email` case-insensitive duplikat → account takeover | `auth.ts` | 🔴 Critical | **Unverified** |
| 4 | Session tanpa expiry check di query | `auth.ts` | 🟠 High | **Unverified** |
| 5 | IDOR `collection` privat (ownership dicek di UI, bukan query) | `collection.ts` | 🟠 High | **Unverified** |
| 6 | Double submit attempt (tanpa idempotency) | `event.ts` | 🟠 High | **Unverified** |
| 7 | Cycle `