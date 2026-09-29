# MathBank

Bank soal **matematika** — kurasi, susun, terbitkan.

Menggantikan QBank; dibangun dari kanvas bersih dengan arsitektur 9 lapisan.

---

## Tentang

MathBank membantu guru & tim kurikulum:

1. **Menyimpan** soal matematika lengkap (11 tipe, rumus KaTeX, media).
2. **Mencari** dengan filter kaya (topik, sumber, jenjang, kesulitan, level kognitif) + pencarian semantik.
3. **Menyusun** paket soal (ujian, latihan, sumber).
4. **Menerbitkan** lewat cetak/PDF.

Untuk satu institusi, skala kecil (<100 pengguna). Lihat `docs/PRD.md`.

---

## Tumpukan Teknologi

| Lapis | Teknologi |
|-------|-----------|
| Framework | Next.js 16 · React 19 · TypeScript 5.9 |
| Gaya | Tailwind v4 · shadcn/ui · mesin tema OKLCH |
| Data | PostgreSQL 18 · Drizzle ORM · pgvector |
| Auth | Better Auth (5 peran, multi-role) |
| Validasi | Zod |
| Mutu | Vitest · Testing Library · ESLint |

Detail & alasan: `docs/TUMPUKAN-TEKNOLOGI.md`.

---

## Memulai

### Prasyarat
- Node.js ≥ 20, pnpm
- PostgreSQL 18 (port `5433`), ekstensi `vector` + `pg_trgm`

### Pasang & jalankan

```bash
pnpm install
cp .env.example .env          # isi DATABASE_URL, BETTER_AUTH_SECRET, dst
pnpm db:migrate               # terapkan skema (27 tabel)
pnpm seed:taxonomy            # isi jenjang/kesulitan/level kognitif
pnpm theme:build              # bangun token tema
pnpm dev                      # http://localhost:3000
```

### Perintah lain

| Perintah | Fungsi |
|----------|--------|
| `pnpm typecheck` | tsc --noEmit (0 error) |
| `pnpm lint` | ESLint |
| `pnpm test` | Vitest |
| `pnpm test:watch` | Vitest mode pantau |
| `pnpm build` | Build produksi |
| `pnpm check` | **Semua gerbang mutu** sekaligus |
| `pnpm db:generate` | Hasilkan migrasi dari skema |
| `pnpm db:migrate` | Terapkan migrasi |
| `pnpm db:studio` | Drizzle Studio |
| `pnpm theme:build` | Bangun ulang token tema |
| `pnpm seed:taxonomy` | Seed taksonomi dari `curriculum.yaml` |

---

## Struktur

```
src/
  app/
    (app)/            halaman ber-shell (dasbor, bank soal, dst)
    api/              route API
    layout.tsx        akar (tema, query, font)
    globals.css       impor token + Tailwind
  components/
    layout/           sidebar, header, shell, ⌘K
    providers/        tema, react-query
    ui/               shadcn + keadaan
  lib/
    api/              pembungkus route (L4)
    auth/             peran, izin, guard, actor
    db/               koneksi + skema (10 modul)
scripts/
  theme/build.ts      mesin tema
  seed-taxonomy.ts    seeder
docs/                 20 dokumen perencanaan & desain
```

---

## Gerbang Mutu

Setiap perubahan wajib lolos:

```bash
pnpm check   # typecheck 0 + lint 0 + test + build
```

Aturan lengkap: `CONSTRAINTS.md`. Prinsip: `AGENTS.md`.

---

## Dokumentasi

Seluruh perencanaan ada di `docs/`. Mulai dari:

| Dokumen | Isi |
|---------|-----|
| `PRD.md` | Kebutuhan produk, MVP, alur kerja |
| `MILESTONE.md` | Rencana M0–M12, tugas per milestone |
| `DESAIN-PER-LAPISAN-MATHBANK.md` | Arsitektur 9 lapisan (L1–L9) |
| `SKEMA-DB-DETAIL.md` | Bentuk final skema database |
| `RENCANA-UI.md` | Struktur menu, halaman, keputusan UI |
| `TUMPUKAN-TEKNOLOGI.md` | Pilihan library & alasan |
| `RIWAYAT-KEPUTUSAN.md` | Kronologi keputusan + alasan |
| `CHANGELOG.md` | Catatan perubahan tiap versi |

---

## Status

Lihat `CHANGELOG.md` untuk versi terbaru & `docs/MILESTONE.md` untuk peta jalan.

| Milestone | Status |
|-----------|--------|
| M0 Fondasi | ✅ |
| M1 Skema Database | ✅ |
| M2 Auth & Peran | ✅ |
| M3 Tema & Shell | ✅ |
| M4 Bank Soal | ⬜ |
| … | … |
