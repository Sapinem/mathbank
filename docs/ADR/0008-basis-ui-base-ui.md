# ADR-0008 — Basis primitif UI: **Base UI** (bukan Radix)

- **Status:** Diterima
- **Tanggal:** 2026-09-29
- **Pengambil keputusan:** Pemilik produk + lead engineer
- **Terkait:** ADR-0005 (komponen resmi shadcn), `AGENTS.md` §Stack, `REVIEW-TUMPUKAN-TEKNOLOGI.md` §5 (temuan P2)

## Konteks

`AGENTS.md` menyatakan basis UI = **"Base UI headless primitives"**, tetapi saat shell dirombak pakai shadcn resmi (ADR-0005), shadcn CLI menulis style **`radix-nova`** dan memasang **`radix-ui@1.6.7`**. Jadi **dokumen dan kode tidak sinkron** — pelanggaran "Zero Silent Assumptions" (`AGENTS.md` §2). `REVIEW-TUMPUKAN-TEKNOLOGI.md` §5 mencatat ini sebagai temuan **P2** yang belum diputuskan.

Fakta (diverifikasi terhadap registry shadcn & npm, 2026-09-29):

- shadcn CLI v4.21 punya flag **`-b, --base <base>`** dengan pilihan **`base` · `radix` · `aria`**.
- **Preset default shadcn kini `base-nova`** (Base UI) — jadi Base UI = arah hulu, bukan eksperimen.
- Registry **`base-nova`** hidup (`https://ui.shadcn.com/r/styles/base-nova/*.json` → 200); komponennya impor dari **`@base-ui/react/*`**.
- Paket **`@base-ui/react@1.8.0`** tersedia di npm.

## Keputusan

**Basis primitif UI resmi MathBank = Base UI (`@base-ui/react`).** Migrasi penuh dari Radix; `radix-ui` **dihapus** setelah selesai. Style shadcn = **`base-nova`**.

### Konsekuensi teknis yang diterima (breaking)

Base UI **tidak** punya prop `asChild` (pola Radix `Slot`). Penggantinya adalah prop **`render`**. Karena itu migrasi menyentuh:

- **14 komponen** `ui/**` yang mengimpor `radix-ui` → **regenerate** dari registry `base-nova`.
- **9 pemakaian `asChild`** di **5 file aplikasi** → ditulis ulang ke pola `render`.
- **Tes** yang bergantung Radix (pemilih `asChild`, Radix `Select` di jsdom) → disesuaikan.

## Alternatif yang Dipertimbangkan

| Alternatif | Kenapa ditolak |
|------------|----------------|
| **Tetap Radix**, perbaiki `AGENTS.md` | Menutup inkonsistensi dengan mengubah arah semula; melewatkan arah hulu (default shadcn) |
| **Koeksistensi** (Radix lama + Base UI baru) | Menggandakan dependensi + kognisi; tak menyelesaikan ambiguitas |
| **Ariakit** (`--base aria`) | Bukan arah yang diminta; ekosistem shadcn untuknya belum jadi default |

## Konsekuensi

**Positif:**
- Kode & dokumen **konsisten** — menutup temuan P2.
- Selaras **arah hulu shadcn** (preset default `base-nova`).
- Satu basis primitif → tak ada kebingungan contributor/agent berikutnya.
- Mumpung proyek kecil (21 komponen, 5 file) — tunda = lebih mahal.

**Negatif / utang:**
- **Breaking change nyata**: `asChild` → `render`; 14 komponen + 5 file + tes disentuh.
- Migrasi besar berisiko regresi → wajib **gerbang penuh hijau** + verifikasi browser (KaTeX, tema, interaksi) setelah migrasi.
- Selama migrasi, registry `base-nova` mungkin mengubah beberapa detail markup → jaga diff terfokus.

## Rencana Eksekusi

1. ADR ini (ratifikasi).  
2. Pasang `@base-ui/react`; set `components.json` → `style: "base-nova"`.  
3. Regenerate 14 komponen dari registry.  
4. Tulis ulang 9 `asChild` → `render`.  
5. Perbarui tes yang bergantung Radix.  
6. Gerbang penuh + verifikasi browser.  
7. Hapus `radix-ui` dari `package.json`; sinkronkan `AGENTS.md` + `TUMPUKAN-TEKNOLOGI.md`.

## Catatan

ADR-0005 §Catatan ("pertanyaan terbuka: Radix atau Base UI") **dijawab oleh ADR ini**: **Base UI**.
