# STATUS UI — MENGGANTUNG ⏸️

> UI redesign **DIJEDA** (2026-09-29 di QBank) untuk kembali mereview arsitektur.
> **Belum dilanjutkan di MathBank.** Menunggu fase planning.
> Sumber asli: QBank `docs/_archive/.../_reconcile/STATUS-PENDING-UI.md`.

---

## Kenapa Dijeda

Saat mengerjakan UI, ditemukan bahwa **`exam_events` sudah ada API-nya & sudah jadi tab di `/sources`** — tapi tak ada di menu. Ini memicu pertanyaan lebih besar: **"apakah data pendukung sebaiknya digabung menjadi satu halaman?"** → merembet ke review arsitektur menyeluruh → berujung keputusan bikin MathBank baru.

**Pelajaran:** jangan putuskan struktur menu sebelum arsitektur mantap. Perubahan arsitektur = perubahan menu/halaman.

---

## ✅ SUDAH Diputuskan (carry-over ke MathBank)

Keputusan UI yang **sudah final** dan berlaku di MathBank:

| Item | Keputusan |
|------|-----------|
| Nama menu | "Eksplorer Soal" → **"Bank Soal"** |
| Quick-action header | **Tombol "Cari" (⌘K)** |
| Tombol "Buat Soal" | **DIHAPUS** (jarang dipakai) |
| Struktur sidebar | 4 grup: **Kerja / Referensi / Studio / Sistem** (L2) |
| Referensi | **Submenu lipat**: Topik · Sumber & Asal · Event · Label (L2) |
| Event | Punya **halaman** (dulu: ada API, tak ada halaman) |
| Ingest | Pindah ke grup **Sistem** (L2) |
| Menu per-peran | **Sama** untuk semua peran dulu (belum dibedakan) |
| Gaya visual | Linear/Vercel — gelap/terang, padat, presisi, border tipis |
| Tema | Kerangka generatif (3 warna sumber → seluruh UI) |
| Font | Roboto Flex + Roboto Mono |
| Mode | Gelap + Terang, default ikut OS |
| Command palette | ⌘K untuk navigasi cepat |
| Breadcrumb | Konsisten |

---

## ⏸️ BELUM Final (menunggu planning)

Keputusan yang **masih menggantung** dan perlu dituntaskan di fase planning:

1. **Struktur domain sidebar final** — usulan lama: Kerja / Katalog-Referensi / Aset-Studio / Sistem. Sudah direvisi ke 4 grup L2, tapi perlu dikonfirmasi final.
2. **Referensi: submenu lipat vs 1 halaman bertab vs halaman terpisah?**
   - QBank: 3 menu terpisah
   - Usulan lama: 1 halaman bertab (`/referensi?tab=topik`)
   - L2 (revisi terakhir): **submenu lipat** ← *perlu konfirmasi final*
3. **URL pattern** Referensi — `/referensi?tab=topik` (bookmarkable) atau `/topik`, `/sumber` terpisah?
4. **Perbedaan menu per-peran** — sekarang sama semua; nanti apakah reviewer punya "Telaah" menonjol?
5. **Command palette** — penyedia (⌘K) & cakupan aksi.

---

## 🚧 Fase UI Tersisa (belum dikerjakan di MathBank)

| Fase | Isi | Status |
|------|-----|--------|
| **A** | Mesin tema (3 warna → OKLCH + WCAG), wiring, default OS | ✅ Di QBank (perlu dibawa) |
| **B** | Komponen dasar Linear (Button/Badge/Modal/State) | ✅ Di QBank (perlu dibawa) |
| **C** | Sidebar + Header + Command Palette | ⏸️ **Belum** |
| **D** | Halaman (Dasbor, Bank Soal, Telaah, Paket, Editor, Sumber, dll) | ⏸️ **Belum** |

---

## 📌 Catatan Teknis Berguna (dari QBank, untuk dibawa)

- **Token tema:** `--qbank-<peran>` (OKLCH) + alias `--color-<peran>` di `src/styles/tokens/generated.css`. Ganti brand: ubah `scripts/theme/sources.ts` → `pnpm theme:build`.
- **Default mode ikut OS** (`ThemeContext.tsx` + skrip larangan-flash di `layout.tsx`).
- **Warna status UNIVERSAL** (tak ikut brand). "Siap" = biru brand (bukan hijau).
- **WCAG terverifikasi:** beberapa token diperbaiki (border-strong 1.71→3:1; brand-fg dark mode-dependent).
- **Pelanggaran React Compiler:** QBank melanggar larangan `useMemo`/`useCallback` — MathBank **tidak boleh** (L3).
- Dokumen desain terkait (ada di QBank `docs/`): `DESIGN-THEME-FRAMEWORK.md`, `THEME-FRAMEWORK-GUIDE.md` (sudah disalin ke `docs/` MathBank).

---

## ⚠️ Sebelum Melanjutkan UI

1. **Selesaikan planning** (dokumen apa yang perlu — lihat `CATATAN-PLANNING.md`).
2. **Bawa Fase A & B** dari QBank (mesin tema + komponen dasar) — atau bangun ulang.
3. **Konfirmasi** keputusan "belum final" di atas.
4. Baru kerjakan **Fase C** (Shell).

---

## 🔗 Prinsip UI yang Dipegang

- **Zero Silent Assumptions** (AGENTS.md) — jangan asumsikan struktur UI tanpa konfirmasi.
- **Konstruksi per-fase** — A→B→C→D, tiap fase ada checkpoint.
- **Dokumen UI target** (belum ada di MathBank): `RENCANA-REDESIGN-UI.md`, `FASE-B-KOMPONEN-DASAR.md` — perlu dibawa/dibuat ulang.
