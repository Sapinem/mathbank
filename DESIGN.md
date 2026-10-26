# DESIGN.md — Selera Desain MathBank (General)

> **Panduan selera, bukan spesifikasi implementasi.** File ini hanya
> mengunci arah visual yang sudah disepakati, dalam bahasa general.
> Detail diskusi, verifikasi kode, konflik yang ditolak, dan angka-angka
> spesifik disimpan terpisah di `DESIGN-DISCUSSION.md` — jangan
> mengembalikannya ke file ini tanpa keputusan baru.
> **Bukan implementasi.** Mengubah kode repo tetap butuh persetujuan fase
> tersendiri.
> **Bukan dokumen kanonikal `docs/`.** Sumber kebenaran komponen,
> aksesibilitas, dan print tetap `docs/DESIGN_SYSTEM.md`.
> **Sumber kebenaran token:** sistem token tema repo. Jangan hardcode
> warna baru di komponen.

## Selera dalam satu paragraf

MathBank adalah alat kerja guru, bukan etalase marketing: sebuah meja
kerja penulisan soal (*technical authoring workbench*), bukan halaman
marketing. Desainnya padat, rapat, dan tidak jauh dari desain sekarang:
soal adalah pusat layar, metadata adalah penanda kecil yang bisa
dipindai, dan dekorasi hanya boleh ada bila membantu keputusan
berikutnya (telaah, edit, pilih, cetak). Bila sebuah elemen tidak
membantu guru memilih aksi berikutnya, ia adalah kandidat untuk dihapus,
diperkecil, atau dipindah satu klik lebih jauh.
Dial arahnya: variasi desain rendah, gerak rendah, kepadatan tinggi —
sebagai arah kualitatif, bukan metrik yang diaudit.

## Prinsip

1. **Soal dulu, metadata kemudian.** Batang soal mendapat hierarki
   tertinggi. Metadata tidak boleh bersaing dengannya lewat pill teks
   yang panjang.
2. **Padat, bukan sesak.** Kepadatan dicapai lewat padding yang lebih
   rapat, judul dan angka yang lebih kecil, serta baris yang lebih
   padat — bukan lewat penghapusan whitespace sampai teks menempel, dan
   bukan lewat kartu-kartu besar yang saling berebut perhatian.
3. **Satu pekerjaan per layar.** Setiap layar menjawab satu pertanyaan
   utama. Angka yang tidak menjawab pertanyaan itu pindah ke drill-down.
4. **Warna = makna, bukan dekorasi — tapi brand harus terlihat.** Warna
   hanya untuk status, aksi brand, state aktif/terpilih, dan "perlu
   perhatian". Brand tidak boleh sampai hilang: setiap layar utama
   harus punya jangkar brand yang jelas saat dibaca sekilas.
5. **Bisa dipindai tanpa warna.** Bentuk ikon, teks, atau posisi harus
   tetap menyampaikan makna bila warna dihilangkan.
6. **Konsisten lebih penting daripada baru.** Pakai ulang komponen,
   ikon, dan pola yang sudah ada sebelum memperkenalkan varian baru.
7. **Variasi rendah, gerak rendah.** Transisi hanya untuk umpan balik
   fungsional, bukan dekorasi yang berjalan terus-menerus.

## Yang TIDAK dilakukan

- Tidak ada bento grid / kartu pajangan dan tata letak kartu-berat.
- Tidak ada hero, gradien, atau ilustrasi dekoratif di layar kerja.
- Tidak ada animasi dekoratif yang tak berujung; gerak mengikuti
  preferensi kurangi gerak pengguna.
- Tidak ada dark-first sebagai identitas baru. Dark mode didukung penuh
  sebagai tema kedua yang resmi, berlaku di semua layar kerja — bukan
  sebagai pengganti tema terang, dan bukan tanpa audit (lihat bagian
  Warna).
- Tidak ada pill teks panjang untuk metadata soal; pill digantikan
  sistem ikon, kecuali topik.
- Tidak ada warna baru di luar sistem token tema repo.

## Warna (general)

Palet MathBank dipertahankan: biru brand utama, emas untuk "perlu
perhatian / menunggu tindakan", warna status yang universal (tidak ikut
brand), dan netral yang tenang dan akromatik. Palet referensi luar
(biru lain, netral slate, ramp taksonomi) ditolak sebagai palet utama.

- **Brand** untuk aksi primer, link, fokus, dan state aktif/terpilih.
  Tampilan sekarang dinilai terlalu netral, jadi kemunculan brand harus
  diperbanyak nanti pada implementasi — di tempat yang bermakna saja
  (navigasi aktif, filter aktif, item terpilih, aksi primer, penanda
  tahap), bukan sebagai latar kartu, gradien, atau hiasan, dan bukan
  pengganti warna status.
- **Emas** untuk perhatian. **Status** untuk status saja, dengan
  pemetaan yang harus disatukan (target: draf netral, telaah emas, siap
  hijau, arsip merah) — pemetaan yang berbeda-beda antar permukaan
  sekarang adalah kesenjangan, bukan aturan.
- **Taksonomi** (kesulitan dan Bloom) boleh punya warna domain
  tersendiri, tapi hanya sebagai pembawa sekunder. Titik, kode, bentuk
  ikon, dan label lengkap tetap utama; warna tidak boleh menjadi
  satu-satunya pembeda, dan level tertinggi tidak boleh dibaca sebagai
  error. Pemetaan warna per level belum dikunci.
- Kontras mengikuti WCAG AA, warna tidak pernah menjadi satu-satunya
  pembawa makna, dan mode gelap mendefinisikan ulang token menjadi
  lebih terang, bukan sekadar membalik terang/gelap. Audit kontras
  menyeluruh — semua layar kerja, mode terang dan gelap — adalah
  prasyarat klaim AA, dan audit itu sendiri belum jalan: sebelum
  audit lolos, jangan klaim AA, baik untuk terang maupun gelap.

## Tumpukan dan tipografi (general)

Pakai ulang tumpukan yang sudah ada (Next.js, Tailwind, primitif
headless, ikon Lucide, KaTeX) dan jangan memperkenalkan sistem komponen
kedua hanya untuk satu layar.

- **Matematika = serif, hanya lewat KaTeX.** Batang, opsi, dan jawaban
  yang dirender KaTeX adalah satu-satunya serif di halaman.
- **Prosa dan chrome = sans.** Jangan memakai serif untuk prosa hanya
  agar terasa "akademis".
- **Identifier = mono.** ID, source, dan teks eksak lain yang mungkin
  disalin memakai mono, bukan untuk judul atau label biasa.
- **Print adalah permukaan first-class**, bukan langkah tambahan:
  ujung alur merakit naskah, dengan sumbu warna terpisah dari token UI
  sehingga tema layar tidak menggeser kertas, dan geometri tetap yang
  tidak mengikuti breakpoint layar. Margin, ukuran font, dan sistem
  template print dari referensi tidak diadopsi dan tetap belum
  diputuskan.

## Metadata soal (general)

Satu-satunya metadata yang tetap berbentuk teks adalah **topik**.
Sisanya menjadi ikon:

- Topik: teks, jangan diubah jadi ikon.
- Status, jenjang kelas, tipe soal, level Bloom, kesulitan: ikon —
  kecuali Siap, yang hanya berupa titik netral kecil (lihat di bawah).
  Ikon jenjang dan Bloom harus bernilai: angka kelas dan kode Bloom
  terlihat dari ikonnya sendiri (mis. ikon berupa angka), bukan hanya
  dari tooltip.
- Ditandai: ikon bendera emas.

Aturan ikon: setiap ikon yang berdiri sendiri harus punya tooltip dan
nama aksesibel yang teksnya sama, muncul di hover dan fokus keyboard,
dan bisa ditutup. Ikon jenjang dan Bloom harus bernilai — angka kelas
dan kode Bloom terlihat dari ikonnya sendiri, detail lanjutannya
(nama lengkap level) baru dari tooltip. Panel filter Bank Soal wajib punya legenda ikon yang
menandai topik sebagai "masih teks" dan sisanya sebagai "ikon saja",
dan legenda yang tidak diperbarui saat ikon berubah dianggap bug.
Target sentuh mengikuti standar aksesibilitas repo.

**"Siap" hanya berupa titik netral kecil, tanpa teks, tanpa badge,
tanpa warna mencolok.** Status ready adalah keadaan default soal yang
sudah lolos telaah, jadi penandanya dibuat sekecil dan seredup mungkin:
titik netral yang tidak mengganggu pemindaian dan tidak mencolok,
bukan dot hijau pekat, bukan badge, bukan glow. Soal yang belum siap
justru yang diberi penanda lebih menonjol. Nama aksesibel tetap
mengumumkan "Siap", supaya titik ini tidak tertukar dengan status yang
belum dimuat atau tidak ada.

**Provenance sumber** (Naskah / Mandiri / Wacana) adalah dimensi yang
ortogonal terhadap status dan flag, tapi hanya tampil di zona sekunder
(footer kartu / halaman detail), bukan sebagai pill baru di baris
metadata utama. Warna sumber belum diputuskan.

**Topik dan tag mengikuti model WordPress**, walau backend sedikit
berbeda: topik hierarkis (banyak per soal, satu primer), tag datar
tanpa hierarki (nama sebagai kunci, banyak per soal, dibuat otomatis
saat disimpan). Di filter keduanya terpisah; tag tampil sebagai pill
di detail dan filter dulu saja, bukan di baris daftar utama.

## Kepadatan dan tata letak (general)

- Spacing berbasis skala kecil yang konsisten; perubahan kepadatan
  dilakukan satu tingkat secara merata di satu layar, bukan per
  komponen.
- Arah mockup: sidebar lebih sempit, padding lebih rapat, judul dan
  angka lebih kecil, baris soal lebih padat — dengan struktur lima
  layar yang tidak berubah. Geometri shell dipertahankan pada
  geometri kode sekarang; jangan melebar dari itu demi dekorasi.
- Shell stabil: navigasi tidak berpindah antar layar. Header halaman
  membawa judul, filter bernilai tertinggi, dan maksimal satu aksi
  dominan.
- Filter aktif selalu terlihat dan bisa dibersihkan dalam satu klik;
  empty state selalu punya satu aksi berikutnya.
- Loading bukan "0 soal". Data kosong bukan nol: memuat tampilkan
  placeholder, belum ada data berarti agregat dihilangkan (bukan 0),
  dan nol hanya tampil bila memang sudah terhitung nol.

## Lima layar dan satu pekerjaan masing-masing

1. **Dashboard — antrean kerja.** "Apa yang harus saya kerjakan
   berikutnya?" Hanya beberapa angka teratas; sisanya drill-down.
2. **Bank Soal — soal sebagai pusat.** "Soal mana yang saya cari /
   pilih?" Daftar soal dominan; filter dan legenda adalah pendukung.
3. **Detail & Telaah — membaca dan memutuskan.** "Apakah soal ini layak
   lolos, dan apa yang kurang?" Aksi telaah dekat dengan konten.
4. **Editor bertahap — menulis tanpa kehilangan konteks.** "Bagian mana
   yang sedang saya lengkapi?" Tahapan eksplisit, bukan satu form
   panjang tanpa penanda tahap.
5. **Bundle & pratinjau A4 — merakit dan mencetak.** "Apakah naskah ini
   siap cetak?" Pratinjau memakai pembaca payload yang sama dengan
   halaman detail.

## Referensi luar (rujukan rasa, bukan untuk disalin mentah)

Linear untuk rasa minimal dan padat, IBM Carbon untuk tabel padat,
pola dashboard internal untuk alur shell stabil dan detail yang
menjaga filter, dan Stripe hanya untuk disiplin token — bukan untuk
tata letak editorialnya yang lapang.

## Pertanyaan terbuka

Daftar awal sudah diputuskan semua: penanda Siap berupa titik netral
kecil, ikon jenjang dan Bloom bernilai, dark mode penuh dengan audit,
audit kontras menyeluruh, dan geometri shell dipertahankan pada kode
sekarang. Pertanyaan baru yang muncul belakangan ditulis di sini, bukan
dianggap sudah diputuskan.

## Checklist penerimaan (general)

Perubahan desain dianggap selesai hanya bila:

- Topik tetap teks; metadata lain tidak lagi pill teks panjang.
- "Siap" hanya berupa titik netral kecil: tanpa teks, tanpa badge,
  tanpa warna mencolok.
- Legenda ikon diperbarui dan sesuai dengan ikon yang dipakai.
- Setiap ikon mandiri punya nama aksesibel yang sama dengan
  tooltip-nya; status tidak hanya mengandalkan warna.
- Target sentuh, filter aktif yang bisa dibersihkan, loading bukan
  "0 soal", empty state punya satu aksi, dan agregat yang belum ada
  datanya dihilangkan (bukan 0).
- Tidak ada warna baru di luar sistem token, tidak ada kartu bento
  baru, hero, gradien, atau animasi dekoratif baru di layar kerja.
- Fokus keyboard terlihat, gerak mengikuti preferensi kurangi gerak,
  matematika bisa dibaca screen reader, dan field form punya label
  terikat dengan error yang diumumkan.
- Perubahan diverifikasi di layar sempit dan di print A4 bila menyentuh
  bundle/cetak, dan print tidak bergeser saat tema layar berubah.
