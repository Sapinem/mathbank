# ADR — Architecture Decision Records

> Catatan keputusan arsitektural **formal**, satu keputusan = satu berkas.
> **Beda dari `RIWAYAT-KEPUTUSAN.md`:** RIWAYAT = log kronologis naratif; ADR = keputusan individual dengan konteks, alternatif, dan konsekuensi (untuk keputusan yang layak dirujuk ulang).
> Format: Michael Nygard (ringkas). Status: `Diusulkan` · `Diterima` · `Ditolak` · `Digantikan oleh ADR-NNN`.

## Indeks

| ADR | Judul | Status |
|-----|-------|--------|
| [0001](0001-bangun-ulang-mathbank.md) | Bangun ulang MathBank (bukan refactor QBank) | Diterima |
| [0002](0002-arsitektur-berlapis-l1-l9.md) | Arsitektur berlapis L1–L9 | Diterima |
| [0003](0003-postgresql-18-uuidv7.md) | PostgreSQL 18 + `uuidv7()` sebagai PK | Diterima |
| [0004](0004-better-auth-multi-role.md) | Better Auth + multi-role (tabel `user_roles`) | Diterima |
| [0005](0005-shadcn-komponen-resmi.md) | Pakai komponen **resmi** shadcn (bukan tulis sendiri) | Diterima |
| [0006](0006-invarian-lunak-di-service.md) | Invarian "lunak" di service, bukan CHECK keras | Diterima |
| [0007](0007-db-reproduktif-dari-file.md) | DB wajib direproduksi dari file migrasi | Diterima |
| [0008](0008-basis-ui-base-ui.md) | Basis UI: Base UI (menggantikan Radix) | Diterima |
| [0009](0009-bundle-pisah-koleksi-dan-latihan.md) | Bundle: **satu tabel** `bundles` (usulan "pisah" ditolak) | Ditolak |
| [0010](0010-event-jenis-berulang-tahun-di-soal.md) | `event` = jenis berulang; tahun di `questions.event_year` | Diterima |
| [0011](0011-stimulus-tetap-di-questions.md) | Stimulus tetap di `questions` (`parent_id`) — jangan dipisah | Diterima |
| [0012](0012-provenance-per-butir-question-sources.md) | Provenance per-butir: tabel `question_sources` (multi-sumber) | Diusulkan |

## Cara menambah ADR

1. Salin `template.md` → `NNNN-judul-singkat.md` (nomor urut 4 digit).
2. Isi Konteks · Keputusan · Alternatif · Konsekuensi.
3. Tambahkan baris di Indeks atas.
4. Jangan hapus ADR lama — tandai `Digantikan oleh ADR-NNN`.
