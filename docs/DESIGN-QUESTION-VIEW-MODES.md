# DESIGN-QUESTION-VIEW-MODES.md — Rancangan View Modes Bank Soal (Linear-Style)

> **Status:** 📝 Proposal Desain & Cetak Biru Kode (2026-10-01)  
> **Ruang Lingkup:** Rute `/questions` (`QuestionBankView`), komponen `QuestionCard`, dan `ViewModeToggle`.  
> **Tujuan:** Menyempurnakan presentasi butir soal pada mode **List**, **Grid (Symmetric)**, dan **Masonry (Dynamic Columns)** dengan estetika *Linear-tier* yang bersih, minim kebisingan teks, responsif, dan tahan terhadap variasi panjang soal matematika.

---

## 1. Latar Belakang & Masalah Desain Saat Ini

Berdasarkan audit antarmuka pada rute `/questions`:
1. **Mode Grid & Masonry Belum Berbentuk Kartu:**  
   Komponen `QuestionCard` saat ini mengasumsikan mode list (`border-b border-border px-4 py-3`). Saat berganti ke mode `grid` atau `masonry`, butir soal tampil sebagai baris mengambang dengan garis bawah yang terpotong aneh, bukan sebagai kartu mandiri (*self-contained card/bento cell*).
2. **Kepadatan Teks di Bagian Atas (*Header Noise*):**  
   Header kartu memuat banyak teks verbal bertumpuk (*"Kelas 11 SMA"*, *"C4 · Penalaran"*, *"Tingkat Kesulitan"*, *"●●●○○ Lv.3"*) yang menghabiskan ruang vertikal dan mengaburkan esensi naskah soal.
3. **Anomali Ketinggian Soal Panjang pada Mode Grid:**  
   Ketika ada soal dengan stimulus teks panjang atau banyak rumus KaTeX, layout grid simetris rentan menghasilkan *whitespace* kosong yang canggung pada kartu di sebelahnya jika tidak menerapkan strategi pemotongan (*clamping*) yang disiplin.

---

## 2. Filosofi & Tiga Dials Desain (`design-taste-frontend`)

Mengadopsi bahasa desain **Linear-style Dark Precision**:
* **`DESIGN_VARIANCE: 5`** *(Keteraturan grid yang presisi, estetika fungsional khas devtool)*
* **`MOTION_INTENSITY: 3`** *(Transisi mikro instan tanpa animasi bouncing yang mengganggu)*
* **`VISUAL_DENSITY: 4`** *(Informasi padat namun bernapas; teks panjang dipindahkan ke hover tooltip)*

### Prinsip Permukaan & Kedalaman (Surface & Depth)
* **Dark OLED Base:** Background kanvas `#08090c` / `oklch(0.145 0 0)` dengan kartu bertekstur matte `#101217` (`bg-card/60`).
* **Hairline Borders:** Garis tepi 1px halus `border-white/[0.07]` (dark) atau `border-border/70` (light) yang berubah tegas menjadi `border-white/[0.18]` saat di-hover.
* **Inner Specular Highlight:** Sentuhan kedalaman *machined hardware* dengan `shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]`.
* **Selection Glow:** Kartu terpilih mendapatkan border indigo tegas (`border-indigo-500/70`) dengan subtle outer glow (`shadow-[0_0_0_1px_rgba(99,102,241,0.3)]`).

---

## 3. Strategi Tiga Mode Tampilan

```
                   ┌───────────────────────────────────────────────┐
                   │             VIEW MODE SELECTOR                │
                   └──────┬────────────────┬───────────────┬───────┘
                          │                │               │
                          ▼                ▼               ▼
                   ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
                   │  MODE LIST   │ │  MODE GRID   │ │ MODE MASONRY │
                   └──────────────┘ └──────────────┘ └──────────────┘
                    • Tracking       • Simetris     • Asimetris
                    • Scan Cepat     • Equal-Height • Teks Utuh
                    • Padat          • Clamped      • Alami
```

### A. Mode List (Linear Issue Tracker Style)
* **Karakter:** Baris horizontal padat dengan kolom terstruktur rapi.
* **Kolom:** Checkbox seleksi → Kode ID (`#2401`) → Status Ring → Iconic Taxonomy Chips (`11`, `C4`, `●●●○○`) → Cuplikan Soal KaTeX → Kunci / Tipe Soal → Penelaah.
* **Interaksi Seleksi:** Garis aksen vertikal kiri (`border-l-2 border-l-indigo-500 bg-indigo-500/5`).

### B. Mode Grid (Symmetric Equal-Height Bento)
* **Karakter:** Kartu bersudut presisi dengan ketinggian seragam (`h-[300px]` atau `min-h-[300px] flex flex-col justify-between`).
* **Penanganan Soal Panjang:** 
  - Batang soal dibatasi maksimal 3–4 baris (`line-clamp-3`).
  - Diberikan batas ketinggian aman untuk preview rumus KaTeX.
  - Opsi jawaban ditampilkan dalam kisi mini 2-kolom ringkas.
* **Tujuan:** Pengguna yang menyukai keteraturan visual dan scanning kartu secara tertib.

### C. Mode Masonry (Multi-Column Dynamic Balancing)
* **Karakter:** Layout multi-kolom alami (`columns-1 sm:columns-2 xl:columns-3 [column-fill:_balance]`).
* **Penanganan Soal Panjang:**
  - **Tanpa pemotongan teks:** Soal sepanjang apa pun (stimulus kontekstual, tabel wacana, rumus integral bertingkat) dirender secara penuh.
  - Kartu di bawahnya langsung menyusul naik secara rapat (*gapless*), tanpa meninggalkan ruang kosong di kartu sampingnya.
* **Pencegahan Glitch:** Wajib menyertakan `[&>*]:break-inside-avoid [&>*]:transform-gpu` agar rumus KaTeX tidak terbelah di batas kolom.

---

## 4. Iconic Header & Micro-Tooltip Architecture

Untuk mengatasi kepadatan di bagian atas kartu, seluruh teks verbal panjang diganti dengan **Micro-Glyph Pills (tinggi 20–22px)**:

| Unsur Metadata | Tampilan Default (Iconic) | Isi Saat Di-hover (Tooltip Floating) |
| :--- | :--- | :--- |
| **Status Soal** | Lingkaran ikon mikro (Hijau = Siap, Kuning = Draf, Biru = Ditelaah) | `Status: Siap (Siap diterbitkan & dipakai)` |
| **ID Soal** | `#2401` (`font-mono text-xs`) | Tautan langsung / Salin ID |
| **Jenjang Kelas** | Chip `11` atau `12` | `Jenjang: Kelas 11 SMA` |
| **Taksonomi Bloom**| Chip `C4`, `C3`, `C5` | `Taksonomi Bloom: C4 · Penalaran & Analisis` |
| **Tingkat Kesulitan**| Meter titik `●●●○○` | `Tingkat Kesulitan: Level 3 dari 5 (Sedang)` |
| **Fitur Khusus** | Ikon mini TikZ (gambar), Flame (HOTS), atau Pensil (Esai) | `Soal HOTS / Dilengkapi Vektor TikZ` |

---

## 5. Cetak Biru Kode Implementasi

### 5.1 Penyesuaian `ViewModeToggle` & `modeClass`
Berkas: `src/components/questions/view-mode-toggle.tsx`

```tsx
export type ViewMode = "list" | "grid" | "masonry";

export function modeClass(mode: ViewMode): string {
  switch (mode) {
    case "grid":
      return "grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3";
    case "masonry":
      return "columns-1 gap-4 p-4 sm:columns-2 xl:columns-3 [column-fill:_balance] [&>*]:mb-4 [&>*]:break-inside-avoid [&>*]:transform-gpu";
    case "list":
    default:
      return "divide-y divide-border/60 rounded-xl border border-border/70 bg-card/40 overflow-hidden shadow-xs";
  }
}
```

### 5.2 Komponen `QuestionCard` Adaptif
Berkas: `src/components/questions/question-card.tsx`

```tsx
interface QuestionCardProps {
  question: PublicQuestion;
  href: string;
  mode?: ViewMode;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}

export function QuestionCard({
  question: q,
  href,
  mode = "list",
  selected = false,
  onToggleSelect,
}: QuestionCardProps) {
  const isCard = mode === "grid" || mode === "masonry";

  if (!isCard) {
    // ================= MODE LIST (LINEAR ROW) =================
    return (
      <div
        className={cn(
          "group relative flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/30 cursor-pointer",
          selected && "bg-brand/5 border-l-2 border-l-brand"
        )}
      >
        {onToggleSelect && (
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect(q.id)}
            aria-label="Pilih soal"
            className="size-4 shrink-0 rounded border-border accent-brand"
          />
        )}

        <span className="w-16 shrink-0 font-mono text-xs font-semibold text-muted-foreground group-hover:text-foreground">
          #{q.id.slice(0, 6)}
        </span>

        {/* Status Ring */}
        <StatusRing status={q.status} />

        {/* Iconic Taxonomy Pills */}
        <div className="flex w-36 shrink-0 items-center gap-1.5">
          <GradeChip grade={q.grade} />
          <CognitiveChip level={q.cognitiveLevel} />
          <DifficultyChip level={q.difficulty} />
        </div>

        {/* Excerpt */}
        <Link href={href} className="flex-1 min-w-0 px-2 truncate block">
          <span className="text-xs text-foreground/90 truncate block">
            <MathContent content={excerpt(q.contentMarkdown, 120)} />
          </span>
        </Link>

        {/* Key / Type */}
        <div className="w-24 shrink-0 text-center">
          <span className="rounded px-2 py-0.5 font-mono text-[10px] font-medium bg-muted text-muted-foreground border border-border">
            {TYPE_LABELS[q.questionType] ?? q.questionType}
          </span>
        </div>

        {/* Reviewer / Meta */}
        <div className="w-24 shrink-0 text-right font-mono text-[11px] text-muted-foreground truncate">
          {q.sourceId ?? "Mandiri"}
        </div>
      </div>
    );
  }

  // ================= MODE GRID & MASONRY (CARD) =================
  return (
    <article
      className={cn(
        "group relative flex flex-col rounded-xl border border-border/70 bg-card/60 p-4 transition-all duration-150",
        "hover:border-border hover:bg-card hover:shadow-xs",
        "dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
        mode === "grid" && "h-[310px] justify-between",
        selected && "border-brand/70 bg-brand/5 ring-1 ring-brand/30"
      )}
    >
      <div>
        {/* ICONIC TOP BAR */}
        <div className="mb-3 flex items-center justify-between border-b border-border/50 pb-2.5">
          <div className="flex items-center gap-1.5">
            <StatusRing status={q.status} />
            <span className="font-mono text-xs font-semibold text-muted-foreground px-1">
              #{q.id.slice(0, 6)}
            </span>
            <GradeChip grade={q.grade} />
            <CognitiveChip level={q.cognitiveLevel} />
            <DifficultyChip level={q.difficulty} />
          </div>

          {onToggleSelect && (
            <input
              type="checkbox"
              checked={selected}
              onChange={() => onToggleSelect(q.id)}
              aria-label="Pilih soal"
              className={cn(
                "size-4 shrink-0 rounded border-border accent-brand cursor-pointer transition-opacity",
                selected ? "opacity-100" : "opacity-30 group-hover:opacity-100"
              )}
            />
          )}
        </div>

        {/* STIMULUS (JIKA ADA) */}
        {q.parent && (
          <div className="mb-2.5 rounded-lg border border-border/60 bg-muted/20 p-2 text-xs text-muted-foreground">
            <span className="mb-1 block font-mono text-[10px] font-medium uppercase tracking-wider text-foreground/80">
              Wacana Stimulus:
            </span>
            <MathContent content={excerpt(q.parent.contentMarkdown, 90)} />
          </div>
        )}

        {/* QUESTION CONTENT */}
        <Link href={href} className="block">
          <div className={cn("text-xs leading-relaxed text-foreground", mode === "grid" && "line-clamp-3")}>
            <MathContent content={q.contentMarkdown} />
          </div>
        </Link>

        {/* OPTIONS PREVIEW */}
        {q.options.length > 0 && (
          <div className={cn(
            "mt-3 border-t border-border/50 pt-2 text-xs",
            mode === "grid" ? "grid grid-cols-2 gap-1.5" : "space-y-1"
          )}>
            {q.options.slice(0, mode === "grid" ? 4 : undefined).map((o) => (
              <div
                key={o.id}
                className={cn(
                  "flex items-center justify-between rounded p-1 text-muted-foreground",
                  o.isCorrect && "bg-success/10 border border-success/20 text-foreground font-medium"
                )}
              >
                <span className="truncate">
                  <strong className={cn("font-mono", o.isCorrect ? "text-success" : "text-muted-foreground")}>
                    {o.label}.
                  </strong>{" "}
                  <MathContent content={excerpt(o.contentMarkdown, 40)} />
                </span>
                {o.isCorrect && (
                  <span className="ml-1 rounded font-mono text-[9px] text-success">KUNCI</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* FOOTER */}
      <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-2 text-[11px] font-mono text-muted-foreground">
        <span>{q.sourceId ?? "Bank Utama"}</span>
        <Link href={href} className="hover:text-foreground">
          Buka ↗
        </Link>
      </div>
    </article>
  );
}
```

### 5.3 Micro-Chips dengan Tooltip (Iconic Helper)
```tsx
function CognitiveChip({ level }: { level: string }) {
  const rubric = cognitiveRubric(level);
  return (
    <Tooltip>
      <TooltipTrigger render={
        <span className="inline-flex h-5 items-center justify-center rounded px-1.5 font-mono text-[11px] bg-muted/60 border border-border text-muted-foreground hover:text-foreground cursor-pointer">
          {rubric.code}
        </span>
      } />
      <TooltipContent>
        <p className="font-semibold">{rubric.code} · {rubric.title}</p>
        <p className="text-xs opacity-90">{rubric.description}</p>
      </TooltipContent>
    </Tooltip>
  );
}
```

---

## 6. Floating Action Dock (Linear Command Bar)

Saat ada butir yang dipilih (`selected.size > 0`), toolbar aksi massal di [question-bank-view.tsx](file:///home/hari/projects/mathbank/src/components/questions/question-bank-view.tsx) bertransformasi menjadi **Floating Island Dock**:

```tsx
<div className="fixed bottom-6 inset-x-0 flex justify-center z-50 pointer-events-none">
  <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-border/80 bg-popover/85 px-4 py-2 shadow-2xl backdrop-blur-md">
    <div className="flex items-center gap-2 pr-2 border-r border-border">
      <span className="size-2 rounded-full bg-brand animate-pulse" />
      <span className="text-xs font-semibold">{selected.size} terpilih</span>
    </div>

    <div className="flex items-center gap-1.5">
      <Button size="sm" className="rounded-full h-7 text-xs gap-1.5" onClick={() => runBulk("set_ready")}>
        Setujui <kbd className="font-mono text-[10px] bg-brand-fg/20 px-1 rounded">A</kbd>
      </Button>
      <Button variant="outline" size="sm" className="rounded-full h-7 text-xs gap-1.5" onClick={() => runBulk("reject_to_draft")}>
        Tolak <kbd className="font-mono text-[10px] bg-muted px-1 rounded">R</kbd>
      </Button>
      <Button variant="outline" size="sm" className="rounded-full h-7 text-xs gap-1.5" onClick={() => runBulk("archive")}>
        Arsip <kbd className="font-mono text-[10px] bg-muted px-1 rounded">E</kbd>
      </Button>
      <Button variant="ghost" size="sm" className="rounded-full h-7 text-xs" onClick={clearSelection}>
        Batal <kbd className="font-mono text-[10px] text-muted-foreground">Esc</kbd>
      </Button>
    </div>
  </div>
</div>
```

---

## 7. Rencana Verifikasi Mutu & Kepatuhan Batas CONSTRAINTS.md

1. **Aturan React & React Compiler (CONSTRAINTS #6):**  
   Tidak menambahkan `useMemo` atau `useCallback` manual pada kartu atau komponen wrapper.
2. **Keamanan KaTeX & MathContent (CONSTRAINTS #12):**  
   Pembungkus rumus tetap mempertahankan `overflow-x-auto` agar rumus lebar tidak memecah layout kartu.
3. **Sentuhan Mobile ≥ 44px (CONSTRAINTS #11):**  
   Touch target tombol aksi dan seleksi pada layar mobile diperluas dengan padding tersembunyi (`after:absolute after:-inset-2`).
4. **Verifikasi Bebas Eror:**  
   Menjamin `pnpm check` tetap exit 0 (0 type error, 0 lint error, dan seluruh tes coverage lulus).

---

## 8. Arsitektur Filter Linear (Menghilangkan "Double Sidebar")

### 8.1 Masalah "Double Sidebar" di Halaman Saat Ini
Pada implementasi live saat ini (`b.iyo.my.id/questions`), pengguna disajikan **dua sidebar vertikal sekaligus** di desktop:
1. `AppSidebar` shadcn di sisi paling kiri (lebar ~220px).
2. Filter sidebar permanen di dalam `QuestionBankView` (`w-64` / 256px).

Akibatnya, pada resolusi laptop standar (1366–1440px), hampir **500px** layar habis terpotong hanya untuk menu navigasi dan checklist filter statis. Ruang untuk kartu soal menjadi terhimpit sempit, membuat mode Grid dan Masonry terasa sesak dan rumus matematika terpotong.

### 8.2 Solusi: Linear Compound Horizontal Filter Bar
Menghilangkan sidebar filter vertikal kedua, dan memindahkannya menjadi **Linear Horizontal Filter Bar** di atas kanvas:
* **Struktur Toolbar:**
  - `Input Cari (⌘K)` selebar 260px.
  - Pembagi vertikal 1px.
  - Deretan **Filter Pills** interaktif:
    - `[• Status: Siap ▾]`
    - `[Kelas: 11 SMA ▾]`
    - `[Kognitif ▾]`
    - `[Kesulitan ▾]`
    - `[Topik ▾]`
    - Tombol `Reset (N) ×` yang hanya muncul bila ada filter aktif.
* **Mekanisme Popover:** Setiap filter pill membuka popover mengambang (*floating popover*) di bawah tombol, lengkap dengan pencarian mikro dan multi-select toggle.
* **Manfaat Utama:**
  - Area kartu soal mendapatkan ruang horizontal **100% penuh** (`max-w-[1520px]`).
  - Mode Masonry 3-kolom dan Grid 3-kolom dapat bernapas lega dengan padding kartu yang lapang.
  - Soal wacana panjang (seperti stimulus pemodelan kalkulus) mengalir secara estetik tanpa layout cramming.

### 8.3 Searchable Combobox Popover (Solusi untuk Data Berjumlah Banyak)
Atribut dengan banyak entri tidak dijejalkan dalam satu panel raksasa, melainkan menggunakan **Searchable Combobox Dropdown mandiri** per tombol atribut di toolbar:

1. **Jenjang Kelas (12 Entri: SD 1–6, SMP 7–9, SMA 10–12):**
   - Mengklik tombol `[Kelas ▾]` membuka popover combobox ramping (lebar 300px).
   - Di bagian atas: Input pencarian otomatis fokus (`"Cari jenjang: mis. SMA, 11, SMP..."`).
   - Opsi dikelompokkan secara logis:
     - `SMA / MA / SMK` (Kelas 10, 11, 12 + jumlah soal)
     - `SMP / MTs` (Kelas 7, 8, 9 + jumlah soal)
     - `SD / MI` (Kelas 1 s/d 6)
   - Multi-select centang cepat dengan ringkasan badge di toolbar: `[Kelas: 11, 12 SMA (2)]`.

2. **Topik Matematika (Hierarki Puluhan s/d Ratusan Cabang Materi):**
   - Mengklik tombol `[Topik ▾]` membuka combobox dengan input fuzzy search.
   - Guru cukup mengetik *"trigo"* atau *"kuadrat"*, hasil langsung terfilter secara instan beserta hierarki pohonnya (*Trigonometri Analitik → Sudut Ganda*).

3. **Sumber / Institusi (Puluhan Asal Soal):**
   - Mengklik tombol `[Sumber ▾]` memunculkan popover dengan pencarian buku/penerbit/ujian (*UTBK SNBT, SIMAK UI, Bintang Pelajar, Kemdikbud*).

4. **Atribut Ringkas (Status, Tipe Soal, Bloom, Kesulitan):**
   - Menggunakan micro-pill selector cepat yang tidak memerlukan pencarian teks, tetapi tetap berbentuk popover mengambang berdimensi kompak.

### 8.4 Solusi Hibrida: Slide-Over Filter Drawer (Hanya Muncul Saat Dipencet)
Sebagai alternatif yang sangat ramah bagi guru yang ingin melihat seluruh kategori secara komprehensif tanpa memotong layar secara permanen:

1. **Toolbar Atas Berisi Tombol Utama & Active Tags:**
   - Tombol `[🎛️ Filter Lengkap (3)]` bersanding dengan tag filter aktif (`[Status: Siap ×]`, `[Kelas: 11 ×]`).
   - Secara default, kanvas kartu soal **100% penuh dan luas**.

2. **Saat Tombol Filter Dipencet (Toggle On-Demand):**
   - Panel samping kiri meluncur keluar secara halus (*Slide-Over Drawer* lebar 340px) dengan efek kaca gelap (*dark frosted glass*).
   - **Hierarki Urutan Isi Panel (Berbasis Frekuensi Pemakaian Guru):**
     1. **Topik Pokok (Paling Atas & Utama):** Dilengkapi input pencarian cepat instan (*"Ketik topik: Trigo, Aljabar, Turunan..."*) dan daftar hierarki dengan penghitung butir soal.
     2. **Jenjang Kelas:** Tombol grid kompak untuk SMA (10, 11, 12) & SMP (7, 8, 9), serta toggle collapsible untuk SD (1–6).
     3. **Taksonomi Bloom & Tingkat Kesulitan:** Disusun berdampingan (*side-by-side*) secara kompak tanpa membuang tinggi baris.
     4. **Sumber Bank:** Dropdown pilihan institusi/asal bank soal.
     5. **Status Alur Soal (Ramping di Bagian Bawah):** Disederhanakan menjadi *segmented pill 1-baris* hemat ruang (`[Semua] [• Siap] [• Draf] [• Telaah]`), tidak mendominasi dan tidak memakan ruang vertikal berharga.
   - Dilengkapi tombol *"Reset"* dan *"Terapkan Filter (N)"*.

3. **Saat Tombol 'Terapkan' atau '✕' Diklik:**
   - Panel meluncur kembali menutup ke kiri.
   - Kanvas kartu soal langsung kembali melebar penuh tanpa hambatan layout.

---

## 9. Catatan untuk Software Engineer: Agenda Diskusi Sebelum Implementasi

> ⚠️ **PENTING UNTUK PROGRAMMER / SOFTWARE ENGINEER:**  
> Sebelum mengeksekusi perubahan kode pada bagian filter di `src/components/questions/question-bank-view.tsx`, **WAJIB mendiskusikan dan menyelaraskan detail implementasi bagian-bagian filter terlebih dahulu bersama product owner / tim.**

Berikut poin-poin agenda diskusi yang harus disepakati sebelum coding:

1. **Pemilihan Pola Filter Antara Dua Alternatif:**
   - **Opsi 1 (Searchable Combobox di Atas):** Cocok bila pengguna menginginkan filtering cepat 1–2 atribut langsung dari toolbar tanpa membuka panel.
   - **Opsi 2 (Slide-Over Drawer dari Kiri):** Cocok bila pengguna ingin melihat seluruh katalog filter sekaligus secara vertikal hanya saat tombol ditekan (tetap menjaga kanvas soal 100% penuh saat ditutup).
2. **Prioritas & Penataan Bagian Filter (*Field Priority*):**
   - **Topik Pokok:** Wajib diletakkan di paling atas dengan pencarian teks mikro (*fuzzy search*) karena merupakan filter paling sering dipakai guru.
   - **Jenjang Kelas:** Pemisahan kelompok SMA (10–12), SMP (7–9), dan SD (1–6) agar 12 kelas tidak memanjang ke bawah.
   - **Status Soal:** Dilarang menggunakan checklist vertikal besar di bagian atas. Status wajib dirampingkan (misal: *segmented pill 1-baris* di bagian bawah) agar tidak memboroskan ruang vertikal.
   - **Taksonomi Bloom & Kesulitan:** Dibuat berdampingan (*side-by-side*) secara horizontal.
3. **Integritas URL SearchParams (State Bookmarkable):**
   - Memastikan transisi dari sidebar saat ini ke popover/drawer tetap menjaga sinkronisasi parameter URL (`?topicId=...&grade=...&status=...`) via `router.replace` tanpa refresh halaman penuh.
4. **Penyelarasan Responsif Mobile:**
   - Menyelaraskan `<Sheet>` mobile saat ini dengan drawer desktop baru agar kode filter logic (`filterContent`) tetap *single source of truth* dan mudah dirawat.

---

## 10. Gambaran Kode Implementasi Komponen Filter (React & Tailwind)

Berikut adalah cetak biru kode komponen konkret yang dapat langsung dipakai atau diadaptasi oleh programmer.

### 10.1 Komponen Panel Filter: `QuestionFilterDrawer.tsx`
Berkas: `src/components/questions/question-filter-drawer.tsx`

```tsx
"use client";

import { useState } from "react";
import { X, Search, BookOpen, Layers, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { TopicReference, SourceReference, GradeReference } from "@/lib/hooks/use-reference";

export interface FilterState {
  topicId: string[];
  grade: string[];
  difficulty: number[];
  cognitiveLevel: string[];
  status?: string;
  sourceId?: string;
}

interface QuestionFilterDrawerProps {
  open: boolean;
  onClose: () => void;
  filters: FilterState;
  topics: TopicReference[];
  grades: GradeReference[];
  sources: SourceReference[];
  onToggleTopic: (id: string) => void;
  onToggleGrade: (id: string) => void;
  onToggleDifficulty: (level: number) => void;
  onToggleCognitive: (level: string) => void;
  onSelectStatus: (status: string | null) => void;
  onSelectSource: (sourceId: string | null) => void;
  onReset: () => void;
  totalFiltered: number;
}

export function QuestionFilterDrawer({
  open,
  onClose,
  filters,
  topics,
  grades,
  sources,
  onToggleTopic,
  onToggleGrade,
  onToggleDifficulty,
  onToggleCognitive,
  onSelectStatus,
  onSelectSource,
  onReset,
  totalFiltered,
}: QuestionFilterDrawerProps) {
  const [topicSearch, setTopicSearch] = useState("");
  const [showSD, setShowSD] = useState(false);

  if (!open) return null;

  // Filter topik instan
  const needle = topicSearch.trim().toLowerCase();
  const filteredTopics = needle
    ? topics.filter((t) => t.name.toLowerCase().includes(needle))
    : topics;

  // Segmentasi kelas
  const smaGrades = ["10", "11", "12"];
  const smpGrades = ["7", "8", "9"];
  const sdGrades = ["1", "2", "3", "4", "5", "6"];

  return (
    <aside
      aria-label="Panel Filter Soal"
      className={cn(
        "fixed inset-y-0 left-0 z-50 flex w-[340px] flex-col justify-between border-r border-border/80",
        "bg-popover/95 backdrop-blur-xl shadow-2xl transition-transform duration-200 ease-out"
      )}
    >
      {/* 1. HEADER DRAWER */}
      <div className="flex items-center justify-between border-b border-border/60 p-4">
        <div className="flex items-center gap-2">
          <Layers className="size-4 text-brand" />
          <h3 className="font-semibold text-sm tracking-tight text-foreground">Filter Parameter</h3>
        </div>
        <Button variant="ghost" size="icon-xs" onClick={onClose} aria-label="Tutup Filter">
          <X className="size-4" />
        </Button>
      </div>

      {/* 2. SCROLLABLE FILTER GROUPS */}
      <div className="flex-1 space-y-4 overflow-y-auto p-4 text-xs">

        {/* ================= A. TOPIK POKOK (PRIORITAS #1 - PALING ATAS) ================= */}
        <div>
          <div className="mb-1.5 flex items-center justify-between font-mono text-[10px] font-bold uppercase tracking-wider text-brand">
            <span className="flex items-center gap-1.5">
              <BookOpen className="size-3.5" />
              Topik Pokok
            </span>
            {filters.topicId.length > 0 && (
              <span className="font-normal text-brand/80">{filters.topicId.length} dipilih</span>
            )}
          </div>

          {/* Kotak Cari Cepat Topik */}
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={topicSearch}
              onChange={(e) => setTopicSearch(e.target.value)}
              placeholder="Ketik topik (mis. Trigo, Aljabar)..."
              className="h-8 pl-8 text-xs bg-muted/30"
            />
          </div>

          {/* Daftar Topik Scrollable */}
          <div className="max-h-36 space-y-0.5 overflow-y-auto pr-1">
            {filteredTopics.length === 0 ? (
              <p className="px-2 py-3 text-center text-xs text-muted-foreground">Topik tidak ditemukan.</p>
            ) : (
              filteredTopics.map((t) => {
                const checked = filters.topicId.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onToggleTopic(t.id)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-xs transition-colors",
                      checked
                        ? "bg-brand/15 text-brand font-medium border border-brand/30"
                        : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                    )}
                  >
                    <span className="truncate">{t.name}</span>
                    {checked && <Check className="size-3.5 shrink-0 text-brand" />}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ================= B. JENJANG KELAS (BERKELOMPOK) ================= */}
        <div className="border-t border-border/50 pt-3">
          <div className="mb-1.5 flex items-center justify-between font-mono text-[10px] font-semibold uppercase text-muted-foreground">
            <span>Jenjang Kelas</span>
          </div>

          {/* SMA */}
          <div className="mb-1 flex justify-between font-mono text-[10px] text-muted-foreground/80">
            <span>SMA / SMK</span>
            <span>Fase F</span>
          </div>
          <div className="mb-2 grid grid-cols-3 gap-1">
            {smaGrades.map((g) => {
              const active = filters.grade.includes(g);
              return (
                <button
                  key={g}
                  type="button"
                  onClick={() => onToggleGrade(g)}
                  className={cn(
                    "rounded-md py-1 font-mono text-xs transition-colors",
                    active
                      ? "bg-brand/20 text-brand font-bold border border-brand/40"
                      : "bg-muted/30 text-muted-foreground hover:bg-muted hover:text-foreground border border-border/60"
                  )}
                >
                  {g} {active ? "✓" : ""}
                </button>
              );
            })}
          </div>

          {/* SMP */}
          <div className="mb-1 flex justify-between font-mono text-[10px] text-muted-foreground/80">
            <span>SMP / MTs</span>
            <span>Fase D</span>
          </div>
          <div className="mb-2 grid grid-cols-3 gap-1">
            {smpGrades.map((g) => {
              const active = filters.grade.includes(g);
              return (
                <button
                  key={g}
                  type="button"
                  onClick={() => onToggleGrade(g)}
                  className={cn(
                    "rounded-md py-1 font-mono text-xs transition-colors",
                    active
                      ? "bg-brand/20 text-brand font-bold border border-brand/40"
                      : "bg-muted/30 text-muted-foreground hover:bg-muted hover:text-foreground border border-border/60"
                  )}
                >
                  {g} {active ? "✓" : ""}
                </button>
              );
            })}
          </div>

          {/* SD Collapsible */}
          <button
            type="button"
            onClick={() => setShowSD(!showSD)}
            className="flex w-full items-center justify-between py-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            <span>Jenjang SD / MI (Kelas 1–6)</span>
            <span className="font-mono text-xs">{showSD ? "−" : "+"}</span>
          </button>
          {showSD && (
            <div className="mt-1.5 grid grid-cols-6 gap-1">
              {sdGrades.map((g) => {
                const active = filters.grade.includes(g);
                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() => onToggleGrade(g)}
                    className={cn(
                      "rounded-md py-1 font-mono text-xs transition-colors",
                      active
                        ? "bg-brand/20 text-brand font-bold border border-brand/40"
                        : "bg-muted/30 text-muted-foreground hover:bg-muted hover:text-foreground border border-border/60"
                    )}
                  >
                    {g}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ================= C. BLOOM & KESULITAN (BERDAMPINGAN) ================= */}
        <div className="border-t border-border/50 pt-3">
          <div className="grid grid-cols-2 gap-3">
            {/* Bloom C1-C6 */}
            <div>
              <span className="mb-1 block font-mono text-[10px] font-semibold uppercase text-muted-foreground">
                Bloom
              </span>
              <div className="grid grid-cols-3 gap-1 font-mono text-[10px]">
                {["C1", "C2", "C3", "C4", "C5", "C6"].map((code) => {
                  const active = filters.cognitiveLevel.includes(code);
                  return (
                    <button
                      key={code}
                      type="button"
                      onClick={() => onToggleCognitive(code)}
                      className={cn(
                        "rounded py-1 transition-colors border",
                        active
                          ? "bg-brand/20 text-brand font-bold border-brand/40"
                          : "bg-muted/30 text-muted-foreground border-border/50 hover:bg-muted"
                      )}
                    >
                      {code}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Kesulitan Level 1-5 */}
            <div>
              <span className="mb-1 block font-mono text-[10px] font-semibold uppercase text-muted-foreground">
                Kesulitan
              </span>
              <div className="flex items-center gap-0.5 font-mono text-[10px]">
                {[1, 2, 3, 4, 5].map((lvl) => {
                  const active = filters.difficulty.includes(lvl);
                  return (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => onToggleDifficulty(lvl)}
                      className={cn(
                        "flex-1 rounded py-1 transition-colors border text-center",
                        active
                          ? "bg-gold/20 text-gold font-bold border-gold/40"
                          : "bg-muted/30 text-muted-foreground border-border/50 hover:bg-muted"
                      )}
                    >
                      {lvl}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* ================= D. SUMBER BANK ================= */}
        <div className="border-t border-border/50 pt-3">
          <span className="mb-1 block font-mono text-[10px] font-semibold uppercase text-muted-foreground">
            Sumber Bank Soal
          </span>
          <select
            value={filters.sourceId ?? ""}
            onChange={(e) => onSelectSource(e.target.value || null)}
            className="w-full rounded-md border border-border/80 bg-background px-2.5 py-1.5 text-xs text-foreground outline-none"
          >
            <option value="">Semua Sumber</option>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {/* ================= E. STATUS ALUR (RAMPING - SEGMENTED PILL 1-BARIS) ================= */}
        <div className="border-t border-border/50 pt-3">
          <span className="mb-1 block font-mono text-[10px] font-semibold uppercase text-muted-foreground">
            Status Alur Soal
          </span>
          <div className="flex items-center rounded-lg border border-border/70 bg-muted/30 p-0.5 text-[11px]">
            {[
              { val: null, label: "Semua" },
              { val: "ready", label: "Siap", dot: "bg-success" },
              { val: "draft", label: "Draf" },
              { val: "review", label: "Telaah" },
            ].map((item) => {
              const active = item.val === null ? !filters.status : filters.status === item.val;
              return (
                <button
                  key={String(item.val)}
                  type="button"
                  onClick={() => onSelectStatus(item.val)}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1 rounded-md py-1 transition-colors",
                    active
                      ? "bg-background text-foreground font-medium shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {item.dot && <span className={cn("size-1.5 rounded-full", item.dot)} />}
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

      </div>

      {/* 3. FOOTER DRAWER (RESET & TERAPKAN) */}
      <div className="flex items-center justify-between border-t border-border/60 bg-muted/10 p-4">
        <Button variant="ghost" size="sm" onClick={onReset} className="text-xs text-muted-foreground">
          Reset
        </Button>
        <Button size="sm" onClick={onClose} className="text-xs font-semibold gap-1.5">
          Terapkan Filter
          <span className="font-mono text-[11px] opacity-80">({totalFiltered})</span>
        </Button>
      </div>
    </aside>
  );
}
```

---

### 10.2 Komponen Toolbar dengan Active Filter Pills: `QuestionFilterBar.tsx`
Berkas: `src/components/questions/question-filter-bar.tsx`

```tsx
"use client";

import { Search, SlidersHorizontal, Plus } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ViewModeToggle, type ViewMode } from "@/components/questions/view-mode-toggle";
import { cn } from "@/lib/utils";

interface QuestionFilterBarProps {
  search: string;
  onSearchChange: (val: string) => void;
  onSubmitSearch: (e: React.FormEvent) => void;
  activeCount: number;
  onToggleDrawer: () => void;
  activePills: { label: string; onRemove: () => void }[];
  onResetAll: () => void;
  totalQuestions: number;
  mode: ViewMode;
  onModeChange: (m: ViewMode) => void;
}

export function QuestionFilterBar({
  search,
  onSearchChange,
  onSubmitSearch,
  activeCount,
  onToggleDrawer,
  activePills,
  onResetAll,
  totalQuestions,
  mode,
  onModeChange,
}: QuestionFilterBarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 bg-card/40 px-6 py-2.5">
      {/* Kiri: Search + Tombol Filter + Active Pills */}
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <form onSubmit={onSubmitSearch} className="relative w-52 shrink-0">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Cari naskah / rumus..."
            className="h-7.5 pl-8 pr-8 text-xs bg-muted/20"
          />
        </form>

        <span className="h-4 w-px bg-border/60 mx-1" aria-hidden />

        {/* Tombol Pembuka Drawer Filter */}
        <Button
          type="button"
          variant={activeCount > 0 ? "secondary" : "outline"}
          size="xs"
          onClick={onToggleDrawer}
          className={cn("h-7 gap-1.5 rounded-md px-2.5 text-xs", activeCount > 0 && "border-brand/40 text-brand")}
        >
          <SlidersHorizontal className="size-3 text-brand" />
          <span>Filter</span>
          {activeCount > 0 && (
            <span className="grid size-4 place-items-center rounded-full bg-brand text-[10px] font-bold text-brand-fg">
              {activeCount}
            </span>
          )}
        </Button>

        {/* Active Filter Pills yang bisa dihapus satu per satu */}
        {activePills.map((pill, idx) => (
          <span
            key={idx}
            className="inline-flex h-7 items-center gap-1.5 rounded-md border border-brand/30 bg-brand/10 px-2 text-xs text-brand"
          >
            <span>{pill.label}</span>
            <button
              type="button"
              onClick={pill.onRemove}
              className="text-brand/70 hover:text-brand"
              aria-label={`Hapus filter ${pill.label}`}
            >
              ×
            </button>
          </span>
        ))}

        {activeCount > 0 && (
          <Button variant="ghost" size="xs" onClick={onResetAll} className="h-7 text-xs text-muted-foreground">
            Reset
          </Button>
        )}
      </div>

      {/* Kanan: Total Soal + Mode Switcher (List/Grid/Masonry) + Buat Soal */}
      <div className="flex shrink-0 items-center gap-3">
        <span className="font-mono text-xs text-muted-foreground">{totalQuestions} soal</span>

        <ViewModeToggle value={mode} onChange={onModeChange} />

        <Button render={<Link href="/questions/new" />} nativeButton={false} size="xs" className="h-7 gap-1.5">
          <Plus className="size-3.5" />
          <span>Buat</span>
        </Button>
      </div>
    </div>
  );
}
```






