# RENCANA EKSEKUSI — ADR-0012 `question_sources` (provenance per-butir)

> **Status:** 🟡 menunggu persetujuan eksekusi
> **Rujukan:** `docs/ADR/0012-provenance-per-butir-question-sources.md`
> **Urutan aman:** skema → verifikasi → service → perbaikan ingest → API/UI → tes → dokumen.

## Prasyarat
- [ ] **Backup DB**: `pnpm backup:db` (dump terverifikasi) — DB produksi punya data nyata.
- [ ] Service produksi **stop** sebelum build/migrasi (PELAJARAN proyek).

## T1 — Skema `question_sources` (drizzle)
- Tambah `src/lib/db/schema/question-source.ts` (atau perluas `source.ts`): tabel + relasi + tipe.
- Relasi: `questionSources.question → questions`, `.source → sources`; tambah `questions.sources: many(...)`.
- Enum: pakai `sourceKindEnum` yang ada.
- [ ] `pnpm db:generate` (WAJIB menghasilkan snapshot drizzle-kit).

## T2 — Perbarui invarian tabel (WAJIB, atau gate gagal)
- `src/lib/db/invariants.ts`: `tables: 28 → 29`.
- `scripts/db-verify.ts`: `EXPECTED.tables: 28 → 29`.
- [ ] `pnpm db:migrate` (extensions → migrate → safety) — pastikan `db:safety` tetap hijau.
- [ ] `pnpm db:verify` → tables 29, trigger 26, check 2, hnsw 1.

## T3 — Contract & projection
- `src/lib/contracts/question.ts`: tambah `sources?: Array<{sourceId,title,url,accessedAt,sourceType,…}>`.
- `src/lib/db/projections/question.ts`: sertakan relasi `questionSources` di jalur baca (ingat #34: sebut kolom eksplisit).

## T4 — Perbaiki bug ingest `commitItems` (provenance terputus)
- `src/lib/ingest/commit.ts`: teruskan `title` (judul artikel), `source_url`, dan waktu akses →
  buat baris `question_sources` saat `createQuestion`.
- `src/lib/ingest/service.ts`: alirkan `title`/`sourceUrl` dari antrean ke `commitItems`.
- `CommitOptions`: tambah `articleTitle?`, `articleUrl?`, `accessedAt?`.
- [ ] Tes ingest (`ingest.db.test.ts`): judul & URL **tersimpan** setelah commit (regresi cacat ini).

## T5 — Service baca
- `listQuestions`/`getQuestion`: sertakan `questionSources` (mis. label asal).
- Pertimbangkan filter per `source_id`/`source_type` (belum wajib).

## T6 — API
- `src/app/api/questions/[id]/route.ts` (GET) & list: sertakan `sources`.
- **JANGAN** tambah gate `permission` ber-`own` tanpa `ownerId` (#35).
- Mutasi terkait (bila ada) wajib `rateLimit` (#33).

## T7 — UI (minimal dulu)
- Tampilkan asal-usul (judul artikel + URL + waktu akses) di detail soal.
- Bila perlu, editor: pilih/isi sumber.

## T8 — Tes & dokumen
- [ ] Unit + DB test: multi-sumber (1 soal 2 sumber) → **bukan** unique violation.
- [ ] `pnpm check` (stop service dulu) → 0 error, 0 warning, coverage ambang.
- [ ] Dokumen: `SKEMA-DB-DETAIL.md`, `KAMUS-DATA.md`, `MILESTONE.md`, `CHANGELOG.md`,
      audit baru + §Catatan Verifikasi (#44), `PETA-DOKUMEN.md`.
- [ ] Commit terpisah: skema, service/ingest, UI, dokumen.

## Risiko & mitigasi
| Risiko | Mitigasi |
|---|---|
| Migrasi gagal di produksi | Backup + `restore:check` sebelum; expand-only (tak ada DROP) |
| Gate invarian gagal (angka tabel) | T2 wajib; `db:verify` sebagai gerbang |
| Ingest dobel baris provenance | Idempotensi via `itemHash` tetap; provenance idempoten per (`question_id`,`source_id`,`url`) |
| Coverage turun | Tambah tes T4/T5 sejalan kode baru |
