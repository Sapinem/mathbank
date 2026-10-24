/**
 * ACT-09: Topic Mapping — Peta soal ke topik (question_topics).
 *
 * Strategi keyword-based hybrid:
 *  1. Keyword eksplisit dari content_markdown + event_subtest → exact/partial match ke slug topik.
 *  2. Soal ambigU (skor rendah) → di-flag UNMAPPED di log.
 *  3. Target: ≥70% soal terpetakan otomatis.
 *
 * Jalankan: pnpm tsx scripts/map-question-topics.ts
 *           pnpm tsx scripts/map-question-topics.ts --dry-run   (tanpa INSERT)
 */

import { config } from "dotenv";
import postgres from "postgres";
import { slugify } from "@/lib/taxonomy/tree";

config({ path: ".env" });

const DRY_RUN = process.argv.includes("--dry-run");
const BATCH_SIZE = 500;

// ────────────────────────────────────────────────────────────────────────────
// Topic → keyword mapping
// Setiap entry: topicSlug → [keywords yang jika muncul di content/event_subtest
// menunjukkan soal ini termasuk topik tersebut].
// Diurutkan dari lebih-spesifik ke lebih-umum (penting untuk prioritas).
// ────────────────────────────────────────────────────────────────────────────
interface TopicKeywordRule {
  slug: string;
  /** Kata kunci regex atau substring (case-insensitive). Semua pattern adalah OR. */
  keywords: string[];
  /** Kata kunci latex / simbol KaTeX */
  latexPatterns?: string[];
  /** Bobot (1-10). Semakin tinggi semakin kuat sinyal. Default 5. */
  weight?: number;
}

const TOPIC_RULES: TopicKeywordRule[] = [
  // ─── Level-3 (paling spesifik, cek duluan) ────────────────────────────

  // INTEGRAL
  { slug: "integral-volume-benda-putar", keywords: ["volume benda putar", "benda putar", "diputar mengelilingi sumbu"], weight: 9 },
  { slug: "integral-luas-daerah-integral", keywords: ["luas daerah", "daerah yang diarsir", "luas wilayah"], latexPatterns: ["\\\\int.*dx", "\\\\int.*dy"], weight: 9 },
  { slug: "integral-integral-parsial", keywords: ["integral parsial", "parsial"], weight: 9 },
  { slug: "integral-integral-substitusi", keywords: ["integral substitusi", "substitusi.*integral", "metode substitusi"], weight: 9 },
  { slug: "integral-integral-trigonometri", keywords: ["integral.*sin", "integral.*cos", "integral.*tan", "integral trigonometri"], latexPatterns: ["\\\\int.*\\\\sin", "\\\\int.*\\\\cos", "\\\\int.*\\\\tan"], weight: 9 },
  { slug: "integral-integral-tak-tentu-aljabar", keywords: ["integral tak tentu", "antiturunan", "primitif"], weight: 8 },
  { slug: "integral-integral-tentu-aljabar", keywords: ["integral tentu", "integral dari.*sampai", "integral batas"], latexPatterns: ["\\\\int_\\{", "\\\\int_[0-9]"], weight: 8 },

  // TURUNAN
  { slug: "turunan-fungsi-dalil-lhopital", keywords: ["l'hopital", "hopital", "l hopital", "lhopital"], weight: 10 },
  { slug: "turunan-fungsi-kecepatan-percepatan-sesaat", keywords: ["kecepatan sesaat", "percepatan sesaat", "kecepatan pada saat", "percepatan pada"], weight: 9 },
  { slug: "turunan-fungsi-garis-singgung-kurva", keywords: ["garis singgung kurva", "garis singgung pada kurva", "garis singgung di titik", "gradien kurva"], weight: 9 },
  { slug: "turunan-fungsi-nilai-maksimum-minimum", keywords: ["nilai maksimum", "nilai minimum", "titik maksimum", "titik minimum", "ekstrem", "maximum", "minimum"], weight: 8 },
  { slug: "turunan-fungsi-turunan-trigonometri", keywords: ["turunan.*sin", "turunan.*cos", "turunan.*tan", "f'(x).*sin", "turunan trigonometri"], latexPatterns: ["\\\\frac\\{d\\}.*\\\\sin", "\\\\frac\\{d\\}.*\\\\cos"], weight: 9 },
  { slug: "turunan-fungsi-turunan-aturan-rantai", keywords: ["aturan rantai", "chain rule", "fungsi komposisi.*turunan", "turunan fungsi komposisi"], weight: 9 },
  { slug: "turunan-fungsi-turunan-aljabar-baku", keywords: ["turunan", "diferensial", "f'(x)", "dy/dx", "f prime"], latexPatterns: ["\\\\frac\\{d"], weight: 5 },

  // LIMIT
  { slug: "limit-fungsi-limit-trigonometri", keywords: ["limit.*sin", "limit.*cos", "limit.*tan", "lim.*trigonometri"], latexPatterns: ["\\\\lim.*\\\\sin", "\\\\lim.*\\\\cos", "\\\\lim.*\\\\tan"], weight: 9 },
  { slug: "limit-fungsi-limit-aljabar-tak-hingga", keywords: ["limit tak hingga", "lim.*tak hingga", "limit menuju tak hingga", "x menuju tak hingga"], latexPatterns: ["\\\\lim.*\\\\infty", "\\\\to\\s*\\\\infty"], weight: 9 },
  { slug: "limit-fungsi-limit-aljabar-bentuk-akar", keywords: ["limit.*akar", "lim.*sqrt", "limit bentuk akar", "rasionalisasi limit"], latexPatterns: ["\\\\lim.*\\\\sqrt"], weight: 9 },
  { slug: "limit-fungsi-limit-aljabar-pemfaktoran", keywords: ["limit.*pemfaktoran", "limit.*faktor", "lim.*pemfaktoran"], weight: 8 },
  { slug: "limit-fungsi-kekontinuan-fungsi", keywords: ["kontinu", "kekontinuan", "discontinu", "fungsi kontinu", "titik diskontinu"], weight: 9 },

  // FUNGSI
  { slug: "teori-fungsi-fungsi-invers", keywords: ["fungsi invers", "invers fungsi", "f^-1", "f⁻¹", "invers dari f"], latexPatterns: ["f\\^\\{-1\\}", "f^{-1}"], weight: 9 },
  { slug: "teori-fungsi-fungsi-komposisi", keywords: ["fungsi komposisi", "komposisi fungsi", "(f ∘ g)", "f∘g", "fog", "f o g", "(f o g)", "(g o f)"], weight: 9 },
  { slug: "teori-fungsi-domain-range", keywords: ["domain", "range", "daerah asal", "daerah hasil", "kodomain"], weight: 7 },

  // PERSAMAAN KUADRAT
  { slug: "persamaan-kuadrat-rumus-abc-diskriminan", keywords: ["rumus abc", "diskriminan", "discriminant", "b^2-4ac", "b²-4ac"], latexPatterns: ["b\\^2-4ac", "b\\^\\{2\\}-4ac", "\\\\Delta"], weight: 10 },
  { slug: "persamaan-kuadrat-pemfaktoran-persamaan-kuadrat", keywords: ["pemfaktoran persamaan kuadrat", "faktorkan.*kuadrat", "faktorisasi.*kuadrat"], weight: 9 },
  { slug: "persamaan-kuadrat-menyusun-persamaan-kuadrat-baru", keywords: ["menyusun persamaan kuadrat", "buat persamaan kuadrat", "persamaan kuadrat baru"], weight: 9 },
  { slug: "persamaan-kuadrat-pertidaksamaan-kuadrat", keywords: ["pertidaksamaan kuadrat", "inequalitas kuadrat"], weight: 9 },
  { slug: "persamaan-kuadrat-operasi-akar-kuadrat", keywords: ["akar-akar persamaan kuadrat", "akar kuadrat.*α.*β", "jumlah akar", "hasil kali akar"], latexPatterns: ["\\\\alpha.*\\\\beta", "x_1.*x_2"], weight: 9 },

  // FUNGSI KUADRAT
  { slug: "fungsi-kuadrat-grafik-parabola", keywords: ["grafik parabola", "grafik fungsi kuadrat", "lukis grafik.*kuadrat"], weight: 9 },
  { slug: "fungsi-kuadrat-titik-puncak-parabola", keywords: ["titik puncak", "vertex", "puncak parabola", "koordinat puncak"], weight: 9 },
  { slug: "fungsi-kuadrat-kedudukan-garis-parabola", keywords: ["kedudukan garis.*parabola", "garis menyinggung parabola", "garis memotong parabola"], weight: 9 },

  // EKSPONEN
  { slug: "eksponen-bilangan-berpangkat-persamaan-eksponen", keywords: ["persamaan eksponen", "selesaikan.*^x", "2^x =", "3^x ="], latexPatterns: ["=.*\\^\\{?x\\}?", "\\^x\\s*="], weight: 9 },
  { slug: "eksponen-bilangan-berpangkat-pertidaksamaan-eksponen", keywords: ["pertidaksamaan eksponen"], weight: 9 },
  { slug: "eksponen-bilangan-berpangkat-grafik-fungsi-eksponen", keywords: ["grafik fungsi eksponen", "grafik.*eksponen", "sketsa.*eksponen"], weight: 9 },
  { slug: "eksponen-bilangan-berpangkat-sifat-eksponen", keywords: ["sifat eksponen", "pangkat", "bilangan berpangkat", "eksponen"], latexPatterns: ["\\^\\{", "\\^[0-9]", "a\\^n"], weight: 4 },

  // LOGARITMA
  { slug: "logaritma-persamaan-logaritma", keywords: ["persamaan logaritma", "selesaikan.*log"], weight: 9 },
  { slug: "logaritma-pertidaksamaan-logaritma", keywords: ["pertidaksamaan logaritma"], weight: 9 },
  { slug: "logaritma-grafik-fungsi-logaritma", keywords: ["grafik fungsi logaritma", "grafik logaritma", "grafik.*log"], weight: 9 },
  { slug: "logaritma-sifat-logaritma", keywords: ["sifat logaritma", "log", "logaritma"], latexPatterns: ["\\\\log", "\\\\ln"], weight: 4 },

  // PERSAMAAN LINEAR
  { slug: "persamaan-pertidaksamaan-linear-spldv", keywords: ["spldv", "sistem persamaan linear dua variabel", "sistem persamaan linear 2", "eliminasi.*substitusi", "dua variabel"], weight: 10 },
  { slug: "persamaan-pertidaksamaan-linear-spltv", keywords: ["spltv", "sistem persamaan linear tiga variabel", "tiga variabel", "3 variabel"], weight: 10 },
  { slug: "persamaan-pertidaksamaan-linear-sptldv", keywords: ["sptldv", "sistem pertidaksamaan linear dua variabel"], weight: 10 },
  { slug: "persamaan-pertidaksamaan-linear-plsv-ptlsv", keywords: ["plsv", "ptlsv", "persamaan linear satu variabel", "pertidaksamaan linear satu variabel", "persamaan linear"], weight: 7 },

  // POLINOMIAL
  { slug: "polinomial-teorema-sisa", keywords: ["teorema sisa", "sisa pembagian", "horner.*sisa", "sisa bagi"], weight: 9 },
  { slug: "polinomial-teorema-faktor", keywords: ["teorema faktor", "faktor dari polinomial", "akar polinomial"], weight: 9 },
  { slug: "polinomial-pembagian-horner", keywords: ["horner", "pembagian polinomial", "algoritma horner", "bagi polinomial"], weight: 9 },
  { slug: "polinomial-hubungan-vieta", keywords: ["vieta", "hubungan akar-akar", "jumlah akar-akar", "hasil kali akar-akar"], weight: 9 },
  { slug: "polinomial-operasi-polinomial", keywords: ["polinomial", "suku banyak", "polinom"], weight: 5 },

  // PROGRAM LINEAR
  { slug: "program-linear-nilai-optimum-garis-selidik", keywords: ["nilai optimum", "garis selidik", "titik optimum", "fungsi tujuan"], weight: 9 },
  { slug: "program-linear-model-matematika-proglin", keywords: ["program linear", "model matematika.*linear", "kendala", "fungsi objektif"], weight: 7 },

  // BARISAN DERET
  { slug: "barisan-deret-barisan-deret-aritmetika", keywords: ["barisan aritmetika", "deret aritmetika", "beda", "suku ke-n", "un = a + (n-1)b", "aritmetik"], latexPatterns: ["a\\s*\\+\\s*(n-1)b", "U_n.*a.*b"], weight: 9 },
  { slug: "barisan-deret-barisan-deret-geometri", keywords: ["barisan geometri", "deret geometri", "rasio", "suku ke-n geometri"], latexPatterns: ["ar\\^{n-1}", "r\\^n"], weight: 9 },
  { slug: "barisan-deret-deret-geometri-tak-hingga", keywords: ["deret geometri tak hingga", "deret tak hingga", "S∞", "S tak hingga"], latexPatterns: ["S_\\{\\\\infty\\}", "\\\\frac\\{a\\}\\{1-r\\}"], weight: 9 },
  { slug: "barisan-deret-pola-bilangan", keywords: ["pola bilangan", "pola dari barisan", "suku berikutnya", "bilangan segitiga"], weight: 7 },

  // MATRIKS
  { slug: "matriks-determinan-matriks", keywords: ["determinan", "det(", "|A|", "matriks determinan"], latexPatterns: ["\\\\det", "\\\\begin\\{vmatrix\\}"], weight: 9 },
  { slug: "matriks-invers-matriks", keywords: ["invers matriks", "matriks invers", "A^-1", "A⁻¹"], latexPatterns: ["A\\^\\{-1\\}", "A^{-1}"], weight: 9 },
  { slug: "matriks-persamaan-matriks", keywords: ["persamaan matriks", "AX = B", "matriks.*persamaan"], weight: 8 },
  { slug: "matriks-operasi-matriks", keywords: ["matriks", "transpose", "ordo matriks"], latexPatterns: ["\\\\begin\\{pmatrix\\}", "\\\\begin\\{bmatrix\\}", "\\\\begin\\{matrix\\}"], weight: 4 },

  // VEKTOR
  { slug: "vektor-proyeksi-vektor", keywords: ["proyeksi vektor", "komponen vektor", "proj"], weight: 9 },
  { slug: "vektor-perkalian-skalar-vektor", keywords: ["perkalian skalar", "dot product", "hasil kali skalar", "a⋅b", "a·b"], latexPatterns: ["\\\\cdot\\s*\\\\vec", "\\\\vec.*\\\\cdot"], weight: 9 },
  { slug: "vektor-operasi-vektor-3d", keywords: ["vektor 3d", "vektor ruang", "vektor tiga dimensi", "koordinat z"], weight: 8 },
  { slug: "vektor-operasi-vektor-2d", keywords: ["vektor 2d", "vektor bidang", "vektor dua dimensi"], weight: 8 },
  // fall through to parent for generic vektor
  { slug: "aljabar-persamaan-vektor", keywords: ["vektor"], latexPatterns: ["\\\\vec\\{"], weight: 3 },

  // ─── Extra catch-all rules ─────────────────────────────────────────────

  // Limit — catch KaTeX \\lim
  { slug: "kalkulus-fungsi-limit-fungsi", keywords: ["lim", "limit"], latexPatterns: ["\\\\lim\\b"], weight: 3 },

  // Integral — catch KaTeX \\int
  { slug: "kalkulus-fungsi-integral", keywords: ["integral"], latexPatterns: ["\\\\int\\b", "\\\\int_"], weight: 3 },

  // Turunan catch-all
  { slug: "kalkulus-fungsi-turunan-fungsi", keywords: ["turunan", "diferensial"], latexPatterns: ["\\\\frac\\{d"], weight: 3 },

  // Disjungsi, konjungsi, dll → logika matematika
  { slug: "logika-penalaran-diskrit-logika-matematika", keywords: ["disjungsi", "konjungsi", "tautologi", "kontradiksi", "proposisi", "pernyataan majemuk"], weight: 7 },

  // Kuadrat sempurna, faktorisasi → persamaan kuadrat
  { slug: "aljabar-persamaan-persamaan-kuadrat", keywords: ["kuadrat sempurna", "lengkapi kuadrat sempurna", "completing the square"], weight: 7 },

  // Pembagian polinomial (Horner) dengan kata "bagi ... oleh"
  { slug: "polinomial-pembagian-horner", keywords: ["hasil bagi", "bagi.*oleh", "sisanya adalah"], weight: 6 },

  // Geometric/arithmetic sequence in English
  { slug: "barisan-deret-barisan-deret-aritmetika", keywords: ["arithmetic sequence", "arithmetic progression", "arithmetic series"], weight: 8 },
  { slug: "barisan-deret-barisan-deret-geometri", keywords: ["geometric sequence", "geometric progression", "geometric series"], weight: 8 },

  // Geometri ruang catch-all (kubus, balok, prisma, dll)
  { slug: "geometri-ruang-luas-volume-bangun-ruang", keywords: ["kubus", "balok", "prisma", "limas", "tabung", "kerucut", "silinder", "diagonal ruang", "rusuk", "bangun ruang"], weight: 5 },

  // Geometri bidang datar catch-all
  { slug: "geometri-bidang-datar-segi-empat", keywords: ["persegi panjang.*keliling", "panjang.*lebar.*keliling", "keliling.*persegi panjang"], weight: 5 },

  // Modus, median, mean → statistika deskriptif pemusatan data
  { slug: "statistika-deskriptif-pemusatan-data", keywords: ["modus dari", "mean dari", "rata-rata dari", "median dari"], weight: 5 },
  // Distribusi frekuensi → penyajian data
  { slug: "statistika-deskriptif-penyajian-data-grafik", keywords: ["distribusi frekuensi", "tabel frekuensi", "diagram batang", "histogram", "poligon frekuensi", "ogive"], weight: 5 },

  // SPLDV catch — sistem persamaan
  { slug: "persamaan-pertidaksamaan-linear-spldv", keywords: ["sistem persamaan"], weight: 4 },

  // Matrix catch-all (pmatrix, bmatrix)
  { slug: "matriks-operasi-matriks", latexPatterns: ["\\\\begin\\{pmatrix\\}", "\\\\begin\\{bmatrix\\}", "\\\\begin\\{matrix\\}"], keywords: [], weight: 3 },

  // Kombinatorial proof → kaidah pencacahan binomial
  { slug: "kaidah-pencacahan-binomial-newton", latexPatterns: ["\\\\binom\\{"], keywords: ["pembuktian kombinatorial", "kombinatorial"], weight: 7 },

  // Akar-akar persamaan kubik → polinomial
  { slug: "polinomial-teorema-faktor", latexPatterns: ["x\\^3", "x\\^\\{3\\}"], keywords: ["akar-akar persamaan kubik", "persamaan derajat tiga"], weight: 5 },

  // Palindrom, habis dibagi → diskrit
  { slug: "diskrit-olimpiade-keterbagian-modulo", keywords: ["palindrom", "habis dibagi", "bilangan asli.*habis"], weight: 5 },

  // Faktorisasi aljabar sederhana → bentuk aljabar
  { slug: "bentuk-aljabar-pemfaktoran-aljabar", keywords: ["faktorisasi dari", "faktorkan", "faktorisasi"], weight: 5 },

  // BENTUK ALJABAR
  { slug: "bentuk-aljabar-pemfaktoran-aljabar", keywords: ["pemfaktoran", "faktorkan", "faktorisasi aljabar"], weight: 8 },
  { slug: "bentuk-aljabar-pecahan-aljabar", keywords: ["pecahan aljabar", "sederhanakan.*pecahan", "operasi pecahan aljabar"], weight: 8 },
  { slug: "bentuk-aljabar-operasi-aljabar", keywords: ["sederhanakan", "ekspansi", "bentuk aljabar"], weight: 3 },

  // BENTUK AKAR
  { slug: "bentuk-akar-merasionalkan-akar", keywords: ["merasionalkan", "rasionalisasi", "rasionalkan"], weight: 9 },
  { slug: "bentuk-akar-operasi-bentuk-akar", keywords: ["bentuk akar", "akar kuadrat", "√", "operasi akar"], latexPatterns: ["\\\\sqrt\\{"], weight: 5 },

  // TRIGONOMETRI
  { slug: "trigonometri-persamaan-trigonometri", keywords: ["persamaan trigonometri", "sin x =", "cos x =", "tan x =", "selesaikan.*sin.*=", "selesaikan.*cos.*="], weight: 9 },
  { slug: "trigonometri-identitas-trigonometri", keywords: ["identitas trigonometri", "buktikan identitas", "verifikasi identitas"], weight: 9 },
  { slug: "trigonometri-rumus-sudut-ganda", keywords: ["sudut ganda", "rumus sudut ganda", "sin 2α", "cos 2α", "tan 2α"], latexPatterns: ["\\\\sin 2", "\\\\cos 2", "2\\\\sin.*\\\\cos"], weight: 9 },
  { slug: "trigonometri-rumus-jumlah-selisih-sudut", keywords: ["jumlah sudut", "selisih sudut", "rumus penjumlahan", "sin(α+β)", "cos(α-β)"], latexPatterns: ["\\\\sin\\(.*\\+.*\\)", "\\\\cos\\(.*-.*\\)"], weight: 9 },
  { slug: "trigonometri-aturan-sinus-cosinus", keywords: ["aturan sinus", "aturan cosinus", "rumus sinus", "rumus cosinus", "hukum sinus", "hukum cosinus"], weight: 9 },
  { slug: "trigonometri-sudut-berelasi", keywords: ["sudut berelasi", "sudut istimewa", "sin 30", "cos 60", "tan 45", "sin 90", "sudut lancip", "sudut tumpul"], weight: 7 },
  { slug: "trigonometri-grafik-fungsi-trigonometri", keywords: ["grafik.*sin", "grafik.*cos", "grafik.*tan", "grafik fungsi trigonometri", "periode.*fungsi", "amplitudo"], weight: 9 },
  { slug: "trigonometri-trigonometri-segitiga-siku", keywords: ["segitiga siku-siku", "sisi miring", "sin α =", "cos α =", "tan α =", "trigonometri segitiga", "sohcahtoa"], weight: 8 },

  // GEOMETRI
  { slug: "geometri-analitik-persamaan-lingkaran", keywords: ["persamaan lingkaran", "lingkaran.*pusat.*jari", "x² + y² =", "persamaan umum lingkaran"], latexPatterns: ["x\\^2.*y\\^2.*r\\^2", "\\(x-a\\)\\^2"], weight: 9 },
  { slug: "geometri-analitik-garis-singgung-lingkaran", keywords: ["garis singgung lingkaran", "garis singgung pada lingkaran", "singgung lingkaran"], weight: 9 },
  { slug: "geometri-analitik-elips-analitik", keywords: ["elips", "persamaan elips"], weight: 9 },
  { slug: "geometri-analitik-hiperbola-analitik", keywords: ["hiperbola", "persamaan hiperbola"], weight: 9 },
  { slug: "geometri-analitik-parabola-analitik", keywords: ["parabola analitik", "persamaan parabola", "sumbu simetri parabola"], weight: 8 },
  { slug: "geometri-ruang-dimensi-tiga-jarak", keywords: ["jarak titik ke garis", "jarak titik ke bidang", "jarak antar titik", "jarak dalam ruang", "dimensi tiga.*jarak"], weight: 9 },
  { slug: "geometri-ruang-dimensi-tiga-sudut", keywords: ["sudut antara", "sudut dua bidang", "sudut bidang", "dimensi tiga.*sudut", "sudut dalam ruang"], weight: 9 },
  { slug: "geometri-ruang-luas-volume-bangun-ruang", keywords: ["volume", "luas permukaan", "bangun ruang", "kubus", "balok", "prisma", "limas", "tabung", "kerucut", "bola"], weight: 7 },
  { slug: "geometri-bidang-datar-segitiga-pythagoras", keywords: ["segitiga", "pythagoras", "teorema pythagoras", "sisi segitiga"], weight: 7 },
  { slug: "geometri-bidang-datar-segi-empat", keywords: ["persegi panjang", "persegi", "jajar genjang", "trapesium", "belah ketupat", "layang-layang", "segi empat"], weight: 7 },
  { slug: "geometri-bidang-datar-kesebangunan-kekongruenan", keywords: ["kesebangunan", "kekongruenan", "sebangun", "kongruen", "perbandingan sisi"], weight: 8 },
  { slug: "geometri-bidang-datar-unsur-luas-lingkaran", keywords: ["luas lingkaran", "keliling lingkaran", "jari-jari", "diameter", "busur", "tali busur", "juring"], weight: 7 },
  { slug: "geometri-bidang-datar-sudut-pusat-keliling-lingkaran", keywords: ["sudut pusat", "sudut keliling", "sudut lingkaran", "busur lingkaran"], weight: 9 },
  { slug: "geometri-bidang-datar-sudut-garis", keywords: ["sudut sehadap", "sudut bersilangan", "sudut bertolak belakang", "garis sejajar", "sudut pelurus"], weight: 7 },

  // TRANSFORMASI GEOMETRI
  { slug: "transformasi-geometri-refleksi", keywords: ["refleksi", "pencerminan", "bayangan cermin", "simetri"], weight: 9 },
  { slug: "transformasi-geometri-rotasi", keywords: ["rotasi", "putaran", "diputar"], weight: 9 },
  { slug: "transformasi-geometri-dilatasi", keywords: ["dilatasi", "pembesaran", "pengecilan", "faktor skala"], weight: 9 },
  { slug: "transformasi-geometri-translasi", keywords: ["translasi", "pergeseran", "geser", "translasikan"], weight: 9 },
  { slug: "transformasi-geometri-komposisi-transformasi", keywords: ["komposisi transformasi", "transformasi berurutan", "gabungan transformasi"], weight: 9 },

  // STATISTIKA
  { slug: "statistika-deskriptif-pemusatan-data", keywords: ["mean", "rata-rata", "median", "modus", "nilai tengah", "ukuran pemusatan"], weight: 8 },
  { slug: "statistika-deskriptif-penyebaran-data", keywords: ["varian", "variansi", "standar deviasi", "simpangan baku", "jangkauan", "simpangan rata-rata", "kuartil"], weight: 8 },
  { slug: "statistika-deskriptif-penyajian-data-grafik", keywords: ["histogram", "poligon frekuensi", "ogive", "tabel frekuensi", "diagram batang", "diagram lingkaran", "diagram garis"], weight: 8 },
  { slug: "statistika-deskriptif-letak-data", keywords: ["kuartil", "desil", "persentil", "Q1", "Q2", "Q3", "letak data"], weight: 8 },
  { slug: "statistika-inferensial-distribusi-normal-z-score", keywords: ["distribusi normal", "z-score", "kurva normal", "nilai z", "standar normal"], weight: 9 },
  { slug: "statistika-inferensial-distribusi-binomial", keywords: ["distribusi binomial", "binomial", "bernoulli", "P(X=k)", "distribusi poisson"], weight: 9 },
  { slug: "statistika-bivariat-regresi-linear", keywords: ["regresi linear", "regresi linier", "garis regresi", "koefisien regresi", "y = ax + b"], weight: 9 },
  { slug: "statistika-bivariat-diagram-pencar", keywords: ["diagram pencar", "scatter plot", "korelasi", "koefisien korelasi"], weight: 9 },

  // PELUANG
  { slug: "teori-peluang-peluang-bersyarat", keywords: ["peluang bersyarat", "P(A|B)", "peluang kondisional", "bayes"], latexPatterns: ["P\\(A\\|B\\)", "P\\(.*\\|.*\\)"], weight: 9 },
  { slug: "teori-peluang-peluang-kejadian-majemuk", keywords: ["peluang gabungan", "kejadian majemuk", "P(A∪B)", "P(A∩B)", "peluang irisan", "peluang gabungan"], weight: 9 },
  { slug: "teori-peluang-peluang-kejadian-tunggal", keywords: ["ruang sampel", "kejadian tunggal", "titik sampel", "P(A)"], weight: 7 },
  { slug: "teori-peluang-frekuensi-harapan", keywords: ["frekuensi harapan", "nilai harapan", "ekspektasi"], weight: 9 },

  // KAIDAH PENCACAHAN
  { slug: "kaidah-pencacahan-permutasi", keywords: ["permutasi", "nPr", "P(n,r)", "P_n^r", "susunan"], latexPatterns: ["P_n\\^r", "P\\(n,r\\)"], weight: 9 },
  { slug: "kaidah-pencacahan-kombinasi", keywords: ["kombinasi", "nCr", "C(n,r)", "binomial", "pemilihan"], latexPatterns: ["C_n\\^r", "C\\(n,r\\)", "\\\\binom"], weight: 9 },
  { slug: "kaidah-pencacahan-binomial-newton", keywords: ["binomial newton", "teorema binomial", "(a+b)^n", "ekspansi binomial"], latexPatterns: ["\\(a\\+b\\)\\^", "\\\\binom\\{n\\}\\{k\\}"], weight: 9 },
  { slug: "kaidah-pencacahan-aturan-perkalian-slot-filling", keywords: ["aturan perkalian", "aturan pengisian tempat", "diagram pohon", "filling"], weight: 8 },

  // LOGIKA MATEMATIKA
  { slug: "logika-matematika-pernyataan-negasi", keywords: ["negasi", "ingkaran", "pernyataan majemuk", "proposisi", "tautologi", "kontradiksi"], weight: 8 },
  { slug: "logika-matematika-implikasi-biimplikasi", keywords: ["implikasi", "biimplikasi", "jika.*maka", "jika dan hanya jika", "konvers", "invers", "kontraposisi"], weight: 9 },
  { slug: "logika-matematika-penarikan-kesimpulan", keywords: ["modus ponens", "modus tollens", "silogisme", "penarikan kesimpulan", "kesimpulan yang sah"], weight: 9 },
  { slug: "logika-matematika-induksi-matematika", keywords: ["induksi matematika", "induksi lengkap", "buktikan dengan induksi"], weight: 9 },

  // DISKRIT / OLIMPIADE
  { slug: "diskrit-olimpiade-keterbagian-modulo", keywords: ["keterbagian", "modulo", "kongruensi", "habis dibagi", "sisa bagi", "mod"], latexPatterns: ["\\\\equiv.*\\\\pmod", "\\\\bmod"], weight: 8 },
  { slug: "diskrit-olimpiade-persamaan-diophantine", keywords: ["diophantine", "solusi bulat", "bilangan bulat.*persamaan"], weight: 9 },
  { slug: "diskrit-olimpiade-pigeonhole-principle", keywords: ["pigeonhole", "prinsip sarang merpati", "prinsip laci"], weight: 9 },
  { slug: "diskrit-olimpiade-deret-teleskopik", keywords: ["deret teleskopik", "teleskopik", "sum collapsing"], weight: 9 },

  // BILANGAN DASAR
  { slug: "bilangan-dasar-fpb-kpk", keywords: ["fpb", "kpk", "faktor persekutuan terbesar", "kelipatan persekutuan terkecil", "prima"], weight: 9 },
  { slug: "bilangan-dasar-pecahan-desimal", keywords: ["pecahan", "desimal", "persen", "persentase", "per seratus"], weight: 6 },
  { slug: "bilangan-dasar-bilangan-bulat", keywords: ["bilangan bulat", "bilangan negatif", "bilangan positif", "operasi bilangan bulat"], weight: 5 },
  { slug: "bilangan-dasar-operasi-bilangan", keywords: ["penjumlahan", "pengurangan", "perkalian", "pembagian", "operasi hitung"], weight: 3 },

  // ARITMETIKA SOSIAL
  { slug: "aritmetika-sosial-untung-rugi", keywords: ["untung", "rugi", "laba", "kerugian", "harga jual", "harga beli"], weight: 9 },
  { slug: "aritmetika-sosial-diskon-rabat", keywords: ["diskon", "rabat", "potongan harga", "diskon"], weight: 9 },
  { slug: "aritmetika-sosial-pajak-ppn-pph", keywords: ["pajak", "ppn", "pph", "tax", "nilai pajak"], weight: 9 },
  { slug: "aritmetika-sosial-bruto-tara-netto", keywords: ["bruto", "tara", "netto", "neto", "berat bersih", "berat kotor"], weight: 9 },

  // RASIO & SKALA
  { slug: "rasio-skala-skala-peta", keywords: ["skala peta", "skala gambar", "peta.*skala", "jarak sebenarnya", "jarak peta"], weight: 9 },
  { slug: "rasio-skala-perbandingan-senilai", keywords: ["perbandingan senilai", "berbanding lurus", "proporsi", "perbandingan langsung"], weight: 8 },
  { slug: "rasio-skala-perbandingan-berbalik-nilai", keywords: ["perbandingan berbalik nilai", "berbanding terbalik", "inversely proportional"], weight: 8 },

  // MATEMATIKA FINANSIAL
  { slug: "matematika-finansial-bunga-tunggal", keywords: ["bunga tunggal", "bunga sederhana", "simple interest"], weight: 9 },
  { slug: "matematika-finansial-bunga-majemuk", keywords: ["bunga majemuk", "bunga berbunga", "compound interest"], weight: 9 },
  { slug: "matematika-finansial-anuitas-pelunasan", keywords: ["anuitas", "cicilan", "pelunasan", "angsuran", "kredit"], weight: 9 },

  // PENALARAN KUANTITATIF UTBK
  { slug: "penalaran-kuantitatif-utbk-perbandingan-nilai-p-dan-q", keywords: ["perbandingan nilai p", "bandingkan p dan q", "perbandingan kuantitas"], weight: 9 },
  { slug: "penalaran-kuantitatif-utbk-penalaran-operasi-bilangan", keywords: ["penalaran operasi", "operasi khusus", "simbol operasi"], weight: 8 },
  { slug: "penalaran-kuantitatif-utbk-penalaran-logika-posisi", keywords: ["penalaran posisi", "logika posisi", "arah mata angin", "posisi relatif"], weight: 8 },
  { slug: "penalaran-kuantitatif-utbk-analisis-kecukupan-data", keywords: ["kecukupan data", "cukup untuk menentukan", "pernyataan.*cukup", "analisis kecukupan"], weight: 9 },
];

// ────────────────────────────────────────────────────────────────────────────
// event_subtest → topik hints
// ────────────────────────────────────────────────────────────────────────────
const EVENT_SUBTEST_TOPIC_HINTS: Record<string, string[]> = {
  "TKA": ["penalaran-kuantitatif-utbk-analisis-kecukupan-data", "logika-penalaran-diskrit-penalaran-kuantitatif-utbk"],
  "UTBK": ["logika-penalaran-diskrit-penalaran-kuantitatif-utbk"],
  "OSN": ["diskrit-olimpiade-keterbagian-modulo", "diskrit-olimpiade-pigeonhole-principle"],
  "OSK": ["diskrit-olimpiade-keterbagian-modulo"],
};

// ────────────────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────────────────

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 5 });

  console.log("=== ACT-09: Topic Mapping ===");
  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}`);

  // 1. Load semua topik dari DB
  const topicsRaw = await sql<{ id: string; name: string; parent_id: string | null; level: number }[]>`
    SELECT id, name, parent_id, level FROM topics WHERE is_active = true ORDER BY level DESC
  `;
  const byId = new Map(topicsRaw.map((t) => [t.id, t]));
  const topicsBySlug = new Map<string, typeof topicsRaw[0]>();
  for (const t of topicsRaw) {
    topicsBySlug.set(slugify(t.name), t);
    if (t.parent_id && byId.has(t.parent_id)) {
      const p = byId.get(t.parent_id)!;
      topicsBySlug.set(`${slugify(p.name)}-${slugify(t.name)}`, t);
    }
  }
  const lhopital = topicsRaw.find((t) => t.name.toLowerCase().includes("hopital"));
  if (lhopital) topicsBySlug.set("turunan-fungsi-dalil-lhopital", lhopital);
  console.log(`Loaded ${topicsRaw.length} topik`);

  // 2. Build compiled rules
  interface CompiledRule {
    topicId: string;
    slug: string;
    patterns: RegExp[];
    weight: number;
  }

  const compiledRules: CompiledRule[] = [];
  for (const rule of TOPIC_RULES) {
    const topic = topicsBySlug.get(rule.slug);
    if (!topic) {
      console.warn(`  [WARN] Topik tidak ditemukan: ${rule.slug}`);
      continue;
    }
    const allPatterns = [
      ...rule.keywords.map((k) => new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")),
      ...(rule.latexPatterns ?? []).map((p) => new RegExp(p, "i")),
    ];
    compiledRules.push({ topicId: topic.id, slug: rule.slug, patterns: allPatterns, weight: rule.weight ?? 5 });
  }

  // 3. Load semua soal (batch)
  const totalRows = await sql<{ count: bigint }[]>`
    SELECT COUNT(*) as count FROM questions WHERE deleted_at IS NULL AND question_type != 'stimulus'
  `;
  const total = Number(totalRows[0].count);
  console.log(`Total soal (non-stimulus): ${total}`);

  let mapped = 0;
  let unmapped = 0;
  let offset = 0;

  interface QRow {
    id: string;
    content_markdown: string;
    event_subtest: string | null;
  }

  const inserts: { questionId: string; topicId: string; isPrimary: boolean }[] = [];

  while (offset < total) {
    const batch = await sql<QRow[]>`
      SELECT id, content_markdown, event_subtest
      FROM questions
      WHERE deleted_at IS NULL AND question_type != 'stimulus'
      ORDER BY created_at
      LIMIT ${BATCH_SIZE} OFFSET ${offset}
    `;
    offset += batch.length;

    for (const q of batch) {
      const text = (q.content_markdown ?? "").toLowerCase();

      // Score per topic
      const scoreMap = new Map<string, number>();

      for (const rule of compiledRules) {
        let hit = false;
        for (const pattern of rule.patterns) {
          if (pattern.test(text)) { hit = true; break; }
        }
        if (hit) {
          scoreMap.set(rule.topicId, (scoreMap.get(rule.topicId) ?? 0) + rule.weight);
        }
      }

      // event_subtest hints
      if (q.event_subtest) {
        for (const [key, slugList] of Object.entries(EVENT_SUBTEST_TOPIC_HINTS)) {
          if (q.event_subtest.toUpperCase().includes(key)) {
            for (const slug of slugList) {
              const t = topicsBySlug.get(slug);
              if (t) scoreMap.set(t.id, (scoreMap.get(t.id) ?? 0) + 3);
            }
          }
        }
      }

      if (scoreMap.size === 0) {
        unmapped++;
        continue;
      }

      // Sort by score, take top 3
      const sorted = [...scoreMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
      sorted.forEach(([topicId], idx) => {
        inserts.push({ questionId: q.id, topicId, isPrimary: idx === 0 });
      });
      mapped++;
    }

    process.stdout.write(`\r  Progress: ${Math.min(offset, total)}/${total} (mapped: ${mapped}, unmapped: ${unmapped})`);
  }

  console.log(`\n\nHasil mapping:`);
  console.log(`  - Soal terpetakan: ${mapped} (${((mapped / total) * 100).toFixed(1)}%)`);
  console.log(`  - Soal tidak terpetakan: ${unmapped} (${((unmapped / total) * 100).toFixed(1)}%)`);
  console.log(`  - Total entri question_topics: ${inserts.length}`);

  if (!DRY_RUN && inserts.length > 0) {
    console.log(`\nInserting ${inserts.length} entri ke question_topics...`);

    // Hapus mapping lama
    await sql`TRUNCATE question_topics RESTART IDENTITY CASCADE`;

    // Insert dalam batch
    const batchSize = 1000;
    for (let i = 0; i < inserts.length; i += batchSize) {
      const chunk = inserts.slice(i, i + batchSize);
      await sql`
        INSERT INTO question_topics ${sql(chunk.map((r) => ({
          question_id: r.questionId,
          topic_id: r.topicId,
          is_primary: r.isPrimary,
        })))}
        ON CONFLICT (question_id, topic_id) DO NOTHING
      `;
      process.stdout.write(`\r  Insert batch ${Math.min(i + batchSize, inserts.length)}/${inserts.length}`);
    }

    // Update usage_count di topics
    await sql`
      UPDATE topics t
      SET usage_count = sub.cnt
      FROM (
        SELECT topic_id, COUNT(*) as cnt
        FROM question_topics
        GROUP BY topic_id
      ) sub
      WHERE t.id = sub.topic_id
    `;

    console.log(`\n\nVerifikasi:`);
    const verification = await sql`
      SELECT t.name, COUNT(qt.question_id) as question_count 
      FROM topics t 
      LEFT JOIN question_topics qt ON t.id = qt.topic_id 
      WHERE t.level IN (2, 3)
      GROUP BY t.name 
      ORDER BY question_count DESC 
      LIMIT 20
    `;
    console.log("Top 20 topik berdasarkan jumlah soal:");
    for (const row of verification) {
      console.log(`  ${String(row.question_count).padStart(5)}  ${row.name}`);
    }
  } else if (DRY_RUN) {
    console.log("\n[DRY RUN] Tidak ada perubahan ke DB.");
  }

  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
