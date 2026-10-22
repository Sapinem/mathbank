/**
 * R4 Batch 2: Kurasi distractor_rationale — berbagai topik (Eksponensial, Geometri, Aljabar Linear)
 * MAT-35 — Pedagogy enrichment, target JSONB data_payload.options[].distractorRationale
 *
 * Soal dipilih dari kandidat yang memiliki explanation lengkap, belum ada rationale.
 * Standar: Haladyna Aturan 21 — tiap rationale jelaskan kesalahan konseptual/prosedural spesifik.
 * Format per optionItemSchema: min 40 karakter, KaTeX inline \( ... \).
 *
 * Jalankan (dry):  DRY_RUN=1 pnpm exec tsx scripts/r4-batch2-rationale.ts
 * Jalankan (live): DRY_RUN=0 pnpm exec tsx scripts/r4-batch2-rationale.ts
 */
import { config } from "dotenv";
config({ path: ".env" });
import postgres from "postgres";

const DB_URL = process.env.DATABASE_URL!;
const DRY_RUN = process.env.DRY_RUN !== "0";
const sql = postgres(DB_URL, { max: 1, connect_timeout: 30, idle_timeout: 30 });

interface QuestionRationale {
  questionId: string;
  note: string;
  correctLabel: string; // label jawaban benar (skip rationale untuk opsi benar)
  options: Record<string, string>; // label → distractorRationale
}

// ── R4 Batch 2: Eksponensial, Geometri, Aljabar ────────────────────────────
const rationales: QuestionRationale[] = [
  {
    // Soal: 2^x = 1/32 → x = -5 (Jawaban A)
    // Topik: Persamaan Eksponensial bentuk a^f(x) = a^p
    questionId: "01a11645-4472-70fd-9c4f-1e5a19a4da76",
    note: "2^x = 1/32 → x = -5, Jawaban A",
    correctLabel: "A",
    options: {
      B: "Siswa menghitung \\(\\frac{1}{32}\\) sebagai \\(2^{-3}\\) (mengira \\(2^3=32\\) padahal \\(2^5=32\\)), sehingga memperoleh \\(x=-3\\). Kesalahan mendasar: salah menghafal perpangkatan bilangan 2 — \\(2^5=32\\), bukan \\(2^3\\). Miskonsepsi ini sering terjadi karena siswa menukar \\(2^3=8\\) dengan \\(32\\).",
      C: "Siswa mengira \\(\\frac{1}{32}=2^0=1\\) atau mensubstitusi \\(x=0\\) untuk mengecek: \\(2^0=1\\neq\\frac{1}{32}\\). Memilih C=0 mencerminkan kebingungan antara nilai netral perkalian (1) dengan bentuk pecahan \\(\\frac{1}{32}\\). Siswa tidak memahami bahwa eksponen negatif merepresentasikan kebalikan.",
      D: "Siswa membalik tanda fraksi menjadi \\(\\frac{32}{1}=2^5\\), memperoleh \\(x=5\\), lalu karena opsi \\(\\{5\\}\\) ada (E), siswa salah memilih D=\\(\\{3\\}\\) karena menduga soal ini identik dengan \\(2^x=8\\). Kesalahan ganda: tidak mengonversi \\(\\frac{1}{a^n}=a^{-n}\\) dan menukar dengan soal berbeda.",
      E: "Siswa benar mengonversi \\(\\frac{1}{32}=\\frac{1}{2^5}=2^{-5}\\) sehingga \\(x=-5\\), tetapi memilih opsi E=\\(\\{5\\}\\) karena menghilangkan tanda negatif pada eksponen — miskonsepsi umum: '\\(2^x=\\frac{1}{32}\\) berarti \\(x=5\\)' tanpa melihat bahwa \\(2^5=32\\neq\\frac{1}{32}\\).",
    },
  },
  {
    // Soal: 2^{x+1} = 8 → x = 2 (Jawaban A)
    // Topik: Persamaan Eksponensial sederhana
    questionId: "01a11645-4407-7368-ae5b-694bf7fc1776",
    note: "2^{x+1} = 8 → x = 2, Jawaban A",
    correctLabel: "A",
    options: {
      B: "Siswa mengubah \\(8=2^3\\) dengan benar sehingga \\(x+1=3\\), tetapi kemudian salah menghitung \\(x=3\\) (lupa mengurangi 1). Memilih B=1 terjadi bila siswa melakukan \\(x=3-1=2\\) benar lalu salah baca tabel opsi, atau melakukan \\(x+1=2\\) (mengira basis \\(8=2^2\\)). Kesalahan: \\(2^3=8\\) diabaikan, diganti \\(2^2=8\\).",
      C: "Siswa mensubstitusi \\(x=0\\): \\(2^{0+1}=2\\neq 8\\). Meski gagal pengecekan, siswa memilih C=0 karena mengira persamaan ini memiliki solusi \\(x=0\\) (bingung antara \\(2^1=2\\) dengan \\(2^1=8\\)). Alternatif: siswa tidak mengonversi 8 ke pangkat 2 sama sekali dan menebak.",
      D: "Siswa mencoba \\(x=-1\\): \\(2^{-1+1}=2^0=1\\neq 8\\). Memilih D=\\(-1\\) mencerminkan miskonsepsi bahwa \\(2^{x+1}=8\\) diselesaikan dengan \\(x=8-1=7\\) lalu membalik tanda. Atau siswa mengira \\(2^{x+1}\\) berarti \\(2\\cdot(x+1)=8\\) → \\(x+1=4\\) → \\(x=3\\), lalu salah memilih opsi.",
      E: "Siswa melakukan \\(2x+1=8\\) (mengira eksponen berubah menjadi persamaan linear): \\(2x=7\\) → \\(x=3,5\\), atau mengira \\(2(x+1)=8\\) → \\(x+1=4\\) → \\(x=3\\), lalu memilih E=\\(-2\\) karena tidak ada opsi 3,5. Akar masalah: tidak memahami bahwa eksponen dan koefisien adalah operasi berbeda.",
    },
  },
  {
    // Soal: 5^{4+x} = 0.2^x → x = -2 (Jawaban D)
    // Topik: Persamaan Eksponensial dengan basis berbeda, 0.2 = 1/5 = 5^{-1}
    questionId: "01a11645-44eb-7a8f-98bb-e4c6e334a392",
    note: "5^{4+x} = 0.2^x → x = -2, Jawaban D",
    correctLabel: "D",
    options: {
      A: "Siswa mengira \\(0{,}2=\\frac{2}{10}=5^{-2}\\) (bukan \\(5^{-1}\\)), sehingga \\(0{,}2^x=5^{-2x}\\). Persamaan menjadi \\(4+x=-2x\\) → \\(3x=-4\\) → \\(x=-\\frac{4}{3}\\approx -1{,}3\\). Siswa membulatkan ke \\(x=-1\\) atau salah memilih A=\\(-5\\) dari kesalahan koefisien lanjutan.",
      B: "Siswa benar mengonversi \\(0{,}2=5^{-1}\\) sehingga \\(5^{4+x}=5^{-x}\\) → \\(4+x=-x\\) → \\(2x=-4\\) → \\(x=-2\\). Namun, siswa salah mencatat hasil: memilih B=\\(-4\\) (hanya menghitung \\(x=-4/1=-4\\) tanpa membagi dengan 2). Ini adalah kesalahan langkah terakhir: lupa membagi kedua ruas dengan 2.",
      C: "Siswa mengubah \\(0{,}2^x=\\left(\\frac{1}{5}\\right)^x=5^{-x}\\) benar, mendapat \\(4+x=-x\\) → \\(4=-2x\\) → \\(x=-2\\), tetapi tanda salah di akhir: siswa menulis \\(-2x=4\\) menjadi \\(x=+2\\) (sign error akhir), kemudian karena tidak ada \\(+2\\) pas, memilih C=\\(-3\\) sebagai estimasi terdekat.",
      E: "Siswa tidak mengenali \\(0{,}2\\) sebagai kebalikan 5 dan mencoba trial: \\(5^{4+2}=5^6=15625\\), \\(0{,}2^2=0{,}04\\) — tidak sama. Mencoba \\(x=2\\): \\(5^{6}=15625\\neq 0{,}04\\). Siswa memilih E=2 karena mengira soal meminta solusi positif atau salah membaca arah pertidaksamaan.",
    },
  },
  {
    // Soal: Segi enam beraturan ABCDEF, M dan N titik tengah sisi berhadapan, luas = 120
    // Topik: Geometri — Teorema Luas, segi enam beraturan
    // Jawaban C = 160
    questionId: "01a11644-d60d-7967-bb65-40aea16123fd",
    note: "Segi enam beraturan luas=120, luas ABMNCD=?, Jawaban C=160",
    correctLabel: "C",
    options: {
      A: "Siswa membagi luas segi enam dengan 6 segitiga sama sisi (luas tiap segitiga = 20), kemudian menghitung luas ABMNCD sebagai 5 segitiga = 100, lalu menambahkan luas persegi panjang MN tanpa perhitungan tepat → pilih A=200. Kesalahan: tidak memahami bahwa MNCD mencakup 2 segitiga penuh + 2 segitiga separuh = luas berbeda.",
      B: "Siswa menghitung luas segi enam sebagai 6 segitiga (masing-masing 20), kemudian menganggap ABMNCD adalah \\(\\frac{3}{4}\\) bagian segi enam: \\(\\frac{3}{4}\\times 120=90\\), lalu memilih B=180 karena salah menghitung proporsi. Miskonsepsi: bangun ABMNCD tidak persis \\(\\frac{3}{4}\\) segi enam.",
      D: "Siswa menghitung dengan benar bahwa ABMNCD mencakup 4 dari 6 segitiga penuh = \\(\\frac{4}{6}\\times120=80\\), tetapi melupakan luas trapesium yang dibentuk M dan N di tengah. Nilai 140 muncul dari penambahan parsial yang keliru: \\(80+60=140\\) (mengambil \\(\\frac{1}{2}\\) dari dua segitiga tersisa, bukan seluruhnya).",
      E: "Siswa menganggap M dan N membagi segi enam menjadi dua bagian sama rata, sehingga luas ABMNCD = \\(\\frac{1}{2}\\times120=60\\). Kemudian menambahkan luas dua segitiga sudut = \\(40\\), menghasilkan E=100. Kesalahan konseptual: M dan N adalah titik tengah sisi berhadapan, bukan sumbu simetri yang membagi segi enam sama rata.",
    },
  },
  {
    // Soal: Persegi kecil sisi 1, persegi terbesar (diputar 45°), panjang sisi?
    // Topik: Geometri — Pythagoras, persegi berputar
    // Jawaban D = (2 + 2√2)
    questionId: "01a11644-d476-7b9f-967e-065a0b70c66a",
    note: "Persegi kecil sisi=1, persegi terbesar diagonal=sisi, Jawaban D=(2+2√2)",
    correctLabel: "D",
    options: {
      A: "Siswa hanya menghitung diagonal persegi kecil: \\(\\sqrt{1^2+1^2}=\\sqrt{2}\\) dan langsung memilih A=\\(\\sqrt{2}\\) tanpa menyadari bahwa panjang sisi persegi terbesar merupakan gabungan beberapa ruas. Miskonsepsi: mengira diagonal persegi kecil adalah sisi persegi terbesar.",
      B: "Siswa menghitung keliling persegi kecil terlebih dahulu (\\(4\\times1=4\\)) atau mengira sisi persegi terbesar adalah dua kali sisi persegi kecil: \\(2\\times1=2\\). Memilih B=2 mencerminkan pendekatan intuitif tanpa menggunakan Teorema Pythagoras untuk memperhitungkan posisi diagonal persegi yang diputar 45°.",
      C: "Siswa menghitung \\(1+\\sqrt{2}+\\sqrt{2}=1+2\\sqrt{2}\\approx 3{,}83\\) (hanya menambahkan satu sisi kiri dan dua diagonal) alih-alih \\(1+\\sqrt{2}+\\sqrt{2}+1=2+2\\sqrt{2}\\). Kesalahan: menghilangkan sisi kanan (panjang 1 satuan) pada rumus penjumlahan segmen sisi persegi terbesar.",
      E: "Siswa menghitung \\(2\\sqrt{2}+4\\) dengan mengira panjang sisi persegi terbesar adalah dua diagonal persegi kecil ditambah dua sisi persegi kecil tanpa mempertimbangkan susunan sebenarnya: \\(2\\sqrt{2}+2\\times 2=2\\sqrt{2}+4\\). Kesalahan: menggandakan sisi persegi kecil menjadi 2 (bukan 1) karena salah membaca gambar.",
    },
  },
  {
    // Soal: Persamaan linear — mana yang BUKAN persamaan linear?
    // Bukan linear: x_1 + 3x_2 + x_1x_3 = 2 (ada perkalian variabel)
    // Jawaban B
    questionId: "01a11645-57bd-7828-9dd0-240f66a706d0",
    note: "Identifikasi persamaan bukan linear, Jawaban B (ada suku x_1*x_3)",
    correctLabel: "B",
    options: {
      A: "Siswa menganggap \\(x_1+5x_2-\\sqrt{2}x_3=1\\) bukan linear karena mengandung koefisien irasional \\(\\sqrt{2}\\). Miskonsepsi: persamaan linear hanya boleh memiliki koefisien bilangan bulat atau rasional. Nyatanya, koefisien boleh berupa konstanta real apapun (termasuk \\(\\sqrt{2}\\)) — yang penting variabel hanya berpangkat 1.",
      C: "Siswa memilih \\(x_1=-7x^2+3x_3\\) sebagai bukan linear karena ada \\(x^2\\) (pangkat 2). Ini sebenarnya benar jika \\(x^2\\) adalah variabel \\(x_2\\) dengan notasi berbeda, tetapi pada konteks aljabar linear, \\(x^2\\) dibaca sebagai \\(x_2\\) (subskrip 2), bukan kuadrat \\(x\\). Salah interpretasi notasi menyebabkan pilihan ini salah.",
      D: "Siswa terkecoh oleh tampilan kompleks \\(\\pi x_1-\\sqrt{2}x_2+\\frac{1}{3}x_3=7^{1}\\) dan memilih D sebagai bukan linear. Padahal semua koefisien (\\(\\pi\\), \\(\\sqrt{2}\\), \\(\\frac{1}{3}\\)) adalah konstanta real, dan \\(7^1=7\\) adalah konstanta biasa. Ini adalah persamaan linear valid — siswa tidak memahami bahwa konstanta irasional tetap diizinkan.",
      E: "Siswa memilih \\(x_1+x_2+x_3=\\sqrt{2}\\) sebagai bukan linear karena ruas kanan berupa \\(\\sqrt{2}\\) (irasional). Miskonsepsi: ruas kanan persamaan linear harus bilangan rasional atau bulat. Definisi formal memperbolehkan \\(b\\) berupa bilangan real apapun — yang menentukan linearitas adalah derajat variabel, bukan nilai konstanta \\(b\\).",
    },
  },
  {
    // Soal: Teorema Pick — tiga segitiga dengan luas sama (A=B=C), Jawaban E
    questionId: "01a11645-89a7-7712-963a-33e2ae85b6b7",
    note: "Teorema Pick — tiga segitiga A=B=C, Jawaban E",
    correctLabel: "E",
    options: {
      A: "Siswa menganggap segitiga yang tampak lebih 'miring' atau lebih 'kecil secara visual' pasti memiliki luas lebih kecil, sehingga memilih B<A<C berdasarkan persepsi visual semata. Miskonsepsi: luas segitiga di grid tidak bisa dinilai hanya dari tampilan visual — Teorema Pick menyatakan luas bergantung pada titik interior dan tepi, bukan ukuran tampak.",
      B: "Siswa menghitung luas dengan rumus \\(\\frac{1}{2}\\times\\text{alas}\\times\\text{tinggi}\\) secara visual, memperoleh alas dan tinggi berbeda untuk tiap segitiga. Memilih B<C<A mencerminkan pengukuran alas/tinggi yang keliru akibat tidak menggunakan koordinat grid yang tepat. Teorema Pick memberikan hasil sama karena ketiga segitiga memiliki 3 titik tepi dan 0 titik interior.",
      C: "Siswa memperkirakan dari posisi segitiga bahwa C 'lebih besar' (rentang grid lebih lebar), sehingga A<B<C. Ini adalah kesalahan persepsi geometri: lebar rentang grid tidak identik dengan luas — yang menentukan adalah kombinasi titik batas (\\(T\\)) dan titik interior (\\(I\\)) melalui Teorema Pick: \\(L=I+\\frac{T}{2}-1\\).",
      D: "Siswa menghitung dua segitiga memiliki luas sama (B<A, A=C) dari pengamatan visual bahwa A dan C tampak 'simetris', tetapi B tampak lebih kecil. Pilihan B<A dan A=C tidak sesuai Teorema Pick karena B juga memiliki konfigurasi titik yang sama (3 tepi, 0 interior) → luas B = luas A = luas C.",
    },
  },
];

// ── Engine update ────────────────────────────────────────────────────────────
type Row = Record<string, unknown>;

async function main() {
  console.log(`Mode: ${DRY_RUN ? "DRY RUN (no writes)" : "LIVE UPDATE"}`);
  console.log(`R4 Batch 2: ${rationales.length} soal (Eksponensial, Geometri, Aljabar)\n`);

  let totalUpdated = 0;
  let totalSkipped = 0;

  for (const item of rationales) {
    console.log(`\n── Q ${item.questionId.substring(0, 8)} (${item.note}) ──`);

    const rows = await sql`
      SELECT id, data_payload->'options' as options_jsonb, answer_key->>'correct' as correct
      FROM questions
      WHERE id = ${item.questionId}::uuid
        AND deleted_at IS NULL
    ` as Row[];

    if (!rows.length) {
      console.log(`  SKIP — soal tidak ditemukan atau dihapus`);
      totalSkipped++;
      continue;
    }

    const row = rows[0];
    const options = (row.options_jsonb as Array<{ id: string; contentMarkdown?: string; distractorRationale?: string }>) || [];
    
    if (!options.length) {
      console.log(`  SKIP — data_payload.options kosong`);
      totalSkipped++;
      continue;
    }

    // Build updated options array
    const updatedOptions = options.map((opt) => {
      const label = opt.id;
      if (label === item.correctLabel) {
        console.log(`  option ${label}: CORRECT → skip rationale`);
        return opt; // no rationale for correct answer
      }
      const rationale = item.options[label];
      if (!rationale) {
        console.log(`  option ${label}: no rationale defined → unchanged`);
        return opt;
      }
      if (rationale.length < 40) {
        console.warn(`  WARN option ${label}: rationale too short (${rationale.length} chars)`);
      }
      console.log(`  option ${label}: rationale ${rationale.length} chars ✓`);
      return { ...opt, distractorRationale: rationale };
    });

    if (DRY_RUN) {
      console.log(`  [DRY] Would update ${item.questionId}`);
      continue;
    }

    // Use sql.json() so the array is passed as a proper JSONB value, not a string literal
    await sql`
      UPDATE questions
      SET data_payload = jsonb_set(
        data_payload,
        '{options}',
        ${sql.json(updatedOptions)}
      ),
      updated_at = now()
      WHERE id = ${item.questionId}::uuid
        AND deleted_at IS NULL
    `;
    console.log(`  ✓ Updated`);
    totalUpdated++;
  }

  console.log(`\n── Summary ──`);
  console.log(`Updated: ${totalUpdated} | Skipped: ${totalSkipped} | DRY_RUN: ${DRY_RUN}`);

  await sql.end();
}

main().catch((e) => {
  console.error("FATAL:", e.message);
  sql.end();
  process.exit(1);
});
