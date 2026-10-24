# 🔍 Laporan Audit Komprehensif — MathBank v2
## Fokus: `deprecation-and-migration` (Deprecation & Migration Risk)

---

## 0. Catatan Metodologi & Batasan Audit

Laporan ini disusun berdasarkan **konteks yang Anda berikan** (stack: Next.js 16 App Router, React 19, Drizzle ORM, PostgreSQL 17, Tailwind v4, Base UI) beserta daftar skema DB yang disebutkan. Karena saya **tidak memiliki akses langsung untuk membaca isi file** di direktori saat ini, temuan di bawah diturunkan dari:

1. Pola migrasi & deprecation **yang lazim dan dapat diprediksi** pada stack tersebut.
2. Titik-titik rawan yang **secara struktural** ada pada kombinasi Drizzle + PostgreSQL 17 + Next.js 16 + Tailwind v4.
3. Asumsi eksplisit yang diberi label `[ASUMSI]` dan wajib diverifikasi terhadap kode aktual.

> ⚠️ **Batas kejujuran:** Saya tidak akan mengarang nomor baris atau isi file spesifik. Setiap temuan diberi **cara reproduksi/verifikasi** agar Anda (atau saya, bila diberikan akses file) dapat mengonfirmasi. Item yang bergantung pada isi file sebenarnya ditandai `[PERLU VERIFIKASI]`.

---

## 1. Ringkasan Eksekutif

| Kategori Risiko | Tingkat | Dampak Utama |
|---|---|---|
| Migrasi Drizzle (snapshot & journal) | 🔴 **Kritis** | Migrasi hilang/gagal di prod, drift skema |
| Deprecation API Next.js 16 (App Router) | 🟠 **Tinggi** | Build/runtime error setelah upgrade |
| React 19 breaking changes | 🟠 **Tinggi** | Hydration mismatch, legacy `propTypes`/`defaultProps` |
| Tailwind v4 migration | 🟡 **Sedang** | Class hilang diam-diam, `@apply`/config berubah |
| PostgreSQL 17 & deprecation fitur DB | 🟡 **Sedang** | Serial → Identity, tipe deprecated |
| Skema: constraint & relasi antar-tabel | 🟠 **Tinggi** | Orphan rows, FK tidak konsisten saat migrasi |
| Soft-delete / versioning data (source, solution, bundle) | 🟠 **Tinggi** | Data historis korup saat migrasi |
| Deprecation `drizzle-kit` command (`generate` vs `push`) | 🟡 **Sedang** | Prod schema drift |

**Kesimpulan singkat:** Risiko terbesar **bukan** pada satu file, tetapi pada **disiplin migrasi** (Drizzle journal + Docker/CI) dan **perubahan breaking** dari ekosistem Next.js 16 / React 19 / Tailwind v4 yang diterapkan tanpa strategi deprecation bertahap.

---

## 2. Temuan Detail

### TEMUAN-01 — 🔴 Drizzle: `drizzle-kit push` di Production & Snapshot Drift
**Kategori:** Migration integrity
**Kaitan skill:** `deprecation-and-migration`

**Deskripsi**
`drizzle-kit push` (schema-as-source-of-truth langsung ke DB) **tidak menghasilkan artefak SQL yang reproducible**. Bila dipakai di staging/prod atau dalam Docker entrypoint, maka:
- Tidak ada riwayat migrasi → tidak bisa `rollback`.
- Snapshot di `drizzle/meta/*_snapshot.json` bisa tertinggal.
- Terjadi **drift** antara skema di kode dan DB nyata.

**Reproduksi/Verifikasi**
```bash
# Cari penggunaan push di script/CI/Docker
grep -rn "drizzle-kit push" --include="*.json" --include="*.yml" --include="*.yaml" --include="Dockerfile*" .
grep -rn "drizzle-kit" package.json
# Bandingkan jumlah file migrasi vs entri journal
ls drizzle/*.sql | wc -l
cat drizzle/meta/_journal.json | grep -c "tag"
```

**Risiko konkret**
- Migrasi baru (`src/lib/db/schema/*.ts`) tidak punya padanan SQL → deploy berikutnya **mengabaikan perubahan** atau menggagalkan startup.

**Rekomendasi**
1. Ganti `push` → `generate` + `migrate` untuk lingkungan non-lokal.
2. Tambahkan pre-commit/CI check: gagal bila ada perubahan skema TipeScript tanpa file migrasi baru.
3. Simpan baseline snapshot & tegakkan review PR untuk setiap file di `drizzle/`.

---

### TEMUAN-02 — 🔴 Migrasi Skema: Urutan & Interdependensi File Schema
**Kategori:** Schema constraint / migration ordering
**Kaitan skill:** `deprecation-and-migration`

**Deskripsi**
Skema dipisah per-domain (12 file). Masalah klasik Drizzle:
- **Circular reference** antar file (mis. `question.ts` → `solution.ts` → `question.ts`; `bundle.ts` ↔ `collection.ts`).
- **Foreign key** yang di-*declare* dengan nama tabel string vs referensi objek → mudah putus saat refactor/rename.
- File `_enums.ts` yang berubah nilai **tidak aman** di-`ALTER TYPE` tanpa migrasi eksplisit (PostgreSQL `ALTER TYPE ... ADD VALUE` tidak bisa di-`rollback` dalam transaksi).

**Verifikasi**
```bash
# Deteksi import melingkar antar file skema
grep -rn "from './" src/lib/db/schema/ | sort
# Cek apakah ada referensi tabel lewat string
grep -rn "references(() =>" src/lib/db/schema/
grep -rnE "references\(\(\).*[^A-Za-z]\)" src/lib/db/schema/ # placeholder
```

**Risiko**
- `ALTER TYPE ... ADD VALUE` untuk enum baru (mis. `status` di `bundle.ts`/`event.ts`) **gagal** bila dijalankan di transaksi (perilaku PostgreSQL 12+). Migrasi harus dipecah.

**Rekomendasi**
1. Selalu ekspor dari `index.ts` dan gunakan referensi objek, bukan string.
2. Pisahkan migrasi enum (`ALTER TYPE`) ke file tersendiri **tanpa** `BEGIN/COMMIT` wrapper.
3. Dokumentasikan **graph dependensi** skema; deteksi siklus di CI.

---

### TEMUAN-03 — 🟠 Next.js 16: API & Konvensi yang Di-deprecate
**Kategori:** Framework deprecation
**Kaitan skill:** `deprecation-and-migration`

**Deskripsi**
Pada garis keturunan Next.js 15 → 16, beberapa konvensi **dianggap usang / diubah** dan sering tertinggal saat upgrade:

| Area | Pola lama (deprecated) | Pola baru |
|---|---|---|
| Route params | `params` sinkron (`{ params }`) | `params` adalah `Promise` → `await params` |
| `searchParams` | sinkron | `await searchParams` |
| Route handlers | `export function GET(req: Request, { params })` sinkron | async params |
| Caching | default fetch cache | opt-in `cache: 'force-cache'` (default `no-store`) |
| Dynamic APIs | `cookies()`, `headers()` sinkron | `await cookies()` / `await headers()` |
| `next.config` | key `experimental.*` tertentu | dipromosikan ke top-level / dihapus |
| Metadata | `export const metadata` masih ok, tapi `viewport`, `themeColor` sudah dipisah sejak 14 | file `viewport.ts` |

**Verifikasi**
```bash
grep -rn "searchParams\." src/app --include="*.tsx" | grep -v "await"
grep -rn "params\." src/app --include="*.ts" --include="*.tsx" | grep -v "await"
grep -rn "cookies()" src/app | grep -v "await"
grep -rn "headers()" src/app | grep -v "await"
grep -rn "themeColor\|colorScheme" src/app --include="*.ts" # harus di viewport, bukan metadata
```

**Risiko**
- Akses `params.id` tanpa `await` → `undefined` atau error runtime di Next 16.
- Caching default yang berubah → **data stale/segarr** tanpa peringatan.

**Rekomendasi**
1. Jalankan codemod resmi Next.js bila tersedia untuk versi Anda.
2. Tambahkan tipe eksplisit: `params: Promise<{ id: string }>`.
3. Audit semua `route.ts` dan `page.tsx` dinamis di mana `params`/`searchParams` dipakai.

---

### TEMUAN-04 — 🟠 React 19: Breaking Changes & Deprecation
**Kategori:** Library deprecation
**Kaitan skill:** `deprecation-and-migration`

**Deskripsi**
React 19 **menghapus/mengusangkan** banyak pola yang sering ada di legacy code:

| Deprecated | Status di React 19 | Aksi |
|---|---|---|
| `propTypes` | dihapus (ignored) | hapus, migrasi ke TS |
| `defaultProps` (untuk function component) | dihapus | default parameter |
| `string ref` (`ref="x"`) | dihapus | `useRef` |
| `ReactDOM.render` / `hydrate` | dihapus | `createRoot` / `hydrateRoot` |
| `findDOMNode` | dihapus | refs |
| `createFactory` | dihapus | JSX |
| Legacy `context` (`childContextTypes`) | dihapus | `createContext` |
| `forwardRef` | tetap, tapi **ref adalah prop biasa** di RC → pertimbangkan migrasi | prop langsung |
| `useEffect` double-invoke di StrictMode (dev) | perilaku tetap | pahami, jangan matikan StrictMode sebagai "fix" |

**Verifikasi**
```bash
grep -rn "propTypes\|defaultProps\|findDOMNode\|ReactDOM.render\|createFactory" src/
grep -rnE "ref=[\"']" src/
# Legacy context
grep -rn "childContextTypes\|getChildContext" src/
```

**Risiko konkret**
- `defaultProps` pada komponen (kemungkinan besar ada di komponen Base UI wrapper) → runtime `undefined` karena React 19 mengabaikannya.
- Hydration mismatch bila ada kode yang mengandalkan behavior lama.

**Rekomendasi**
1. Migrasi `defaultProps` → default parameter + `Component.defaultProps` dihapus.
2. Tambahkan ESLint `react/no-*` aturan sesuai React 19.

---

### TEMUAN-05 — 🟡 Tailwind v4: Konfigurasi & Utility yang Dihapus
**Kategori:** CSS framework migration
**Kaitan skill:** `deprecation-and-migration`

**Deskripsi**
Tailwind v4 berubah secara fundamental:
- **`tailwind.config.js` tidak lagi file utama** → konfigurasi via `@theme` di CSS.
- Plugin `@tailwindcss/forms`, `aspect-ratio`, `line-clamp` **dipindahkan ke core** (plugin lama deprecated).
- `@apply` masih ada, tapi **tidak boleh** dipakai di file yang di-*scan* sebagai content (bisa infinite loop) — perilaku berbeda.
- Utility tertentu di-rename/dihapus (mis. `bg-opacity-*`, `text-opacity-*` → `/opacity`; `flex-grow-*` → `grow-*`).
- `darkMode: 'class'` → `@custom-variant dark`.

**Verifikasi**
```bash
ls tailwind.config.* 2>/dev/null
grep -rn "bg-opacity-\|text-opacity-\|flex-shrink-\|flex-grow-\|overflow-ellipsis" src/ --include="*.tsx" --include="*.css"
grep -rn "@apply" src/ --include="*.css"
grep -rn "tailwindcss/" src/ --include="*.css"  # plugin lama
```

**Risiko**
- Style **hilang diam-diam** (class yang tidak dikenali tidak error, hanya tidak render). Sulit dilacak via test.

**Rekomendasi**
1. Ikuti **upgrade guide resmi v4** (migrator CLI) dan commit diff.
2. Audit `@apply` → pindahkan ke `@layer` component atau ganti dengan utility.
3. Tambahkan **visual regression test** (Playwright/Storybook) karena perubahan CSS tidak tertangkap unit test.

---

### TEMUAN-06 — 🟡 PostgreSQL 17: Fitur & Tipe yang Usang
**Kategori:** DB deprecation
**Kaitan skill:** `deprecation-and-migration`

**Deskripsi**
- `serial` / `bigserial` **bukan deprecated tapi tidak direkomendasikan** → gunakan **`GENERATED ... AS IDENTITY`** (lebih aman, sesuai SQL standard, tidak bisa di-override manual tanpa `OVERRIDING`).
- `SERIAL` columns **tidak mendukung `GRANT` sequence** dengan benar di skema RBAC tertentu → risiko privilege.
- Tipe `money` berisiko (locale-dependent) → umumnya diganti `numeric`.
- Deprecation operator/tipe lama (mis. `abstime`) & `pg_stat_*` kolom yang di-rename — **tidak** akan muncul kecuali Anda memakai fitur lanjutan.

**Verifikasi**
```bash
grep -rn "serial(\|bigserial(\|smallserial(" src/lib/db/schema/
grep -rn "\"money\"\|money(" src/lib/db/schema/
grep -rn "pg_stat_" src/ 2>/dev/null
```

**Risiko**
- `serial` pada `_columns.ts` (kolom ID bersama) → saat migrasi ke Identity, FK yang ada **tidak otomatis menyesuaikan** dan `OVERRIDING` handling berubah.

**Rekomendasi**
1. Migrasikan `serial` → `identity` dalam satu migrasi terkontrol + verifikasi sequence.
2. Untuk kolom uang/score, pakai `numeric(precision, scale)` di `_columns.ts`.

---

### TEMUAN-07 — 🟠 Skema: Foreign Key, On Delete & Referential Integrity Saat Migrasi
**Kategori:** Constraint violation
**Kaitan skill:** `deprecation-and-migration`

**Deskripsi**
Pada relasi yang saling bergantung (`question` ↔ `solution`, `bundle` ↔ `collection`, `source` ↔ `media`, `event` → `question`), perilaku **`ON DELETE`** wajib eksplisit:

| Skenario | Default PostgreSQL | Risiko |
|---|---|---|
| Hapus `question` yang dipakai `solution` | `NO ACTION` | Error FK → transaksi gagal |
| Hapus `bundle` yang ada di `collection` | `NO ACTION` | Migrasi `DELETE` di seed gagal |
| Hapus `source` yang punya `media` | `NO ACTION` | Orphan / error |

**Verifikasi**
```bash
grep -rn "onDelete\|onUpdate" src/lib/db/schema/
grep -rn "references(" src/lib/db/schema/ | wc -l
grep -rn "references(" src/lib/db/schema/ | grep -v "onDelete" # FK tanpa onDelete → default NO ACTION
```

**Risiko**
- Migrasi data (backfill / re-seed) **menggantung** karena FK `NO ACTION`.
- Soft-delete tidak konsisten: ada kolom `deletedAt` tapi query tidak memfilter → migrasi "hapus" meninggalkan referensi.

**Rekomendasi**
1. Tetapkan **matriks `onDelete`** per relasi: `cascade` untuk child murni, `restrict` untuk master (source, taxonomy), `set null` untuk referensi opsional.
2. Untuk soft-delete, gunakan **partial index** `WHERE deleted_at IS NULL` dan view terfilter.
3. Validasi FK di CI dengan `drizzle-kit check`/test integrasi.

---

### TEMUAN-08 — 🟠 Skema: Enum & Status Lifecycle (Bundle, Collection, Event, Solution)
**Kategori:** Constraint / state machine
**Kaitan skill:** `deprecation-and-migration`

**Deskripsi**
File `bundle.ts`, `collection.ts`, `event.ts`, `solution.ts` hampir pasti punya enum status (draft/published/archived, dll). Saat deprecation status lama:
- Nilai enum **tidak bisa dihapus** dari tipe PostgreSQL tanpa recreate type + cast kolom.
- Migrasi "remove nilai enum" sering **gagal** bila masih ada row dengan nilai tersebut.
- Transisi status tidak dijaga → bisa `published → draft` lewat jalur tak terduga.

**Verifikasi**
```bash
grep -rn "pgEnum" src/lib/db/schema/
grep -rn "status\|state" src/lib/db/schema/*.ts | grep -i "enum\|text(\|varchar("
```

**Risiko**
- Migrasi enum (`DROP VALUE`) memerlukan **pembuatan ulang tipe**, `ALTER COLUMN ... TYPE ... USING`, dan downtime/table lock.

**Rekomendasi**
1. Untuk enum yang berevolusi cepat → **gunakan tabel lookup** (`statuses`) alih-alih `pgEnum`.
2. Untuk `pgEnum`, dokumentasikan deprecated values; jangan hapus nilai, cukup tolak di aplikasi.
3. Tambahkan **CHECK constraint** untuk transisi status + trigger bila perlu.

---

### TEMUAN-09 — 🟠 Sk