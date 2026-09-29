# CONTRIBUTING.md — Panduan Kontribusi MathBank

> **Status:** ✅ berlaku (per 2026-09-29).
> **Untuk:** siapa pun yang menulis kode/dokumen di MathBank (manusia atau agen).

---

## 1. Sebelum Mulai

1. **Baca `AGENTS.md`** — aturan kerja (terutama **§2 Zero Silent Assumptions**: jangan ubah skema/arsitektur tanpa persetujuan).
2. **Baca `CONSTRAINTS.md`** — 30+ aturan keras (mis. larangan `useMemo`/`useCallback`, zero type error).
3. **Pahami arsitektur** — `DESAIN-PER-LAPISAN-MATHBANK.md` (L1–L9).
4. **Cek istilah** — `KAMUS-DATA.md` (pakai kata yang sama).

---

## 2. Menyiapkan Lingkungan

```bash
git clone <repo> && cd mathbank
pnpm install
cp .env.example .env        # isi DATABASE_URL, BETTER_AUTH_SECRET, TEST_DATABASE_URL
pnpm db:migrate             # skema + safety
pnpm db:verify              # harus hijau
pnpm seed:taxonomy
pnpm dev                    # http://localhost:3000 (atau :3001 bila bentrok)
```

**Prasyarat:** Node ≥ 20, pnpm 11, **PostgreSQL 18** (port 5433 untuk dev lokal).

---

## 3. Alur Kerja

1. **Satu perubahan = satu tujuan** (jangan campur fitur + refactor besar).
2. **Tulis tes** saat menambah logika (lihat `STRATEGI-TES.md` §DoD).
3. **Jalankan gate** sebelum commit:
   ```bash
   pnpm check        # typecheck + lint + coverage + build
   pnpm test:db      # integrasi DB (bila menyentuh service/DB)
   pnpm db:verify    # bila menyentuh skema/migrasi
   ```
4. **Commit** dengan pesan deskriptif (format di §5).
5. **Perbarui dokumen** yang relevan + `CHANGELOG.md`.

---

## 4. Gerbang Mutu (WAJIB hijau)

| Gerbang | Perintah | Ambang |
|---------|----------|--------|
| Type | `pnpm typecheck` | **0 error** (zero-warning juga) |
| Lint | `pnpm lint` | 0 error/warning |
| Unit | `pnpm test` | 100% lulus |
| Coverage | `pnpm test:coverage` | sesuai `STRATEGI-TES.md` (per-lapisan) |
| Integrasi DB | `pnpm test:db` | 100% lulus |
| Build | `pnpm build` | 0 error |
| Skema | `pnpm db:verify` | hijau |

---

## 5. Konvensi Commit

Format: `tipe(lingkup): ringkasan`

| Tipe | Untuk |
|------|-------|
| `feat` | fitur baru |
| `fix` | perbaikan bug |
| `refactor` | ubah struktur tanpa ubah perilaku |
| `test` | tes |
| `docs` | dokumen |
| `chore` | tooling, deps |
| `perf` | performa |

Contoh: `feat(api): tambah endpoint ekspor paket`, `docs(keamanan): threat model`.

---

## 6. Konvensi Kode

- **Bahasa:** komentar & teks UI **Indonesia**; nama variabel/fungsi **Inggris**.
- **TS:** strict; hindari `any`; zod untuk validasi batas.
- **React:** **tanpa** `useMemo`/`useCallback` (React Compiler).
- **Komponen UI:** pakai **shadcn resmi lebih dulu** (periksa registry via MCP).
- **Lapisan:** logika bisnis di **service**, bukan route; handler route tipis (`wrapRoute`).
- **DB:** perubahan skema → migrasi file (**bukan** `db:push`) + `db:verify`.

---

## 7. Menambah Dokumen

1. Tulis di `docs/`.
2. **Daftarkan di `PETA-DOKUMEN.md`** (peta = indeks hidup).
3. Keputusan arsitektural besar → tulis **ADR** (`docs/ADR/`, lihat template).
4. Perbarui `CHANGELOG.md`.

---

## 8. Ulasan (Review)

- Perubahan menyentuh **skema/auth/keamanan** → wajib persetujuan (Zero Silent Assumptions).
- Sertakan **bukti** (output gate, screenshot untuk UI).
- Jangan gabung perubahan tak terkait.

---

## 9. Rujukan

- `AGENTS.md` · `CONSTRAINTS.md` · `STRATEGI-TES.md`
- `DESAIN-PER-LAPISAN-MATHBANK.md` · `KEAMANAN.md` · `PETA-DOKUMEN.md`
