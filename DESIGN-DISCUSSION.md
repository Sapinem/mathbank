# DESIGN-DISCUSSION.md — Catatan Diskusi Detail (Bukan DESIGN.md)

> **Status:** Catatan diskusi, dibuat 2026-10-25. File ini MENYIMPAN hasil
> diskusi detail supaya tidak hilang saat `DESIGN.md` dipangkas kembali ke
> versi general.
> **Bukan dokumen kanonikal, bukan acuan fix.** Jangan mengikuti file ini
> mentah-mentah untuk mengubah kode. Keputusan yang berlaku untuk selera
> ada di `DESIGN.md` (versi general); file ini adalah jejak alasan,
> verifikasi kode, konflik yang ditolak, dan pertanyaan yang masih terbuka.
> **Sumber diskusi:** mockup redesign MathBank (5 layar), dokumen upload
> `workspace/user/files/DESIGN.md` (lineage axiom/mathcore/mathmyid, referensi
> diskusi saja, BUKAN otoritas fix), dan pengecekan kode repo saat diskusi.
> Kedua file ini lokal, untracked, belum di-commit/push.

## Ringkasan status poin

| Poin | Topik | Status |
|---|---|---|
| 1 | Framing workbench + dial kepadatan | Diterima |
| 2 | Peran tipografi (serif/sans/mono) | Diterima |
| 3 | Angka shell referensi | Dilewati dulu, bukan ditolak |
| 4 | Pola Bank Soal referensi (full-width, filter bertahap, view selector, debounce) | Ditolak |
| 5 | Data kosong bukan nol | Diterima |
| 6 | Checklist aksesibilitas tambahan | Diterima |
| 7 | Print first-class, token terpisah (prinsip saja) | Diterima |
| 8 | Warna inti MathBank, brand diperbanyak | Diterima dengan modifikasi |
| 9 | Warna taksonomi (domain, sekunder) | Diterima (prinsip saja, mapping belum dikunci) |
| 10 | Provenance Naskah/Mandiri/Wacana | Diterima (zona sekunder saja) |
| 11 | Tag/topik model WordPress | Diterima dengan klarifikasi; render tag detail/filter dulu saja |

## Poin 1 — Workbench (diterima)

Referensi: *technical authoring workbench* untuk guru, "meja typesetting,
bukan halaman marketing", dial variasi rendah, gerak rendah, kepadatan
tinggi. Diterima sebagai arah kualitatif saja; angka dial referensi
(variasi 3, gerak 2, kepadatan 6) TIDAK diadopsi sebagai skor/metrik repo.
Konsekuensi di DESIGN.md general: variasi komponen ditekan, transisi hanya
umpan balik fungsional, kepadatan adalah default.

## Poin 2 — Tipografi (diterima, memverifikasi kode)

Peran: matematika serif hanya lewat KaTeX, prosa/chrome sans, identifier
mono. Diverifikasi ke kode, bukan sekadar ikut referensi:
`src/app/layout.tsx` memakai `Roboto_Flex` sebagai `--font-sans` dan
`Roboto_Mono` sebagai `--font-roboto-mono` via `next/font/google`.
Referensi menyebut Roboto statis; yang ditulis di DESIGN.md adalah nama
repo (Roboto Flex), bukan nama referensi. Jangan pakai serif untuk prosa,
jangan pakai sans untuk matematika, jangan pakai mono untuk judul/label
biasa.

## Poin 3 — Angka shell (dilewati dulu)

Referensi: sidebar expanded 240px, collapsed 64px, drawer
`min(360px, 85vw)`, header 56px, item 44px, ikon 20px.
Kode MathBank saat diskusi: `SIDEBAR_WIDTH = 16rem` (256px),
`SIDEBAR_WIDTH_ICON = 3rem` (48px), mobile `18rem` (288px), header `h-14`
(56px). Jadi hanya header dan target sentuh yang cocok; expanded
referensi lebih sempit 16px (sejalan arah mockup "sidebar lebih sempit"),
collapsed referensi justru lebih lebar 16px, drawer lebih lebar.
Status: dilewati dulu, bukan ditolak. Angka ini boleh kembali dibahas;
jangan menulisnya di DESIGN.md general sebagai aturan sampai diputuskan.

## Poin 4 — Pola Bank Soal referensi (ditolak)

Isi referensi yang ditolak sebagai paket: area full-width tanpa cap
`max-w`, filter bertahap collapsible (primer: topik/tipe/status;
lanjutan tertutup), view selector lewat URL `?view=list|grid|table`,
pencarian live debounce 300ms, re-fetch server.
Verifikasi kode MathBank saat diskusi:
- Shell sudah tanpa cap `max-w` dan filter/mode sudah URL-driven
  (`question-bank-view.tsx`), tapi paramnya `mode` dengan nilai
  `list|grid|masonry`, bukan `view`/`list|grid|table`. Mengganti param
  akan memutus bookmark yang sudah ada.
- Filter sekarang: drawer slide-over + filter bar gabungan, bukan rail
  bertahap di desktop.
- Pencarian sekarang berbasis submit (`submitSearch` → `setParam("q", …)`),
  bukan live debounce. `setParam` memakai `router.replace` (tidak menumpuk
  riwayat back) dan menghapus `page` saat kunci selain `page` berubah.
  Clear sudah langsung mengirim pencarian kosong (PR #6).
- `useQuestions`: `staleTime` 30 detik, `placeholderData: prev`, halaman
  20 soal (`PAGE_SIZE = 20`).
Diskusi debounce (detail, bukan keputusan baru setelah penolakan):
- Live debounce 300ms: input tetap responsif (state lokal), URL/fetch
  jalan setelah jeda; mengetik cepat idealnya 1 request, mengetik pelan
  bisa 2–3 request. Lebih instan dari submit, lebih hemat dari live tanpa
  debounce.
- Keuntungan: tanpa klik/Enter tambahan, URL tetap bisa di-bookmark
  setelah jeda lewat `replace`, daftar lama tetap tampil lewat
  `placeholderData: prev`.
- Risiko spesifik MathBank: request naik vs submit, tiap hasil merender
  KaTeX untuk 20 baris; screen reader butuh pengumuman jumlah hasil
  lewat `aria-live` dan fokus tidak boleh dipindah; clear harus tetap
  langsung (bukan debounce) supaya tidak menampilkan daftar lama 300ms;
  salin URL di tengah mengetik bisa dapat URL lama; implementasi harus
  menghindari `useMemo`/`useCallback` di luar `components/ui/**`
  (aturan repo #6) — pakai `useEffect` + `setTimeout`/`useRef`.
- Varian yang sempat dibahas: tetap submit, live 300ms, live 500ms,
  hybrid (debounce + Enter/blur memaksa submit langsung).
Keputusan akhir poin 4: ditolak sebagai paket. Perilaku sekarang
(submit, drawer + filter bar, `mode`) tetap berlaku dan tidak ditulis
sebagai target baru di DESIGN.md general.

## Poin 5 — Data kosong bukan nol (diterima)

Aturan tiga keadaan untuk tampilan (bukan fallback internal perhitungan):
memuat = skeleton/placeholder jumlah; belum ada data/belum terhitung =
chip agregat dihilangkan, bukan 0; nol yang sudah terhitung (mis. bundle
terkonfirmasi 0 item) = boleh tampil 0. Ini memperluas aturan PR #6
(loading Bank Soal bukan "0 soal"). Sejalan dengan kode: Bank Soal saat
memuat menampilkan skeleton, dan `bundle-enrichment.tsx` mengembalikan
null bila tidak ada enrichment.

## Poin 6 — Aksesibilitas (diterima, dengan koreksi)

Yang ditambahkan ke checklist: fokus keyboard terlihat dan tidak dihapus
tanpa pengganti; gerak mengikuti reduced-motion; KaTeX `htmlAndMathml`;
field form berlabel terikat dan error lewat `aria-live`.
Verifikasi dan nuansa:
- Fokus sudah ada di komponen UI, tapi ketebalan ring tidak seragam
  (ring-2 vs ring-3 dengan opacity) — yang dikunci adalah prinsip
  visibilitasnya, bukan angka 2px yang kaku.
- Reduced-motion sudah ada di `globals.css`: gerak dikurangi drastis
  hingga hampir nol, dengan pengecualian indikator status (spinner)
  yang tetap terlihat. Kalimat poin 1 yang semula "mati total"
  diluruskan menjadi "dikurangi drastis, kecuali indikator status"
  supaya tidak bertentangan dengan kode.
- `htmlAndMathml` sudah ada dari Phase 4; `aria-live` sudah dipakai di
  filter bar.

## Poin 7 — Print first-class (diterima, prinsip saja)

Diterima hanya prinsipnya: print adalah permukaan first-class (ujung
alur merakit naskah, bukan modal), sumbu warna print terpisah dari token
UI sehingga tema layar tidak menggeser kertas, dan geometri print tetap
(tidak mengikuti breakpoint layar). Ini sejalan dengan
`docs/DESIGN_SYSTEM.md` §5 (body print putih/hitam, `@page` A4 portrait,
margin 15mm, `break-inside: avoid`, kunci di lembar terpisah) dan dengan
`printConfig` + kelas `.print-*` di `print.css`.
TIDAK diadopsi di poin ini dan tetap belum diputuskan: margin referensi
0,9/1/1,2/1 cm, ukuran font referensi (soal 11pt/pembahasan 10pt di 2
kolom, 12/11pt di 1 kolom), sistem template Kop/Header/Footer/watermark
dua brand, accent edge di margin box, dan target Chromium-only beserta
catatan print-color-adjust/background graphics. Detail print itu
termasuk kelompok "belum dibahas tuntas" di bawah.

## Poin 8 — Warna inti (diterima dengan modifikasi)

Keputusan: palet MathBank dipertahankan, palet referensi ditolak.
Referensi: biru `#2563EB` + slate + ramp taksonomi, dengan rasio
terverifikasi (mis. latar 17,06:1, muted-foreground 7,24:1, primary
5,17:1). Disiplin yang diambil dari referensi: token semantik saja,
rasio terverifikasi, dark mode mendefinisikan ulang semua token.
Paletnya ditolak karena mengganti identitas MathBank.

Palet MathBank (dari `scripts/theme/tokens.ts` dan
`src/styles/tokens/generated.css`, jangan sunting generated manual):
- Brand `#0158CA` → OKLCh terang 0,491/0,191/259, hover 0,431, teks di
  atasnya 0,985; gelap 0,631, teks di atasnya 0,13.
- Emas `#D5AC1E` → terang digelapkan 0,548 (emas asli tidak layak jadi
  teks di terang), gelap 0,76; teks emas gelap 0,205 di terang, 0,985 di
  gelap. Peran: "perlu perhatian / menunggu tindakan".
- Netral akromatik (chroma 0): terang latar putih, teks 0,145, teks
  redup 0,556, border 0,922; gelap latar 0,145, kartu 0,205, teks redup
  0,708, border 0,269. Dipertahankan akromatik, bukan slate bertint biru.
- Status universal: hue success 150, warning 85, error 27 (terang) /
  22 (gelap), info 250; nilai dirancang ≥ 4,5:1. Brand juga dipakai
  sebagai primary/fokus/ring sidebar lewat pemetaan di `globals.css`.

Modifikasi pengguna: **brand diperbanyak nanti, karena tampilan
sekarang terlalu netral.** Cakupannya dibatasi ke tempat bermakna:
navigasi aktif, filter aktif, item terpilih, link, aksi primer, penanda
tahap/progres. Tint brand (`bg-brand/5`, `/10`, `/15`) untuk permukaan
terpilih/aktif, brand solid hanya untuk aksi primer, logo, dan penanda
aktif tegas. Bukan latar kartu, gradien, hiasan, atau pengganti warna
status. Setiap layar utama harus punya minimal satu jangkar brand yang
jelas saat dibaca sekilas. Ini adalah arah implementasi nanti, bukan
perubahan kode yang sudah dilakukan.

Kesenjangan warna (target, bukan keadaan sekarang):
- Pemetaan status belum satu. Target kanonikal: badge detail — draf
  netral, telaah emas, siap success, arsip error dengan coret. Yang
  harus disatukan: kartu daftar (sekarang emerald/amber/sky Tailwind,
  bukan token) dan kontrak lama di `labels.ts` ("Siap = biru brand").
- Emas dipakai untuk banyak hal: flag, telaah, kesulitan level 3.
  Telaah sebagai "menunggu tindakan" masih konsisten dengan "perlu
  perhatian"; warna kesulitan dibahas di poin 9.

## Poin 9 — Warna taksonomi (diterima, prinsip saja)

Keputusan: kesulitan dan Bloom boleh punya warna domain tersendiri,
terpisah dari status/brand, tapi hanya sebagai pembawa sekunder.
Pembawa utama tetap titik/kode level, bentuk ikon, dan label lengkap di
tooltip/nama aksesibel. Warna harus diadaptasi ke token OKLCh MathBank
dan lolos `theme:check`, bukan disalin sebagai hex referensi. Level
tertinggi tidak boleh dibaca sebagai error (tanpa ikon/teks/perilaku
error yang menyertainya).
Pemetaan hue per level TIDAK dikunci di poin ini.
Keadaan sekarang: kesulitan memakai ulang token status (1 success,
2 info, 3 emas, 4 warning, 5 error) plus titik ●○ dan kode; Bloom
netral total (kode saja, badge `border-border bg-muted
text-muted-foreground`).
Ramp referensi (untuk referensi saja, bukan keputusan): kesulitan
1 emerald, 2 teal, 3 amber, 4 orange, 5 rose; Bloom C1 slate, C2 sky,
C3 teal, C4 violet, C5 amber, C6 rose — masing-masing teks, tint latar,
dan titik/meter solid.

## Poin 10 — Provenance sumber (diterima, zona sekunder)

Definisi (dari referensi, diadopsi sebagai konsep): Naskah = muncul di
≥ 1 bundle sebagai soal; Mandiri = tidak muncul di bundle mana pun;
Wacana = hanya muncul sebagai stimulus di semua bundle. Aturan campuran:
peran soal di sebagian bundle mengalahkan peran stimulus → Naskah.
Render: zona sekunder saja (footer kartu / halaman detail), BUKAN
pill baru di baris metadata ikon utama. Count hanya bila > 1 dan data
tersedia (mis. `Naskah (3)`). Warna tetap netral/redup untuk sekarang,
bukan biru/redup/ungu referensi; warna sumber belum diputuskan.
Peringatan pembeda: chip "Wacana" yang sudah ada di MathBank menandai
soal anak dari stimulus induk, sedangkan "Wacana" di sini menandai
peran bundle (hanya sebagai stimulus) — terkait tapi tidak identik,
jangan digabung sembarangan.
Keadaan sekarang: footer kartu menampilkan `sourceLabel` atau fallback
"Naskah"/"Mandiri"; belum ada komponen SourceBadge khusus, count bundle,
atau definisi peran bundle seperti di atas.
Detail referensi yang TIDAK diadopsi di poin ini: token mapping lengkap,
CVA variant map, audit kontras per badge (Naskah 6,16:1 / Mandiri
6,92:1 / Wacana 6,48:1 di terang; 5,74 / 9,85 / 5,87 di gelap), penanda
◈ khusus Wacana, dan penempatan "slot terakhir di baris badge".

## Poin 11 — Topik dan tag, model WordPress (diterima + klarifikasi)

Klarifikasi pengguna: penggunaan topik dan tag sama seperti WordPress,
walau backend sedikit beda.
- Topik = kategori WordPress: hierarkis 3 level (kategori → topik →
  subtopik), banyak per soal, satu primer (rank 1, penanda "Utama"),
  filter menelusuri keturunan. Di MathBank, `TopicTag` sudah memetakan
  level 1/2/3 ke bobot visual berbeda dan menautkan ke
  `/questions?topicId=<id>`; `TopicTagList` dipakai di halaman detail,
  bukan di baris daftar.
- Tag = tag WordPress: datar tanpa hierarki, nama sebagai kunci
  (case-insensitive), banyak per soal, dibuat otomatis saat disimpan
  bila belum dikenal, untuk penanda spesifik lintas topik.
- Penggunaan yang disamakan: editor memilih topik dari struktur
  hierarkis dan mengetik tag bebas; filter topik dan tag terpisah dan
  tidak saling menggantikan.
- Backend boleh beda: tabel topik/tag + join + rank primer, plus
  pengelolaan tag (merge, bersih-bersih tak terpakai, RESTRICT bila
  dipakai) — perbedaan itu tidak boleh bocor sebagai perilaku UI yang
  asing.
- Render yang diputuskan: topik tetap teks di detail; tag datar sebagai
  pill display-only di detail dan filter dulu saja, BUKAN di baris
  daftar utama (diputuskan 2026-10-25, "Tetap detail filter dulu aja").
Detail referensi yang sempat dibahas tapi TIDAK ditulis sebagai aturan
di DESIGN.md general: kontrak TagInput (Enter/koma commit, Backspace
hapus pill terakhir, saran dari tag yang ada), filter tag OR lewat
`?tags=aljabar,geometri`, dan tag pill di kartu daftar.

## Yang sengaja ditolak / tidak diadopsi

- Palet referensi `#2563EB` + slate + ramp taksonomi sebagai palet utama.
- Badge teks sebagai pembawa utama untuk metadata (bertentangan dengan
  ikon-only; topik saja yang tetap teks).
- Pola Bank Soal referensi sebagai paket (poin 4 ditolak).
- Margin/font/template/watermark print referensi (poin 7 hanya prinsip).
- Bento grid, kartu pajangan, hero/gradien, glassmorphism, eyebrow
  ALL-CAPS yang dilacak, dan hover micro-animation tak berujung
  (anti-default referensi, sejalan dengan prinsip DESIGN.md).

## Pertanyaan terbuka (dari DESIGN.md §9 + poin 3)

Catatan keputusan pertanyaan 2 (2026-10-25 malam): **ikon harus
bernilai.** Angka kelas dan kode Bloom tetap terlihat dari ikonnya
sendiri — mis. ikon berupa angka, atau bentuk lain yang membawa
nilainya — bukan ikon piktogram murni yang nilainya hanya ada di
tooltip. Detail lanjutan (nama lengkap level) baru dari tooltip.
Ini membatalkan bentuk mockup kedua yang menaruh angka/kode hanya di
tooltip.

Catatan keputusan pertanyaan 3 (2026-10-25 malam): **dark mode
didukung penuh, dengan audit.** Dark mode menjadi tema kedua resmi
yang berlaku di semua layar kerja, bukan dark-first dan bukan
pengganti tema terang. Syaratnya: audit kontras menyeluruh harus
jalan sebelum mode gelap diklaim AA. Token gelap yang sudah ada
(mendefinisikan ulang token menjadi lebih terang, bukan membalik
terang/gelap) menjadi dasarnya, bukan janji kontrasnya. Print tetap
tidak ikut tema layar.

Catatan keputusan pertanyaan 4 (2026-10-25 malam): **audit
menyeluruh, semua layar, terang + gelap.** Cakupannya bukan layar
utama saja: semua layar kerja, di kedua tema, termasuk teks, ikon,
dan status. Penting dibedakan: yang diputuskan di sini adalah
cakupannya, bukan hasilnya — audit itu sendiri belum jalan, dan
klaim AA (terang maupun gelap) tetap ditahan sampai audit lolos.

Catatan keputusan pertanyaan 5 / poin 3 (2026-10-25 malam, atas
delegasi pengguna "ikuti saran terbaikmu"): **pertahankan angka kode
sekarang, bukan angka referensi.** Rekomendasi asisten: keuntungan
referensi terlalu kecil untuk churn-nya — sidebar terbuka referensi
hanya menghemat 16px dari kode sekarang, sementara sidebar ciut
referensi justru memakan 16px lebih banyak, dan drawer referensi
lebih lebar di mobile. Angka kode sekarang juga memakai token standar
dan paling dekat dengan desain sekarang, yang merupakan selera inti
pengguna ("tidak jauh dari desain sekarang"). Angka yang
dipertahankan (dicatat di sini, bukan di DESIGN.md general): sidebar
terbuka 256px, ciut 48px, mobile 288px, header 56px. Arah mockup
"sidebar lebih sempit" ditafsirkan sebagai jangan melebar dari kode
sekarang, bukan sebagai perintah mengecilkan ke angka referensi.

1. "Siap" — DIPUTUSKAN, dengan revisi: awalnya pengguna memilih hapus
   ikon sepenuhnya, lalu meminta referensi ide penanda kecil yang tidak
   mengganggu dan tidak mencolok, dan memilih ide 1: **titik netral
   kecil**. Jadi target akhir bukan hapus sepenuhnya, melainkan titik
   netral kecil tanpa teks, tanpa badge, tanpa warna mencolok, tanpa
   glow — bukan dot hijau pekat seperti `StatusIndicator` sekarang.
   Catatan tradeoff yang sudah disampaikan: titik saja menyampaikan
   keberadaan status, bukan arti "lolos"; arti itu dibawa oleh nama
   aksesibel "Siap". Ide lain yang ditawarkan tapi tidak dipilih:
   centang outline redup, garis tepi tipis, penanda di ujung sekunder,
   sistem "paling sunyi", dan penanda hover-only (ditolak sebagai
   satu-satunya pembawa karena layar sentuh).
2. Angka kelas / kode Bloom tetap terlihat sekilas di samping ikon?
   (Mockup kedua: hanya di tooltip.)
3. Cakupan dark mode (token gelap sudah ada, cakupan masih daftar tunda).
4. Audit kontras menyeluruh (daftar tunda dari perbaikan Bank Soal).
5. Angka shell (poin 3 dilewati dulu).

## Kelompok yang belum dibahas tuntas (bukan keputusan)

- Editor/detail spesifik: per-type answer editor (7 varian di referensi),
  ranked solutions sebagai tabs (rank 1 = primer, tab "utama"),
  live KaTeX preview berdampingan, detail dengan tab pembahasan dan
  provenance, serta TopicPicker bertingkat penuh (rank per topik,
  reorder keyboard tanpa drag-and-drop di referensi).
- Detail print: template vs brand, empat region Kop/Header/Footer/
  Background, watermark vs grid, accent edge di margin box, Chromium-only,
  font terkunci per kolom, hanya solusi rank 1 yang dicetak, panel print
  (template, kolom/kunci/lembar/font, break control, kop fields),
  catatan print-color-adjust/background graphics.
- Data enrichment (referensi MAT-127/130): QuestionStatusBadge dengan
  prop FSM 3 state (tanpa state `archived` hasil invensi komponen),
  DifficultyBadge dengan aria-label, TopicTagList dengan bobot level,
  QuestionMediaGallery lewat `/api/media/<shortId>`, dan
  BundleEnrichmentSummary (rata-rata kesulitan, cakupan topik) — serta
  aturan agregat null dihilangkan yang sebagian sudah masuk poin 5.
- Teknis overlay/responsif: kontrak lebar Sheet (primitive di
  `@layer components`, bukan utilitas `data-*` yang mengalahkan consumer),
  filter menjadi Sheet di bawah `md`, preview editor menumpuk di bawah
  `lg`, lembar print A4 di HP, gutter 16px, body tidak pernah scroll
  horizontal.
- Permukaan lain di referensi: sign-in single admin (satu email +
  password, tanpa sign-up) dan home hub session-aware — belum dipetakan
  ke permukaan MathBank sekarang dan belum diputuskan.
- Skill referensi yang dikutip dokumen upload (`frontend-design`,
  `design-taste-frontend`, `shadcn`) dan status deferred U3 di dokumen
  itu (Radix vs Base UI, icon set, font loading) — di MathBank sekarang
  sudah terjawab secara praktis (Base UI via `components/ui`, Lucide,
  Roboto Flex/Mono via `next/font`), tapi belum diputuskan apakah perlu
  ditulis sebagai keputusan di DESIGN.md general.
