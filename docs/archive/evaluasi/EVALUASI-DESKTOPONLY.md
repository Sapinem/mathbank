# EVALUASI — DesktopOnly vs Best Practice shadcn/ui

> **Pemicu:** pertanyaan pemilik produk: *"DesktopOnly ini ikut aturan apa? shadcn
> tidak punya aturan beginian kan?"*
> **Kesimpulan singkat:** benar — shadcn tak punya aturan itu; `DesktopOnly`
> **bukan pelanggaran shadcn** (karena shadcn itu pustaka komponen, bukan
> pedoman UX), **tetapi** ia **melawan praktik responsif standar** yang
> direkomendasikan industri & selaras nilai shadcn ("mobile-first").

## 1. Apa itu shadcn/ui — dan apa yang BUKAN

shadcn/ui adalah **kumpulan komponen** (Button, Dialog, Sheet, …) yang
*dimasukkan ke repo* ("own the code"). Ia **tidak** menetapkan aturan UX seperti
"halaman X wajib jalan di HP". Jadi:

- ❌ `DesktopOnly` **bukan** pelanggaran aturan shadcn — karena aturannya memang
  tidak ada di shadcn.
- ✅ **Tetapi** praktik responsif adalah **standar web** yang shadcn sendiri
  *mendukung* (semua komponennya mobile-first, ada `Sheet` untuk mobile).

## 2. Apa kata praktik terbaik (2026, sumber nyata)

### a. Mobile-first adalah aturan dasar
> *"Mobile-first: base classes are for mobile, `md:`/`lg:` for larger screens."*
> *"UI wajib benar di desktop, tablet, DAN mobile."*

Panduan UI (ui-design skill, Refactoring UI + shadcn): **harus** uji di **375px
dan 1280px**. Tidak ada pembenaran "halaman desktop-saja".

### b. Pola resmi shadcn untuk responsif = **Sheet (mobile) + Dialog (desktop)**
> *"Pattern 4 — Sheet for mobile, Dialog for desktop, same content."*
> (unfoldcms, "A Year of Building With shadcn")

```tsx
function useResponsiveModal() {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  return isDesktop ? Dialog : Sheet;   // konten SAMA, chrome beda
}
```

Jadi **jawaban shadcn untuk "di HP repot"** = **ganti chrome**, bukan
**blokir halaman**.

### c. shadcn `Sheet` = komponen dialog yang *dirancang untuk mobile*
> *"Sheet extends Dialog to display content that complements the main content."*
> `side` = top/right/bottom/left. (ui.shadcn.com/docs/components/sheet)

Artinya shadcn **menyediakan alat** agar fitur tetap bisa dipakai di HP —
kebalikan dari memblokir.

## 3. Verdict

| Pertanyaan | Jawaban |
|-----------|---------|
| `DesktopOnly` melanggar aturan shadcn? | **Tidak** (shadcn tak punya aturan begitu) |
| Selaras best practice responsif? | **Tidak** — melawan „mobile-first" |
| Adakah pola shadcn penggantinya? | **Ya** — `Sheet` (mobile) + `Dialog`/layout (desktop), konten sama |
| Apakah DesktopOnly "harus" dihapus? | **Tidak wajib**, tapi sebaiknya diganti bila memungkinkan |

**Penilaian jujur:** `DesktopOnly` adalah **pragmatisme** (hemat waktu), bukan
**best practice**. Ia menerima trade-off: HP hanya bisa *melihat*, tak bisa
*menyusun*. Untuk MVP ini defensif, tapi **utang UX** yang layak dibayar.

## 4. Rekomendasi bertahap

### Langkah 1 (kecil, sekarang) — ucapkan terima kasih, ganti yang murah
Untuk halaman kritis-MVP (**penyusun paket**, **editor soal**), sediakan versi
mobile pakai **Sheet** untuk panel samping:

```
Desktop : 2 kolom  (bank soal | isi paket)
Mobile  : 1 kolom  + <Sheet side="bottom"> "Tambah soal"  (konten sama)
```

Logika penyimpanan (tambah/urut/hapus) sudah **sama** — hanya chrome beda.
Tidak perlu ubah service/API (sudah teruji).

### Langkah 2 (M15 polish) — audit menyeluruh
Tinjau ulang `DesktopOnly` di TikZ Studio dll; ganti yang bisa, pertahankan
hanya bila interaksi **benar-benar tak masuk akal** di sentuh (mis. kanvas
gambar presisi).

### Langkah 3 — perbarui aturan proyek
`CONSTRAINTS.md` & `RENCANA-UI-MOBILE.md`: ganti "Pola D desktop-saja" menjadi
"**Pola D′ — Sheet responsif**" dengan `DesktopOnly` sebagai **pengecualian
terakhir**, bukan default.

## 5. Keputusan yang dibutuhkan

| Opsi | Isi | Kapan |
|------|-----|-------|
| **A** | Terima `DesktopOnly` sekarang; ganti di **M15** | Lanjut cepat ke M8 |
| **B** | Ganti **sekarang** (Sheet mobile) untuk penyusun paket | Konsisten best practice |
| **C** | Tetap permanen `DesktopOnly` | Hanya bila disetujui sadar |

> Catatan: Opsi A/B **tidak mengubah** service/API/database — hanya komponen UI.
> Jadi tak ada risiko ke data & tes (312 tes tetap hijau).

---
*Dokumen hidup — hasil riset 2026-09-30: shadcn docs (Sheet/Dialog), panduan
mobile-first, pola "Sheet for mobile, Dialog for desktop".*
