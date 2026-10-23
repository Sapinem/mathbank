/**
 * Whitelist mapel MATEMATIKA untuk ingest defantri (L6, murni).
 *
 * Kebijakan (keputusan produk): artikel yang judulnya TIDAK mengandung penanda
 * matematika → **DITANDAI SKIP** (tidak diproses), bukan dihilangkan senyap.
 *
 * Dua lapis penanda:
 *   1. **Nama mapel**: matematika, mtk, math, kalkulus, …
 *   2. **Topik matematika**: aljabar, trigonometri, integral, limit, matriks,
 *      turunan, statistika, peluang, barisan, vektor, dst. — karena banyak
 *      artikel berjudul topik saja (mis. "Turunan Fungsi Trigonometri …")
 *      tanpa kata "matematika".
 *
 * SENGAJA tidak dipakai: "pengetahuan kuantitatif" (bagian UTBK, soal bisa
 * campur penalaran) — biar eksplisit lewat topiknya.
 */

/** Penanda nama mapel matematika. */
const SUBJECT_MARKERS = [
  "matematika",
  "mathematics",
  "mtk",
  "math",
  "kalkulus",
  "calculus",
  "aljabar",
  "algebra",
  "trigonometri",
  "trigonometry",
  "geometri",
  "geometry",
  "aritmetika",
  "aritmatika",
  "statistika",
  "statistik",
  "peluang",
  "probabilitas",
  "integral",
  "turunan",
  "diferensial",
  "limit",
  "matriks",
  "matrix",
  "vektor",
  "vector",
  "logaritma",
  "eksponen",
  "kuadrat",
  "polinomial",
  "barisan",
  "deret",
  "pertidaksamaan",
  "persamaan",
  "fungsi",
  "bilangan",
  "pecahan",
  "sudut",
  "lingkaran",
  "segitiga",
  "bangun",
  "dimensi tiga",
  "program linear",
  "spldv",
  "spltv",
  "skala",
  "perbandingan",
  "kombinatorik",
  "permutasi",
  "kombinasi",
  "suku banyak",
  "numerik",
  "himpunan",
  "relasi",
  "modulo",
  // Tambahan hasil tinjauan korpus:
  "kuantitatif", // TPS Pengetahuan Kuantitatif (PK) = hitungan → matematika
  "faktorial",
  "perkalian",
  "pembagian",
  "penjumlahan",
  "pengurangan",
  "akar",
  "pangkat",
  "bangun ruang",
  "bangun datar",
  "garis singgung",
  "fpb",
  "kpk",
  "persen",
  "rata-rata",
];

/**
 * Penanda MAPEL NON-MATEMATIKA. Bila ada di judul/slug → artikel BUKAN matematika,
 * walau kebetulan memuat kata matematika (mis. "Download Soal OSK Fisika 2026").
 * Temuan nyata: artikel `osk-fisika-tahun-2026` lolos gerbang karena m4thlab
 * tak punya gerbang mapel.
 */
const NON_MATH_MARKERS = [
  "fisika",
  "kimia",
  "biologi",
  "biology",
  "astronomi",
  "ekonomi",
  "akuntansi",
  "sejarah",
  "geografi",
  "sosiologi",
  "bahasa indonesia",
  "bahasa inggris",
  "sastra",
  "kebumian",
];

/**
 * Judul/slug artikel → apakah termasuk matematika?
 *
 * Diperiksa dari **teks gabungan judul + URL/slug**. Alasannya: sebagian artikel
 * berjudul ambigu ("Olimpiade MIPA") padahal isinya & slug-nya matematika
 * (mis. `.../pembahasan-science-expo-matematika-sma-unggul-del-2018.html`).
 * Pencocokan case-insensitive.
 *
 * ⚠️ Penanda NON-MATEMATIKA (fisika/kimia/…) MENANG atas penanda matematika —
 * supaya "Soal OSK Fisika" (yang kadang menyebut "matematika" di navigasi)
 * tidak lolos.
 */
export function isMathArticle(input: { title?: string | null; url?: string | null }): boolean {
  const hay = `${input.title ?? ""} ${input.url ?? ""}`
    .toLowerCase()
    .replace(/[-_/]+/g, " ")
    .replace(/\s+/g, " ");
  if (NON_MATH_MARKERS.some((m) => hay.includes(m))) return false;
  return SUBJECT_MARKERS.some((m) => hay.includes(m));
}

/** Alias lama (judul saja) — dipertahankan untuk pemanggil yang belum punya URL. */
export function isMathTitle(title: string): boolean {
  return isMathArticle({ title });
}
