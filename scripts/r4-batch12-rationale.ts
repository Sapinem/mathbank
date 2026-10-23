/**
 * MAT-35 Batch 12 — R4 Distractor Rationale
 * Bangun Datar SMP (10 soal): sudut segitiga, diagonal persegipanjang,
 * luas gabungan, keliling bangun, himpunan bagian, syarat segitiga
 *
 * Format: data_payload.options[].distractorRationale (JSONB, MAT-144)
 * Standar: Haladyna R21, miskonsepsi spesifik, KaTeX inline \( ... \), ≥ 40 char/opsi
 */

import postgres from "postgres";
import { config } from "dotenv";

config({ path: ".env" });

const DRY_RUN = process.env.DRY_RUN !== "0";
const DATABASE_URL = process.env.DATABASE_URL!;

const sql = postgres(DATABASE_URL, { max: 2 });

interface OptionWithRationale {
  id: string;
  contentMarkdown: string;
  distractorRationale: string;
}

interface QuestionPatch {
  id: string;
  label: string;
  options: OptionWithRationale[];
}

const patches: QuestionPatch[] = [
  {
    // Soal 1: Besar sudut BAC — sudut-sudut segitiga dengan variabel
    // ABC=8x+1, BCA=4x+7, BAC=2x+4; jumlah=180 → x=12 → BAC=28°
    id: "01a11562-f16a-7bf5-b61f-d1e2e6939be1",
    label: "Sudut BAC dalam segitiga (8x+1, 4x+7, 2x+4)",
    options: [
      {
        id: "A",
        contentMarkdown: "\\( \\ 24^{\\circ} \\)",
        distractorRationale:
          "Siswa mensubstitusi \\(x=12\\) ke ekspresi sudut yang salah. Mengira \\(\\angle BAC = 2x = 2(12) = 24^{\\circ}\\) karena melupakan konstanta \\(+4\\) pada ekspresi \\(2x+4\\). Ini adalah kesalahan aritmetika parsial: substitusi nilai \\(x\\) benar tetapi evaluasi ekspresi tidak lengkap.",
      },
      {
        id: "B",
        contentMarkdown: "\\( \\ 28^{\\circ} \\)",
        distractorRationale:
          "Kunci jawaban. Jumlah sudut \\(180 = (8x+1)+(4x+7)+(2x+4) = 14x+12\\), sehingga \\(x=12\\). Besar \\(\\angle BAC = 2(12)+4 = 28^{\\circ}\\).",
      },
      {
        id: "C",
        contentMarkdown: "\\( \\ 55^{\\circ} \\)",
        distractorRationale:
          "Siswa membagi total \\(180^{\\circ}\\) dengan jumlah suku variabel \\((14)\\) dan membulatkan: \\(180/14 \\approx 12{,}9\\), lalu mengalikan dengan \\(4\\) (koefisien \\(x\\) dalam \\(4x+7\\)) menghasilkan sekitar \\(55\\). Miskonsepsi: mencampurkan koefisien sudut yang berbeda atau mengira soal meminta sudut \\(BCA\\).",
      },
      {
        id: "D",
        contentMarkdown: "\\( \\ 65^{\\circ} \\)",
        distractorRationale:
          "Siswa mengira \\(\\angle BAC\\) adalah komplemen dari \\(\\angle ABC\\) karena menyangka ada sudut siku-siku. Atau menghitung \\(180 - (8(12)+1) = 180-97 = 83\\) kemudian salah membagi: \\(83/\\approx 65\\). Miskonsepsi utama: tidak menggunakan persamaan jumlah tiga sudut dan malah mencoba relasi dua sudut.",
      },
    ],
  },
  {
    // Soal 2: Diagonal persegipanjang — (6x+4) = (7x-1) → x=5 → d=34m
    id: "01a11562-f379-73e2-8107-46cddfa2e961",
    label: "Panjang diagonal persegipanjang (6x+4) = (7x-1)",
    options: [
      {
        id: "A",
        contentMarkdown: "\\( \\ 5\\ m \\)",
        distractorRationale:
          "Siswa menemukan nilai \\(x=5\\) yang benar dari persamaan \\(6x+4=7x-1\\), tetapi keliru mengira bahwa \\(x\\) itu sendiri adalah panjang diagonal. Miskonsepsi: \\(x\\) adalah parameter persamaan, bukan ukuran fisik diagonal. Panjang diagonal harus disubstitusi kembali: \\(6(5)+4=34\\).",
      },
      {
        id: "B",
        contentMarkdown: "\\( \\ 26\\ m \\)",
        distractorRationale:
          "Siswa menghitung salah satu diagonal dengan ekspresi keliru \\(7x-1\\) lalu memperoleh \\(7(5)-1=34\\), tetapi kemudian mengira diagonal pertama adalah \\(6(5)-4=26\\) dengan mengubah tanda \\(+4\\) menjadi \\(-4\\). Kesalahan tanda pada substitusi ekspresi.",
      },
      {
        id: "C",
        contentMarkdown: "\\( \\ 34\\ m \\)",
        distractorRationale:
          "Kunci jawaban. Diagonal persegipanjang sama panjang: \\(6x+4=7x-1 \\Rightarrow x=5\\). Panjang diagonal \\(= 6(5)+4 = 34\\) m.",
      },
      {
        id: "D",
        contentMarkdown: "\\( \\ 36\\ m \\)",
        distractorRationale:
          "Siswa menambahkan kedua konstanta: \\(4+1=5\\), kemudian menghitung \\(7(5)+1=36\\) dengan mengira \\(-1\\) berubah tanda menjadi \\(+1\\). Atau menghitung \\(34+2=36\\) karena beranggapan ada dua diagonal yang dijumlah. Miskonsepsi: panjang diagonal adalah total dua diagonal, padahal diminta satu diagonal.",
      },
    ],
  },
  {
    // Soal 3: Luas daerah yang diarsir B — [A+B]=35, [B+C]=60, A+C=55 → B=20
    id: "01a11562-f594-773e-b23c-3591d1d1a796",
    label: "Luas daerah diarsir B (segitiga terbagi 3 bagian)",
    options: [
      {
        id: "A",
        contentMarkdown: "\\( \\ 5\\ cm^{2} \\)",
        distractorRationale:
          "Siswa salah menafsirkan: menghitung \\([A+B]-[B+C] = 35-60 = -25\\) lalu mengambil nilai mutlak \\(25\\), kemudian dibagi \\(5\\) tanpa alasan. Atau mengira luas arsiran adalah selisih \\(\\frac{60-55}{2}=\\frac{5}{2}\\) dan membulatkan. Miskonsepsi: tidak memahami hubungan aljabar tiga bagian.",
      },
      {
        id: "B",
        contentMarkdown: "\\( \\ 10\\ cm^{2} \\)",
        distractorRationale:
          "Siswa menghitung \\([A+B+B+C]-(A+C) = (35+60)-55 = 40\\) dengan benar, tetapi lupa membagi \\(2\\): \\(B = 40\\) bukan \\(40/2=20\\). Atau siswa menghitung \\([B] = \\frac{35-55}{2} = -10\\) dan mengambil nilai mutlak \\(10\\). Miskonsepsi: tidak memahami bahwa \\(B\\) muncul dua kali dalam penjumlahan.",
      },
      {
        id: "C",
        contentMarkdown: "\\( \\ 20\\ cm^{2} \\)",
        distractorRationale:
          "Kunci jawaban. \\([A+B]+[B+C] = 35+60=95\\). Karena \\([A+C]=55\\), maka \\(55+2B=95\\), sehingga \\(B=20\\ cm^2\\).",
      },
      {
        id: "D",
        contentMarkdown: "\\( \\ 40\\ cm^{2} \\)",
        distractorRationale:
          "Siswa menghitung \\((35+60)-55=40\\) dengan benar sebagai \\(2B\\), tetapi tidak membagi dua dan langsung menyatakan \\(B=40\\). Miskonsepsi kritis: lupa bahwa dalam persamaan \\([A+C]+2B=95\\), nilai \\(B\\) harus dibagi dua, bukan langsung diambil sebagai selisih.",
      },
    ],
  },
  {
    // Soal 4: Luas huruf U — 3 persegipanjang: 90+90+48=228 cm²
    id: "01a11562-7d7a-718d-9b36-5e43b37cd02a",
    label: "Luas karton huruf U (3 persegipanjang)",
    options: [
      {
        id: "A",
        contentMarkdown: "\\( \\ 228\\ cm^{2} \\)",
        distractorRationale:
          "Kunci jawaban. Huruf U terdiri dari dua persegipanjang vertikal (\\(5 \\times 18 = 90\\) masing-masing) dan satu persegipanjang horizontal bawah (\\(8 \\times 6 = 48\\)). Total \\(90+90+48=228\\ cm^2\\).",
      },
      {
        id: "B",
        contentMarkdown: "\\( \\ 168\\ cm^{2} \\)",
        distractorRationale:
          "Siswa menghitung dua persegipanjang vertikal dengan dimensi salah: \\(6 \\times 12 = 72\\) untuk masing-masing (mengira tinggi sisi \\(12\\) bukan \\(18\\)), lalu menambah \\(24\\): \\(72+72+24=168\\). Atau menghitung \\(90+90-12=168\\) karena mengira bagian tengah huruf U yang kosong harus dikurangi sekali. Miskonsepsi: tidak memisahkan bangun secara benar.",
      },
      {
        id: "C",
        contentMarkdown: "\\( \\ 120\\ cm^{2} \\)",
        distractorRationale:
          "Siswa mengira huruf U hanya terdiri dari dua persegipanjang vertikal saja tanpa dasar horizontal: \\(2 \\times 5 \\times 12 = 120\\). Miskonsepsi: tidak menambahkan bagian bawah huruf U atau salah membagi bangun menjadi bagian-bagian yang benar.",
      },
      {
        id: "D",
        contentMarkdown: "\\( \\ 100\\ cm^{2} \\)",
        distractorRationale:
          "Siswa menghitung luas persegipanjang besar yang meliputi seluruh huruf U: \\((5+8+5) \\times \\text{tinggi}\\) dengan dimensi yang keliru, atau mengira luas huruf U adalah \\(10 \\times 10 = 100\\). Miskonsepsi: tidak memahami bahwa huruf U bukan persegipanjang utuh—bagian tengah atas kosong, sehingga perlu metode dekomposisi.",
      },
    ],
  },
  {
    // Soal 5: Keliling bangun FL=KD=12, FK=4, FM=DE=16 → keliling=80cm
    id: "01a11562-80f0-760a-92f4-f4805f0d6e54",
    label: "Keliling bangun datar dengan dua segitiga siku-siku",
    options: [
      {
        id: "A",
        contentMarkdown: "\\( \\ 78\\ cm \\)",
        distractorRationale:
          "Siswa melewatkan satu sisi atau salah menghitung hipotenusa. Mungkin menghitung \\(16+8+20+12+4+18=78\\) menggunakan \\(18\\) sebagai pengganti \\(20\\), atau tidak menyadari adanya dua hipotenusa yang sama. Miskonsepsi: dalam bangun gabungan, mudah melewatkan sisi yang tersembunyi atau salah mengidentifikasi panjang diagonal.",
      },
      {
        id: "B",
        contentMarkdown: "\\( \\ 80\\ cm \\)",
        distractorRationale:
          "Kunci jawaban. Hipotenusa segitiga siku-siku EDK dan FLM masing-masing \\(= \\sqrt{12^2+16^2}=\\sqrt{144+256}=\\sqrt{400}=20\\). Keliling total: \\(16+8+20+12+4+20=80\\) cm.",
      },
      {
        id: "C",
        contentMarkdown: "\\( \\ 86\\ cm \\)",
        distractorRationale:
          "Siswa menghitung hipotenusa dengan Pythagoras secara keliru: \\(12+16=28\\) alih-alih \\(\\sqrt{12^2+16^2}=20\\). Kemudian \\(16+8+28+12+4+18=86\\) atau kombinasi serupa. Miskonsepsi: menjumlahkan dua sisi alih-alih menggunakan Teorema Pythagoras untuk menghitung hipotenusa segitiga siku-siku.",
      },
      {
        id: "D",
        contentMarkdown: "\\( \\ 92\\ cm \\)",
        distractorRationale:
          "Siswa menghitung semua segmen termasuk sisi-sisi dalam yang berimpit (sisi yang tidak termasuk batas bangun). Misalnya menghitung kedua sisi tegak dan mendatar segitiga sekaligus hipotenusanya: \\(16+12+20+16+12+20+4+8-\\ldots = 92\\). Miskonsepsi: tidak memahami bahwa sisi-sisi dalam dua bangun yang berimpit tidak termasuk keliling.",
      },
    ],
  },
  {
    // Soal 6: Luas huruf L — 2 persegipanjang: 4×2=8 dan 5×2=10 → total=18
    id: "01a11562-3a52-7176-9b8d-c66327bc6b56",
    label: "Luas karton huruf L (2 persegipanjang)",
    options: [
      {
        id: "A",
        contentMarkdown: "\\( \\ 30\\ cm^{2} \\)",
        distractorRationale:
          "Siswa menghitung luas persegipanjang besar yang mengelilingi huruf L: \\((4+2) \\times 5 = 30\\) atau \\(6 \\times 5 = 30\\), tanpa mengurangi bagian yang kosong. Miskonsepsi: memperlakukan huruf L seolah-olah persegipanjang penuh tanpa memperhatikan lekukan bagian atas.",
      },
      {
        id: "B",
        contentMarkdown: "\\( \\ 20\\ cm^{2} \\)",
        distractorRationale:
          "Siswa mengira huruf L memiliki dimensi \\(4 \\times 5 = 20\\), menggunakan panjang total sebagai satu sisi dan lebar sebagai sisi lain. Atau menghitung satu persegipanjang dengan benar \\(5 \\times 2 = 10\\) lalu mengalikan dua: \\(2 \\times 10 = 20\\) tanpa memperhatikan dimensi berbeda. Miskonsepsi: tidak mendekomposisi bangun dan menggunakan dimensi total sebagai luas.",
      },
      {
        id: "C",
        contentMarkdown: "\\( \\ 18\\ cm^{2} \\)",
        distractorRationale:
          "Kunci jawaban. Huruf L dibagi menjadi dua persegipanjang: \\(4 \\times 2 = 8\\ cm^2\\) dan \\(5 \\times 2 = 10\\ cm^2\\). Total \\(8+10=18\\ cm^2\\).",
      },
      {
        id: "D",
        contentMarkdown: "\\( \\ 10\\ cm^{2} \\)",
        distractorRationale:
          "Siswa hanya menghitung satu persegipanjang (bagian vertikal atau horizontal huruf L) dan melewatkan yang lain: \\(5 \\times 2 = 10\\). Miskonsepsi: tidak menyelesaikan dekomposisi bangun, hanya mengidentifikasi satu komponen dari dua komponen yang ada.",
      },
    ],
  },
  {
    // Soal 7: Luas jalan trapesium — L_tanah=600, L_kolam=384, L_jalan=216 m²
    id: "01a11560-c3fc-7fb7-a91b-d12d5d2e335c",
    label: "Luas jalan setapak trapesium sebangun",
    options: [
      {
        id: "A",
        contentMarkdown: "\\( \\ 216\\ m^{2} \\)",
        distractorRationale:
          "Kunci jawaban. Rasio kesebangunan \\(\\frac{20}{25}=\\frac{4}{5}\\). Sisi sejajar kolam: \\(x=12\\) m dan \\(y=45\\) m. \\(L_{\\text{tanah}}=\\frac{1}{2}(15+45)\\times 20=600\\), \\(L_{\\text{kolam}}=\\frac{1}{2}(12+36)\\times 16=384\\). Luas jalan \\(=600-384=216\\ m^2\\).",
      },
      {
        id: "B",
        contentMarkdown: "\\( \\ 226\\ m^{2} \\)",
        distractorRationale:
          "Siswa melakukan kesalahan kecil pada perhitungan luas kolam: menggunakan \\(t=15\\) (bukan \\(16\\)) akibat salah membaca rasio kesebangunan: \\(L_k = \\frac{1}{2}(12+36)\\times 15=360\\), lalu \\(600-360=240\\approx 226\\). Atau melakukan kesalahan aritmetika pada persamaan kesebangunan sehingga mendapat dimensi kolam yang sedikit berbeda.",
      },
      {
        id: "C",
        contentMarkdown: "\\( \\ 236\\ m^{2} \\)",
        distractorRationale:
          "Siswa menggunakan faktor skala yang salah untuk menghitung dimensi kolam, misalnya mengira skala \\(\\frac{3}{4}\\) alih-alih \\(\\frac{4}{5}\\). Dengan demikian \\(x=\\frac{3}{4}\\times 15=11{,}25\\) dan \\(t=15\\), menghasilkan \\(L_k\\) yang berbeda dan \\(L_j=236\\). Miskonsepsi: salah menentukan faktor kesebangunan dari pasangan sisi yang bersesuaian.",
      },
      {
        id: "D",
        contentMarkdown: "\\( \\ 316\\ m^{2} \\)",
        distractorRationale:
          "Siswa langsung menghitung \\(L_{\\text{tanah}}-L_{\\text{kolam}}\\) tanpa menerapkan kesebangunan: menggunakan dimensi kolam yang diberikan secara mentah (\\(36\\) dan \\(20\\) sebagai sisi atas dan tinggi), mendapatkan \\(L_k = \\frac{1}{2}(36+45)\\times...\\) yang keliru. Atau menghitung \\(600-\\frac{1}{2}(36)\\times 16=600-288=312\\approx 316\\). Miskonsepsi: tidak menghitung dimensi kolam melalui perbandingan kesebangunan.",
      },
    ],
  },
  {
    // Soal 8: Kawat pagar — keliling=84m, 3 lapis → 3×84=252m
    id: "01a11560-c46f-7b88-9a31-f376735afe0a",
    label: "Panjang kawat pagar 3 lapis — persegipanjang 24×18",
    options: [
      {
        id: "A",
        contentMarkdown: "\\( \\ 432\\ \\text{meter} \\)",
        distractorRationale:
          "Siswa menghitung luas tanah alih-alih keliling: \\(24 \\times 18 = 432\\) m², kemudian menyatakannya sebagai panjang kawat tanpa mengalikan dengan 3. Miskonsepsi ganda: (1) menggunakan rumus luas \\(p \\times l\\) bukan keliling \\(2(p+l)\\), dan (2) tidak mempertimbangkan faktor 3 lapisan.",
      },
      {
        id: "B",
        contentMarkdown: "\\( \\ 360\\ \\text{meter} \\)",
        distractorRationale:
          "Siswa menghitung \\((24+18) \\times 3 \\times 2 = 252\\) dengan benar, atau mungkin menghitung \\(24 \\times 3 + 18 \\times 3 = 72 + 54 = 126 \\times 2 = 252\\), tetapi ada yang menghitung \\(2(24+18) \\times 5 = 420\\) atau variasi lain. Kemungkinan lain: mengira keliling \\(= 24+18+24+18=84\\) lalu \\(84 \\times 4=336\\approx 360\\). Miskonsepsi: salah menerapkan faktor pengali lapisan.",
      },
      {
        id: "C",
        contentMarkdown: "\\( \\ 252\\ \\text{meter} \\)",
        distractorRationale:
          "Kunci jawaban. Keliling \\(= 2(24+18) = 2 \\times 42 = 84\\) m. Tiga lapis: \\(3 \\times 84 = 252\\) m.",
      },
      {
        id: "D",
        contentMarkdown: "\\( \\ 162\\ \\text{meter} \\)",
        distractorRationale:
          "Siswa menghitung \\((24+18) \\times 3 = 126\\) (menggunakan setengah keliling dikali 3), lupa faktor 2 pada rumus keliling. Atau menghitung \\(24+18+24+18 = 84\\) lalu \\(84 \\times 2 = 168\\) kemudian dikurangi nilai tertentu \\(\\approx 162\\). Miskonsepsi: menggunakan \\(p+l\\) bukan \\(2(p+l)\\) untuk keliling, sehingga hasil akhirnya separuh dari yang benar sebelum dikali 3.",
      },
    ],
  },
  {
    // Soal 9: Luas daerah diarsir ABC+CDE — [ABE]=80, [BED]=120, [BCE]=32
    // [ABC]=48, [CDE]=88, total=136
    id: "01a11560-c70a-723e-82a2-18c9ef44fb11",
    label: "Luas daerah diarsir segitiga ABE & BED (basis bersama)",
    options: [
      {
        id: "A",
        contentMarkdown: "\\( \\ 136\\ m^{2} \\)",
        distractorRationale:
          "Kunci jawaban. \\([ABE]=\\frac{1}{2}\\cdot 16 \\cdot 10=80\\); \\([BCE]=\\frac{1}{2}\\cdot 16 \\cdot 4=32\\); sehingga \\([ABC]=80-32=48\\). Untuk \\([BED]=\\frac{1}{2}\\cdot 16 \\cdot 15=120\\); \\([CDE]=120-32=88\\). Total diarsir \\(=48+88=136\\ cm^2\\).",
      },
      {
        id: "B",
        contentMarkdown: "\\( \\ 163\\ m^{2} \\)",
        distractorRationale:
          "Hasil dari kesalahan angka: siswa menggunakan tinggi \\(15\\) untuk \\([ABE]\\) dan \\(10\\) untuk \\([BED]\\) (tertukar), mendapat \\([ABE]=\\frac{1}{2}\\cdot 16\\cdot 15=120\\) dan \\([BED]=\\frac{1}{2}\\cdot 16\\cdot 10=80\\). Kemudian melanjutkan dengan kalkulasi yang campur: \\((120-32)+(80-32)=88+48=136\\) tetap benar, jadi \\(163\\) muncul dari kesalahan aritmetika terpisah, misal salah menghitung \\(88+32+\\ldots\\). Miskonsepsi: tertukar antara tinggi dua segitiga besar.",
      },
      {
        id: "C",
        contentMarkdown: "\\( \\ 200\\ m^{2} \\)",
        distractorRationale:
          "Siswa langsung menjumlahkan dua segitiga besar tanpa mengurangi \\([BCE]\\): \\([ABE]+[BED]=80+120=200\\). Miskonsepsi: mengira luas diarsir adalah seluruh \\([ABE]\\) dan \\([BED]\\), padahal segitiga \\([BCE]\\) tidak diarsir dan harus dikurangi dari masing-masing segitiga besar.",
      },
      {
        id: "D",
        contentMarkdown: "\\( \\ 236\\ m^{2} \\)",
        distractorRationale:
          "Siswa menghitung jumlah semua segitiga yang mungkin terbentuk: \\(80+120+\\frac{1}{2}\\cdot 16\\cdot 4\\times 2\\approx 236\\). Atau menggunakan dimensi yang keliru: \\(\\frac{1}{2}\\cdot 16\\cdot(10+15+4)=\\frac{1}{2}\\cdot 16\\cdot 29=232\\approx 236\\). Miskonsepsi: menjumlahkan semua tinggi tanpa memahami bahwa \\(BCE\\) adalah segitiga bersama yang tidak boleh dihitung ganda.",
      },
    ],
  },
  {
    // Soal 10: Syarat segitiga — jumlah dua sisi > sisi ketiga → b+c>a
    id: "01a11560-cc2c-71c3-97a0-f10076f2be2a",
    label: "Syarat panjang sisi segitiga (a>b>c)",
    options: [
      {
        id: "A",
        contentMarkdown: "\\( \\ b+c \\gt a \\)",
        distractorRationale:
          "Kunci jawaban. Syarat segitiga: jumlah dua sisi harus lebih besar dari sisi ketiga. Karena \\(a\\) adalah sisi terpanjang (\\(a>b>c\\)), syarat yang paling ketat dan paling mudah dilanggar adalah \\(b+c > a\\). Ini adalah pernyataan yang benar.",
      },
      {
        id: "B",
        contentMarkdown: "\\( \\ a+c \\lt b \\)",
        distractorRationale:
          "Pernyataan ini selalu salah: karena \\(a > b\\), pasti \\(a+c > b\\) (dan \\(a > b\\) sudah cukup). Siswa mungkin bingung dengan arah pertidaksamaan, mengira bahwa sisi terbesar harus lebih besar dari jumlah dua sisi lain — inilah kebalikan dari syarat sebenarnya. Miskonsepsi umum: \\(a + c < b\\) hanya mungkin jika \\(a\\) dan \\(c\\) sangat kecil, tetapi berlawanan dengan syarat \\(a > b\\).",
      },
      {
        id: "C",
        contentMarkdown: "\\( \\ a+b \\lt c \\)",
        distractorRationale:
          "Pernyataan ini juga mustahil: karena \\(a > b > c\\), sudah pasti \\(a > c\\) sehingga \\(a + b > c\\) selalu berlaku. Siswa yang memilih ini mungkin membalik urutan variabel atau mengira syarat segitiga menyatakan sisi terkecil harus lebih besar dari jumlah dua sisi lain — kesalahan konsep fundamental.",
      },
      {
        id: "D",
        contentMarkdown: "\\( \\ a+b = c \\)",
        distractorRationale:
          "Jika \\(a+b = c\\), ketiga titik sudut koliner (membentuk garis lurus, bukan segitiga). Siswa mungkin mengingat bahwa ada syarat 'penjumlahan sisi' tetapi salah menggunakan tanda sama dengan (\\(=\\)) alih-alih pertidaksamaan (\\(<\\)). Jika \\(a+b=c\\) dan \\(c\\) adalah sisi terbesar, ini justru menunjukkan segitiga degenerasi (bukan segitiga nyata).",
      },
    ],
  },
];

async function applyPatch(q: QuestionPatch): Promise<boolean> {
  // Fetch current options
  const rows = await sql`
    SELECT data_payload->'options' as options
    FROM questions
    WHERE id = ${q.id}::uuid
    AND deleted_at IS NULL
  `;

  if (rows.length === 0) {
    console.error(`  SKIP — ID not found: ${q.id}`);
    return false;
  }

  const existing = rows[0].options as unknown;
  if (!Array.isArray(existing)) {
    console.error(`  SKIP — options is not an array for ${q.id}`);
    return false;
  }

  // Merge distractorRationale into each option
  const updated = existing.map((opt: Record<string, unknown>) => {
    const patch = q.options.find((p) => p.id === opt.id);
    if (patch) {
      return { ...opt, distractorRationale: patch.distractorRationale };
    }
    return opt;
  });

  if (DRY_RUN) {
    console.log(`  [DRY_RUN] Would update ${q.id} (${q.label})`);
    updated.forEach((opt: Record<string, unknown>) => {
      const dr = opt.distractorRationale as string | undefined;
      console.log(
        `    Opt ${opt.id}: ${dr ? dr.substring(0, 60) + "…" : "NO RATIONALE"}`
      );
    });
    return true;
  }

  await sql`
    UPDATE questions
    SET data_payload = jsonb_set(
      data_payload,
      '{options}',
      ${sql.json(updated)}::jsonb,
      true
    )
    WHERE id = ${q.id}::uuid
    AND deleted_at IS NULL
  `;

  console.log(`  UPDATED: ${q.id} (${q.label})`);
  return true;
}

async function main() {
  console.log(`=== MAT-35 Batch 12 R4 Rationale ===`);
  console.log(`DRY_RUN=${DRY_RUN} | ${patches.length} soal`);
  console.log("");

  let success = 0;
  for (const patch of patches) {
    console.log(`Processing: ${patch.label}`);
    const ok = await applyPatch(patch);
    if (ok) success++;
  }

  console.log("");
  console.log(`=== Done: ${success}/${patches.length} soal berhasil ===`);

  // Verify metrics
  const metrics = await sql`
    SELECT 
      COUNT(*) FILTER (WHERE question_type = 'single_choice' AND 
        data_payload->'options' IS NOT NULL AND
        jsonb_typeof(data_payload->'options') = 'array' AND
        jsonb_array_length(data_payload->'options') > 0 AND
        EXISTS(
          SELECT 1 FROM jsonb_array_elements(data_payload->'options') opt
          WHERE opt->>'distractorRationale' IS NOT NULL AND length(opt->>'distractorRationale') > 10
        )) AS sc_with_dr,
      COUNT(*) FILTER (WHERE question_type = 'single_choice') AS total_sc
    FROM questions
    WHERE deleted_at IS NULL
  `;

  const m = metrics[0] as { sc_with_dr: string; total_sc: string };
  console.log(
    `\nMetrik DB: ${m.sc_with_dr} SC ber-DR dari ${m.total_sc} total SC`
  );

  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
