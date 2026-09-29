# GOVERNANCE.md — Tata Kelola Proyek MathBank

> **Status:** 📝 usulan (dokumen hidup).
> **Tujuan:** jelas **siapa memutuskan apa**, bagaimana keputusan dicatat, & bagaimana kode/dokumen bergerak.
> **Konteks:** proyek kecil (MVP, tim kecil) — tata kelola **ringan**, bukan birokrasi.

---

## 1. Peran

| Peran | Tanggung jawab |
|-------|----------------|
| **Pemilik Produk** (owner) | Visi, prioritas, keputusan produk; suara akhir. |
| **Arsitek** | Keputusan arsitektur/data; menulis ADR. |
| **Lead Engineer** | Mutu kode, gate CI, rilis; **Code Owner** utama. |
| **Kontributor** | Menulis kode/dokumen sesuai `CONTRIBUTING.md`. |
| **Agen (AI)** | Sama seperti kontributor, **dibatasi** `AGENTS.md`. |

> Nama & penugasan menyusul saat tim bertambah. Sekarang: **pemilik produk = arsitek = lead engineer** (satu orang) — sehingga keputusan harus **didokumentasikan** lebih ketat (agar bisa dilacak).

---

## 2. Jenis Keputusan

| Jenis | Siapa | Bentuk |
|-------|-------|--------|
| **Produk** (fitur, prioritas, scope) | Pemilik produk | `PRD.md`, `MILESTONE.md` |
| **Arsitektur** (skema, lapisan, teknologi) | Arsitek | **ADR** (`docs/ADR/`) |
| **Implementasi** | Lead engineer | kode + commit |
| **Proses/dokumen** | semua | `PETA-DOKUMEN.md` |

**Aturan keras (Zero Silent Assumptions):** perubahan **skema DB, autentikasi, keamanan, arsitektur** wajib **persetujuan eksplisit** sebelum dikerjakan (`AGENTS.md §2`). Bukan "asumsi boleh".

---

## 3. Alur Keputusan

```
Usulan → diskusi → kesepakatan → catat (ADR/dokumen) → kerjakan → verifikasi (gate) → rilis
```

- Keputusan **kompleks/berdampak** → tulis **ADR** (dengan alternatif yang ditolak).
- Keputusan **kecil** → commit + `CHANGELOG.md`.
- Keputusan **produk** → perbarui `PRD.md`.

---

## 4. Kepemilikan Dokumen

Lihat `PETA-DOKUMEN.md` §4. Ringkas:
- A (Produk) → pemilik produk
- B (Arsitektur/Data) → arsitek
- C (Desain/UI) → desainer/lead
- D (Mutu/Proses) → lead engineer
- E (Keamanan/Ops) → lead + Ops
- F/G (API/Fitur) → engineer terkait

---

## 5. Mutu & Rilis

- **Gate wajib hijau** sebelum merge/rilis: `pnpm check` + `pnpm test:db` + `pnpm db:verify` (`CONTRIBUTING.md`).
- **Tidak ada** perubahan menyentuh produksi tanpa gate hijau.
- Rilis & rollback: `RENCANA-DEPLOY.md`.

---

## 6. Perubahan Dokumen Ini

`GOVERNANCE.md` & `PETA-DOKUMEN.md` = **dokumen hidup**; diubah bila peran/proses berubah. Peta dokumen adalah **indeks kanonik** — dokumen baru wajib terdaftar di sana.

---

## 7. Rujukan

- Aturan kerja: `AGENTS.md`, `CONSTRAINTS.md`
- Kontribusi: `CONTRIBUTING.md`
- Peta dokumen: `PETA-DOKUMEN.md`
- Keputusan: `docs/ADR/`, `RIWAYAT-KEPUTUSAN.md`
