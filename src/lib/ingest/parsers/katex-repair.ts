/**
 * PEMBERSIH ADAPTIF — perbaikan spesifik yang DIPICU saat error terdeteksi.
 *
 * Cara kerja (sesuai arahan pemilik: "kalau susah general, buat perbaikan
 * spesifik yang dipanggil hanya saat ketemu error tertentu"):
 *   1. Uji teks ke KaTeX (`katexErrorCount`).
 *   2. Bila error → jalankan daftar `REPAIRS` satu per satu, dan **pertahankan
 *      hanya perbaikan yang TIDAK MENAIKKAN jumlah error** — utamakan yang
 *      menurunkannya; bila seri, satu perubahan teks masih diterima karena
 *      sering membuka jalan perbaikan berikutnya (lihat `repairAdaptive`).
 *   3. Bila tak ada perbaikan yang memenuhi syarat → biarkan (jangan tebak).
 *
 * Ini dijalankan sebagai LAPIS AKHIR setelah `normalizeMath`, jadi tidak
 * mengganggu kasus yang sudah benar.
 */
import { tokenizeMath } from "@/lib/math/tokenize";
import katex from "katex";

/**
 * Hitung galat KaTeX pada teks (stem/opsi/solusi apa pun).
 *
 * ⚠️ PENTING: `tokenizeMath` MENGHARUSKAN delimiter (`\[…\]`, `$$…$$`, `$…$`)
 * agar sebuah potongan dikenali sebagai math. Karena itu teks yang berisi
 * `\begin{env}…\end{env}` TANPA delimiter (mis. isi
 * `\[\begin{array}…\end{array}\]` yang delimiter-nya "hilang" akibat
 * perbaikan berantai) akan ditandai `[text]` dan **GALATNYA TERLEWAT** —
 * padahal di render nyata (`math-content`) potongan itu tetap dirender sebagai
 * math. Bukti: `\hline` 625× lolos `katexErrorCount` (=0) tapi gagal di
 * `katex.renderToString`. Perbaikan: selain per-token, juga render seluruh
 * teks sebagai math display & inline (delimiter dilepas lebih dulu).
 */
export function katexErrorCount(text: string): number {
  let n = 0;
  for (const tok of tokenizeMath(text)) {
    if (tok.kind !== "math") continue;
    try {
      katex.renderToString(tok.value, { throwOnError: true, displayMode: tok.display });
    } catch {
      n++;
    }
  }
  // Jaring pengaman: potongan math yang delimiter-nya hilang.
  for (const potong of potonganMathTelanjang(text)) {
    try {
      katex.renderToString(potong, { throwOnError: true, displayMode: true });
    } catch {
      n++;
    }
  }
  return n;
}

/**
 * Cari potongan math "telanjang" (tanpa delimiter) yang tetap akan dirender
 * sebagai math oleh `math-content`: blok `\begin{env}…\end{env}` yang berdiri
 * sendiri. Dikembalikan apa adanya (delimiter TIDAK ditambah).
 */
function potonganMathTelanjang(text: string): string[] {
  const hasil: string[] = [];
  const re =
    /\\begin\{(?:array|matrix|pmatrix|bmatrix|Bmatrix|vmatrix|Vmatrix|cases|aligned|align\*?|gathered|split|equation\*?)\}[\s\S]*?\\end\{(?:array|matrix|pmatrix|bmatrix|Bmatrix|vmatrix|Vmatrix|cases|aligned|align\*?|gathered|split|equation\*?)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    // Lewati bila sudah berada di dalam token math ber-delimiter yang sah.
    if (/(?:\\\[|\\\(|\$\$?)\s*$/.test(text.slice(0, m.index).slice(-6))) continue;
    hasil.push(m[0]);
  }
  return hasil;
}

/** Satu perbaikan: fungsi murni teks → teks. */
type Repair = { nama: string; apply: (t: string) => string };

/**
 * Daftar perbaikan spesifik. Dijalankan BERGANTIAN; hanya yang menurunkan
 * jumlah galat KaTeX yang dipertahankan (lihat `repairAdaptive`).
 */
const LATEX_COMMANDS = new Set([
  "Left", "Right", "Rightarrow", "Leftarrow", "Leftrightarrow", "Longrightarrow", "Longleftarrow",
  "Longleftrightarrow", "Lim", "Lambda", "Lfloor", "Rfloor", "Lceil", "Rceil", "Langle", "Rangle",
  "Ln", "Log", "Max", "Min", "Sin", "Cos", "Tan", "Sinh", "Cosh", "Tanh", "Sqrt", "Sum", "Prod",
  "Int", "Limsup", "Liminf", "Pr", "Omega", "Theta", "Delta", "Gamma", "Sigma", "Phi", "Psi",
  "Alpha", "Beta", "Epsilon", "Zeta", "Eta", "Iota", "Kappa", "Mu", "Nu", "Xi", "Rho", "Tau",
  "Upsilon", "Chi", "Omicron", "Pi", "Times", "Div", "Cdot", "Pm", "Mp", "Leq", "Geq", "Neq",
  "Approx", "Equiv", "Propto", "Infty", "Partial", "Nabla", "Overline", "Underline", "Bigcup",
  "Bigcap", "Bigvee", "Bigwedge",
  // Pembatas ukuran & simbol himpunan/logika yang SAH di KaTeX. Tanpa entri
  // ini, `backslash-teks-palsu` mengubah `\Bigl(` menjadi `\text{Bigl}(`
  // (teks biasa, bukan pembatas) — rusak tapi galat tidak bertambah.
  "Bigl", "Bigr", "Biggl", "Biggr", "Box", "Cup", "Cap", "Subset", "Supset",
  "Vdash", "Checkmark", "Square", "Diamond", "Triangle", "Angle"
]);

export const REPAIRS: Repair[] = [
  {
    // `\[`/`\]` bersarang di dalam `\begin{align}…\end{align}`
    nama: "align-bersarang",
    apply: (t) =>
      t.replace(
        /\\begin\{(align|align\*|aligned|split|gather|gather\*)\}([\s\S]*?)\\end\{\1\}/g,
        (m, env: string, body: string) =>
          /\\\[|\\\]/.test(body)
            ? `\\begin{${env}}${body.replace(/\\\[/g, "").replace(/\\\]/g, "")}\\end{${env}}`
            : m,
      ),
  },
  {
    // `$` menganggur yang menempel ke `\[`/`\(` (mis. `$=\[\begin{bmatrix}…`)
    nama: "dolar-sebelum-delim",
    apply: (t) => t.replace(/(?<![\w$\\])\$\s*(?=\\\[|\\\()/g, ""),
  },
  {
    // Dolar bertumpuk di ujung rumus inline: `…$$` (bukan display berpasangan)
    nama: "dolar-bertumpuk-ujung",
    apply: (t) => t.replace(/(?<=[^\s$])\$\$(?=\s*(?:\\n|$))/g, "$"),
  },
  {
    // `\(…\)` yang isinya env display → jadikan `\[…\]`
    nama: "env-display-dalam-inline",
    apply: (t) =>
      t.replace(
        /\\\(([^()]*\\begin\{(?:align|align\*|aligned|split|gather|gather\*|equation|equation\*|array|matrix|pmatrix|bmatrix|vmatrix|Vmatrix|cases)\}[\s\S]*?\\end\{(?:align|align\*|aligned|split|gather|gather\*|equation|equation\*|array|matrix|pmatrix|bmatrix|vmatrix|Vmatrix|cases)\}[^()]*)\)/g,
        (_m, body: string) => `\\[${body}\\]`,
      ),
  },
  {
    // `\]$$=\[` / `\]$$` / `$$\[` — display dobel tak wajar (cacat artikel matriks).
    nama: "display-dobel",
    apply: (t) => t.replace(/\\\]\s*\$\$\s*(?==)/g, "\\]").replace(/(?<=[^\s$])\$\$(?=\\\[)/g, ""),
  },
  {
    // `$…$` yang memuat `\[`/`\]` di dalamnya (delimiter bertumpuk, matriks).
    // Hanya bila TIDAK ada `$` lain di dalam segmen.
    nama: "dolar-memuat-bracket",
    apply: (t) =>
      t.replace(/(?<![\w$\\])\$([^$\n]*?\\\[[^$\n]*?\\\][^$\n]*?)\$(?![\d$])/g, (_m, body: string) => {
        const inner = body.replace(/\\\[/g, "").replace(/\\\]/g, "");
        return `\\(${inner.trim()}\\)`;
      }),
  },
  {
    // `$$` di TENGAH (setelah `=`/spasi, bukan display berdiri sendiri).
    nama: "dolar-dobel-tengah",
    apply: (t) => t.replace(/(?<=[^\s$])\$\$(?=\s*[^\s$])/g, (m, off: number, full: string) => {
      // hanya bila tidak berpasangan di dekatnya
      const sisa = full.slice(off + 2, off + 12);
      return /^\s*[a-zA-Z\\]/.test(sisa) ? "$" : m;
    }),
  },
  {
    // `\[`/`\]` bersarang di dalam `\(…\)` (mis. `\(\left\{\[\begin{matrix}…\)`).
    // Dipindah dari `clean.ts` ke sini karena sebagai aturan tetap ia merusak
    // `\(…\[…\]…\)` yang seharusnya DISPLAY. Di sini aman: hanya dipakai bila
    // menurunkan galat KaTeX.
    // ⚠️ Versi "generik" `\(((?:(?!\\\[|\\\]).)*?)\)` SALAH: lookahead-nya justru
    // MENOLAK body yang MEMUAT `\[` — padahal itulah targetnya → regex itu tak
    // pernah cocok. Versi ini menyasar bentuk NYATA: `\(` yang di dalamnya ada
    // `\[…\]` (bukan delimiter, sudah math-mode).
    nama: "bracket-dalam-inline",
    apply: (t) => {
      // ⚠️ WAJIB `[\s\S]` (bukan `.`): ekspresi nyata MULTI-BARIS
      // (`\left\{\[\begin{matrix}\n\nx…`), dan `.` tidak cocok newline →
      // regex tak pernah cocok (bug nyata).
      // ⚠️ `\)` TIDAK dijadikan lookahead-larang: di dalam `\(…\)` bisa ada
      // `\)` dari `\right)` dsb. Cukup non-greedy sampai `\)` terdekat.
      // 1) `\(…\[…\]…\)` → buang `\[`/`\]` di dalam.
      let out = t.replace(
        /\\\(([\s\S]*?)\\\[([\s\S]*?)\\\]([\s\S]*?)\\\)/g,
        (_m, a: string, b: string, c: string) => `\\(${a}${b}${c}\\)`,
      );
      // 2) `\(…\[…\)` (tanpa `\]` penutup) → buang `\[`.
      out = out.replace(/\\\(([\s\S]*?)\\\[([\s\S]*?)\\\)/g, (_m, a: string, b: string) => `\\(${a}${b}\\)`);
      // 3) `\(…\]…\)` (tanpa `\[` pembuka) → buang `\]`.
      out = out.replace(/\\\(([\s\S]*?)\\\]([\s\S]*?)\\\)/g, (_m, a: string, b: string) => `\\(${a}${b}\\)`);
      return out;
    },
  },
  {
    // `\text{cm}` dsb. yang berdiri di dalam `\[ … \]` mini di dalam inline.
    nama: "bracket-sisa-inline",
    apply: (t) => t.replace(/\\\(((?:(?!\\\)).)*?)\\\(((?:(?!\\\)).)*?)\\\)/g, "\\($1\\)"),
  },
  {
    // POLA B (matriks defantri): sumber cacat menulis display BERDEMPETAN tanpa
    // pemisah — `\]\]\[`, `\]$$=\[`, `\]\[`. Tokenizer lalu salah memecah & `$`
    // nyasar masuk ke math-mode. Normalisasi: pisahkan dengan NEWLINE agar
    // tokenizer memecah dengan benar.
    // ⚠️ Bentuk nyata dari DB: `\end{bmatrix}\]\[Dari operasi…` dan `\]$$=\[`.
    nama: "display-dempet",
    apply: (t) =>
      t
        // ⚠️ Bentuk nyata: `\end{bmatrix}$$=\begin{bmatrix}…` — `$$` LANGSUNG
        // setelah `}` (tanpa `\]`), dan `$$` di TENGAH display (cacat sumber).
        // Buang `$$` yang diikuti `=`.
        .replace(/([}\]])[ \t]*\$\$\s*(?==)/g, "$1")
        .replace(/\\\]\s*\$\$\s*(?==)/g, "\\]") // `\]$$=` → `\]=`
        // ⚠️ Sumber cacat: `…\end{bmatrix}$$=\begin{bmatrix}…$` → setelah konversi
        // `$$…$$` jadi `\[…\]`, tersisa `\]$=` (bug nyata artikel matriks).
        .replace(/\\\]\s*\$(?==)/g, "\\]") // `\]$=` → `\]=`
        // ⚠️ `$$=` / `$=` sebelum `\begin{…}` display: sisa `$$…$$=` yang `$$`-nya
        // sudah jadi `\]`. Bentuk nyata: `$=\begin{bmatrix}…` di AWAL token
        // (KaTeX: "Can't use function '$'"). Buang `$` yang diikuti `=`+`\`.
        .replace(/(?<![\w$\\])\$(?==\s*\\begin\{)/g, "")
        // `\]\[` berdempetan: `\]` menutup display lalu `\[` MEMBUKA lagi tanpa
        // pasangan (cacat sumber). Karena sudah display-mode, `\[` kedua
        // sebenarnya hanya pemisah baris → ganti dengan baris baru.
        .replace(/\\\]([ \t]*)\\\[/g, "\\]$1\n\n")
        // ⚠️ `}` + `\[` berdempetan di AKHIR display (tanpa `\]` penutup):
        // `…\end{bmatrix}\[Dari operasi…` — `\[` membuka token baru yang
        // menelan teks. Buang `\[` yatim itu (bukan delimiter, sudah math-mode).
        .replace(/([}\]])[ \t]*\\\[(?=[A-Za-z\\])/g, "$1\n\n")
        .replace(/(?<![\w$\\])\$(?=\s*\\\[)/g, ""), // `$` yatim sebelum `\[`
  },
  {
    // POLA A (matriks defantri): `\left ( \[\begin{matrix}…` — `\[` di dalam
    // inline `\(…\)` TANPA `\]` penutup (sumber cacat). Buang `\[` telanjang
    // yang diapit `\(` dan `\)` — pakai posisi: `\(` … `\[` … `\)`.
    // ⚠️ `[\s\S]` WAJIB (ekspresi multi-baris).
    nama: "bracket-telanjang-dalam-inline",
    apply: (t) => {
      let out = t.replace(
        /\\\(([\s\S]*?)\\\[([\s\S]*?)\\\)/g,
        (_m, a: string, b: string) => `\\(${a}${b}\\)`,
      );
      out = out.replace(/\\\(([\s\S]*?)\\\]([\s\S]*?)\\\)/g, (_m, a: string, b: string) => `\\(${a}${b}\\)`);
      return out;
    },
  },
  {
    // POLA D (matriks defantri): `\[\begin{align}…\(…\)…\]` — `\(…\)` DI DALAM
    // display. Karena sudah math-mode, `\(`/`\)` di situ bukan delimiter →
    // KaTeX: "Can't use function '\(' in math mode". Buang pasangan `\(…\)`
    // yang berada di dalam `\[…\]`, ambil isinya.
    nama: "inline-dalam-display",
    apply: (t) =>
      t.replace(/\\\[([\s\S]*?)\\\]/g, (m, body: string) =>
        /\\\(|\\\)/.test(body) ? `\\[${body.replace(/\\\(/g, "").replace(/\\\)/g, "")}\\]` : m,
      ),
  },
  {
    // POLA C (matriks defantri): display `\[…\]` yang isinya memuat `\[` —
    // sisa pemisah matriks. Buang `\[`/`\]` BERSARANG di dalam display.
    // ⚠️ Hanya bila ada `\[` KEDUA sebelum `\]` pertama.
    nama: "bracket-bersarang-dalam-display",
    apply: (t) => t.replace(/\\\[([\s\S]*?)\\\[([\s\S]*?)\\\]/g, (_m, a: string, b: string) => `\\[${a}${b}\\]`),
  },
  {
    // POLA E (matriks defantri): `\end{align}\]\\]` — `\]` DIULANG dengan
    // backslash dobel (`\]` lalu `\\]`). Buang `\\]` (dobel-backslash) yang
    // berdempetan setelah `\]`.
    nama: "bracket-dobel-backslash",
    apply: (t) => t.replace(/(\\\])\\{2,}\]/g, "$1").replace(/\\{2,}\]/g, "\\]"),
  },
  {
    // POLA H (matriks defantri): `…\)\[\left| A…` — `\)` YATIM sebelum `\[`
    // (sumber cacat). Buang `\)` yatim.
    nama: "inline-close-yatim",
    apply: (t) => t.replace(/\\\)(?=\s*\\\[)/g, ""),
  },
  {
    // POLA G (matriks defantri): `\end{align}\(Dari kesamaan…\)` — `\(` menempel
    // setelah penutup env display. Karena sudah math-mode, `\(`/`\)` bukan
    // delimiter → KaTeX: "Can't use function '\(' in math mode".
    // Buang `\(` yang LANGSUNG mengikuti `\end{env}` + `\)` pasangannya.
    nama: "inline-setelah-display",
    apply: (t) => t.replace(/(\\end\{[a-z*]+\})\s*\\\(([\s\S]*?)\\\)/g, "$1 $2"),
  },
  {
    // POLA F (matriks defantri): `…^{-1} \[\begin{pmatrix}…\end{pmatrix}\]` —
    // `\[…\]` berdiri di dalam konteks inline tanpa pembungkus; karena sudah
    // math-mode, `\[`/`\]` bukan delimiter. Buang `\[`/`\]` (non-lintas `\)`).
    nama: "display-telanjang-matematika",
    apply: (t) => t.replace(/\\\(([\s\S]*?)\\\]/g, (_m, a: string) => `\\(${a}`),
  },
  {
    // ⚠️ INLINE BERSARANG `\(…\(` — sumber cacat: `\(\left(10,\ 4\), \(\left( 9,5 \right)\)`.
    // `\(` kedua sebenarnya bukan delimiter (sudah math-mode) → KaTeX:
    // "Expected '\\right', got 'EOF'"/"Can't use function '\\('". Ubah `\(`
    // BERSARANG menjadi `(` biasa. Hanya bila ada `\(` kedua SEBELUM `\)`
    // (non-lintas `\)`, tapi boleh lintas baris).
    nama: "inline-bersarang",
    // ⚠️ ITERATIF: token nyata bisa memuat BANYAK `\(` bersarang
    // (`\(\left( 2x,2y \right)\(_\)\left( 4x,4y \right)\(_\)…` = 20×).
    // Sekali-jalan hanya menangani satu level; ulangi sampai tak ada lagi.
    apply: (t) => {
      let out = t;
      for (let i = 0; i < 40; i++) {
        const next = out.replace(/\\\(((?:(?!\\\)).)*?)\\\(/g, "\\($1(");
        if (next === out) break;
        out = next;
      }
      // Sisa `\(_\)` / `\(-\)` sebagai pemisah → jadi `_` / `-`.
      out = out.replace(/\\\(([^()\\]{1,3})\\\)/g, (m, isi: string) =>
        /[A-Za-z0-9]/.test(isi) && !/^[\s_\-+*.,;:!?]$/.test(isi) ? m : isi,
      );
      // ⚠️ JANGAN tambahkan `out.replace(/\\\(([\s\S]*?)\\\)/g, "$1")` di sini.
      // Dulu baris itu ada dan membuang SELURUH delimiter `\(…\)` di teks,
      // bukan hanya sisa di dalam rumus — sehingga soal dengan satu galat
      // kehilangan semua rumus inline-nya (`\(\Salah\) dan \(x^{2}+1\)`
      // → `\Salah dan x^{2}+1`) dan tetap dilaporkan "0 galat".
      // Sisa `\(…\)` di dalam display ditangani `inline-dalam-display`.
      return out;
    },
  },
  {
    // ⚠️ `\left…` TANPA `\right` pasangan — cacat sumber:
    // `\(\left(10,\ 4\)` → KaTeX: "Expected '\\right', got 'EOF'".
    // ⚠️ WAJIB PER-TOKEN (per `\(…\)`): pada teks penuh, `\left`/`\right` sah
    // dari token LAIN akan ikut terhitung/hapus → merusak (bug nyata 1→5).
    // Terapkan hanya pada token math yang `\left`-nya lebih banyak.
    nama: "left-right-yatim",
    apply: (t) => {
      // Pecah per-token `\(…\)` / `\[…\]` / `$…$` secara kasar, perbaiki masing-masing.
      return t.replace(/(\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\]|\$\$[\s\S]*?\$\$|\$[^$\n]*?\$)/g, (tok) => {
        const nl = (tok.match(/\\left\b/g) ?? []).length;
        const nr = (tok.match(/\\right\b/g) ?? []).length;
        if (nl === nr) return tok;
        if (nl > nr) return tok.replace(/\\left\b[ \t]*/g, "");
        return tok.replace(/\\right\b[ \t]*/g, "");
      });
    },
  },
  {
    // ⚠️ TEKS BIASA di dalam math — cacat sumber: `\(\Salah\)`, `\(\Benar\)`
    // (maksudnya `\(\text{Salah}\)`). KaTeX: "Undefined control sequence: \Salah".
    // Perbaikan: `\(Kata\)` / `\[Kata\]` di mana "Kata" adalah KATA BIASA
    // (huruf awal kapital, hanya huruf, TANPA backslash/angka) → `\text{Kata}`.
    nama: "teks-telanjang-dalam-inline",
    apply: (t) =>
      t
        .replace(/\\\((\s*)\\([A-Z][A-Za-z]{2,})(\s*)\\\)/g, (_m, a: string, w: string, c: string) => `\\(${a}\\text{${w}}${c}\\)`)
        .replace(
          /\\\[(\s*)\\([A-Z][A-Za-z]{2,})(\s*)\\\]/g,
          (_m, a: string, w: string, c: string) => `\\[${a}\\text{${w}}${c}\\]`,
        ),
  },
  {
    // ⚠️ `\left` SEBAGAI SUPERSCRIPT — cacat sumber: `{}^\left(p^{2}+4 \right)\log`
    // (maksudnya basis log `{}^{p^{2}+4}\log`). KaTeX: "Got function '\\left'
    // with no arguments as superscript". Perbaikan: buang `\left`/`\right`
    // (keduanya BUKAN delimiter, sudah math-mode) — hasil `{}^{p^{2}+4}\log`.
    nama: "left-superscript",
    apply: (t) =>
      t
        .replace(/\^\s*\\left\s*([([|])/g, "^$1")
        .replace(/(\^[([|][\s\S]*?)\\right\s*([)\]|])/g, "$1$2"),
  },
  {
    // ⚠️ KURUNG KURAWAL KURANG di `\dfrac{…}` — cacat sumber (2× di artikel log):
    //   `\dfrac{ x^{\frac{1}{3} \cdot x^{\frac{2}{3}}}{x}`
    // Bentuk: `x^{` + `\frac{…}{…}` + `\cdot` + `x^{` + `\frac{…}{…}` + `}{`
    // → perlu `}` sebelum `}{`. Pola SANGAT spesifik (`\cdot x^{…}`), jadi aman.
    nama: "kurung-kurawal-kurang-dfrac",
    apply: (t) => {
      // Varian 1: `x^{\frac{A}{B} \cdot x^{\frac{C}{D}}}{` → tambah `}`.
      let out = t.replace(
        /(\^\{\\frac\{[^{}]*\}\{[^{}]*\}\s*\\cdot\s*x\^\{\\frac\{[^{}]*\}\{[^{}]*\}\})(\}\{)/g,
        "$1}$2",
      );
      // Varian 2 (lebih pendek): `x^{\frac{A}{B}}{x}` → tambah `}`.
      // Contoh nyata: `\dfrac{ x^{\frac{1+2}{3}}{x}` (kurang `}` penutup `x^{`).
      out = out.replace(/(\^\{\\frac\{[^{}]*\}\{[^{}]*\})(\}\{)/g, "$1}$2");
      return out;
    },
  },
  {
    // POLA: `\begin{align}` / `\begin{split}` yang dibungkus INLINE `\(…\)`.
    // align/split WAJIB display → KaTeX: "{align} can be used only in display mode".
    // Perbaikan: ubah `\(…\begin{env}…\end{env}…\)` → `\[…\]`.
    // ⚠️ `[\s\S]` WAJIB (env multi-baris).
    nama: "align-dalam-inline",
    apply: (t) =>
      t.replace(
        /\\\(([\s\S]*?\\begin\s*\{(?:align|align\*|aligned|split|gather|gather\*|equation|equation\*|multline|multline\*)\}[\s\S]*?\\end\s*\{(?:align|align\*|aligned|split|gather|gather\*|equation|equation\*|multline|multline\*)\}[\s\S]*?)\\\)/g,
        (_m, body: string) => `\\[${body}\\]`,
      ),
  },
  {
    // POLA: `\textc{cm}` (typo `\text`) dan `\time` (typo `\times`) — cacat sumber.
    nama: "typo-textc-time",
    apply: (t) => t.replace(/\\textc\{/g, "\\text{").replace(/\\time\b/g, "\\times"),
  },
  {
    // POLA: `\[`/`\]` sebagai PEMISAH KOMA di dalam himpunan,
    // mis. `\{5,\[ 6,\] 7,\[ 8,\] 9,…` — `\[`/`\]` bukan delimiter.
    // Perbaikan: `,\[` → `,` dan `,\]` → `,` (pola spesifik: koma + spasi).
    nama: "bracket-sebagai-koma",
    // Bentuk NYATA: `\(\{5,\[ 6,\] 7,\[ 8,\] 9,$$ 10\}\)` — di dalam himpunan
    // `\{…\}`, `\[`/`\]`/`$$` dipakai sebagai PEMISAH (bukan delimiter).
    // Karena sudah math-mode, semua itu sampah → buang, sisakan koma.
    // ⚠️ Batasi pada isi `\{ … \}` agar tidak menyentuh display yang sah.
    apply: (t) =>
      t.replace(/\\\{([^{}]*)\\\}/g, (m, isi: string) =>
        /\\\[|\\\]|\$\$/.test(isi)
          ? `\\{${isi
              .replace(/\s*\\\[\s*/g, " ")
              .replace(/\s*\\\]\s*/g, ", ")
              .replace(/\s*\$\$\s*/g, " ")
              .replace(/,\s*,/g, ",")
              .replace(/\s+/g, " ")
              .trim()}\\}`
          : m,
      ),
  },
  {
    // POLA: `$$` sebagai PEMISAH KOMA, mis. `\{4,$$ 5\}` — cacat sumber.
    nama: "dolar-sebagai-koma",
    // Bentuk NYATA: `\\( \\{5,\\[ 6,\\] 7,$$ 10\\}$ \\)` — `$$` DAN `$`
    // nyasar sebagai pemisah di dalam `\(…\)`. Semua itu sampah (sudah math-mode).
    apply: (t) =>
      t
        .replace(/,\s*\$\$\s*/g, ", ")
        // `$` nyasar yang berdiri sendiri di dalam `\(…\)` (mis. `\}$ \)`).
        .replace(/(?<![\w$\\])\$(?=[ \t]*\\\))/g, "")
        .replace(/\}\[ \t]*\$[ \t]*\\\)/g, "}\\)"),
  },
  {
    // POLA: `\Memotong`, `\Salah`, dsb. — TEKS yang diberi backslash di awal
    // math-mode. KaTeX: "Undefined control sequence: \Memotong".
    // Perbaikan: `\Kata` (huruf kapital, ≥3 huruf, BUKAN perintah LaTeX yang
    // dikenal) → `\text{Kata}`. Daftar-putih perintah LaTeX nyata dibatasi.
    nama: "backslash-teks-palsu",
    apply: (t) =>
      t.replace(/\\([A-Z][A-Za-z]{2,})\b/g, (m, w: string) => {
        return LATEX_COMMANDS.has(w) ? m : `\\text{${w}}`;
      }),
  },
  {
    // ATURAN PEMILIK: ganti SEMUA environment `align` → `align*`.
    // Alasan: `align` (tanpa `*`) memberi nomor persamaan & lebih ketat soal
    // `&`; `align*` (tanpa nomor) lebih toleran terhadap variasi sumber dan
    // selalu yang diinginkan untuk bank soal (tak ada nomor persamaan).
    // Berlaku juga untuk `aligned`/`gather`/`equation` → versi `*`.
    nama: "align-jadi-align-star",
    apply: (t) =>
      t
        .replace(/\\begin\{align\}/g, "\\begin{align*}")
        .replace(/\\end\{align\}/g, "\\end{align*}")
        .replace(/\\begin\{gather\}/g, "\\begin{gather*}")
        .replace(/\\end\{gather\}/g, "\\end{gather*}")
        .replace(/\\begin\{equation\}/g, "\\begin{equation*}")
        .replace(/\\end\{equation\}/g, "\\end{equation*}"),
  },
  {
    // ⚠️ `$` NYASAR di dalam `\text{…}` / `\mathrm{…}` dll — cacat sumber.
    // Contoh nyata: `\text{Nilaim$ yang memenuhi adalah:}` → `$` itu MENUTUP
    // token yang dibuka `\[` → KaTeX: "Expected '$', got 'EOF'".
    // Perbaikan: buang `$` (tunggal) di dalam argumen perintah teks.
    nama: "dolar-dalam-text",
    apply: (t) =>
      t.replace(/(\\(?:text|mathrm|mathbf|mathit|mathsf|mathtt|operatorname)\s*\{)([^{}]*)\}/g, (_m, awal: string, isi: string) =>
        isi.includes("$") ? `${awal}${isi.replace(/\$/g, "")}}` : _m,
      ),
  },
  {
    // ⚠️ `\[` yang ditutup `$` (atau sebaliknya) — delimiter CAMPUR, cacat sumber.
    // Deteksi: jumlah `\[` != jumlah `\]` DAN ada `$` tunggal di antaranya.
    // Perbaikan: ganti `$` tunggal yang menjadi PASANGAN `\[` menjadi `\]`.
    // Hanya bila `\[` lebih banyak dari `\]` (benar-benar kurang penutup).
    nama: "penutup-display-campur",
    apply: (t) => {
      const buka = (t.match(/\\\[/g) ?? []).length;
      const tutup = (t.match(/\\\]/g) ?? []).length;
      const sisaAwal = buka - tutup;
      if (sisaAwal <= 0) return t;
      // Kumpulkan posisi dolar tunggal (bukan dolar-dobel), lalu ganti
      // dari yang PALING AKHIR: penutup display yang hilang hampir selalu
      // yang terakhir. Mundur dari akhir agar indeks tidak bergeser.
      const posisi: number[] = [];
      const re = /(?<!\$)\$(?!\$)/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(t)) !== null) posisi.push(m.index);
      if (posisi.length === 0) return t;
      let out = t;
      let sisa = sisaAwal;
      for (let i = posisi.length - 1; i >= 0 && sisa > 0; i--, sisa--) {
        const at = posisi[i]!;
        out = out.slice(0, at) + "\\]" + out.slice(at + 1);
      }
      return out;
    }
  },
  {
    // ⚠️ `^` / `_` di DALAM `\text{…}` — tidak valid di KaTeX (teks bukan math).
    // Contoh nyata: `\text{x^{2}}+xy+xz=1` → "Expected 'EOF', got '^'".
    // Perbaikan: keluarkan isi `\text{…}` yang memuat `^{…}`/`_{…}` menjadi math
    // biasa (buang pembungkus `\text{…}`) — isinya memang rumus.
    nama: "superskrip-dalam-text",
    apply: (t) =>
      t.replace(/(\\(?:text|mathrm)\s*\{)((?:[^{}]|\{[^{}]*\})*(?:\^|_)(?:[^{}]|\{[^{}]*\})*)\}/g, (_m, _awal: string, isi: string) => isi),
  },
  {
    // ⚠️ `\(_\)` / `\(-\)` dsb. sebagai PEMISAH dalam deret math (cacat sumber).
    // Contoh nyata: `\left( 2x,2y \right)\(_\)\left( 4x,4y \right)\(_\)…`
    // Di dalam display, `\(…\)` bukan delimiter → KaTeX: "Can't use function '\('".
    // Perbaikan: `\(X\)` yang ISINYA pendek (≤3 char, bukan rumus) → buang
    // pembungkusnya, sisakan isinya (mis. `_`, `-`).
    nama: "inline-mini-pemisah",
    apply: (t) => {
      // a) `\(X\)` yang isinya pendek & bukan rumus → sisakan isinya.
      let out = t.replace(/\\\(([^()\\]{1,3})\\\)/g, (m, isi: string) =>
        /[A-Za-z0-9]/.test(isi) && !/^[\s_\-+*.,;:!?]$/.test(isi) ? m : isi,
      );
      // b) `\) _$ \(` — sisa pemisah yang menempel `_`/`$` (cacat sumber).
      //    Buang delimiter + `$` yang berdiri sendiri di antaranya.
      out = out.replace(/\\\)[ \t]*_?[ \t]*\$[ \t]*\\\(/g, "_");
      // c) `$` tunggal yang berdiri sendiri di antara `\)` dan `\(`.
      out = out.replace(/\\\)[ \t]*\$[ \t]*\\\(/g, "");
      return out;
    },
  },
  {
    // ⚠️ Pemisah `_\(…\)` / `_\left(…` dari sumber: `_` yang LANGSUNG diikuti
    // `\left` / `\right` memberi superscript tanpa argumen → KaTeX:
    // "Got function '\left' with no arguments". Perbaikan: `_\left(` → `_\left(`
    // artinya beri argumen `{…}` ke `_`, atau lebih aman: buang `_` yatim itu.
    // Contoh nyata: `\right)_\left( 4x,4y \right)` → `\right)\left( 4x,4y \right)`.
    nama: "underscore-yatim-sebelum-left",
    apply: (t) => {
      const LEFT = "\\left";
      // `_\left` tanpa `\right` sesudahnya → buang `_`.
      let out = t.replace(/_([ \t]*)\\left(?![\s\S]*?\\right)/g, "$1");
      // `_` yatim sebelum `\left` → buang `_`.
      out = out.replace(/(?<![\w{}])\\?_\\left/g, LEFT);
      // `)_\left` / `\)_ \left` → `)\left`.
      out = out.replace(/([)\]}])[ \t]*_\\left/g, `$1${LEFT}`);
      return out;
    },
  },
  {
    // ⚠️ `\hline` yang MENEMPEL baris sebelumnya (tanpa `\\` di depan) —
    // KaTeX: "\hline valid only within array environment".
    //
    // Diuji EMPIRIS: `\hline` di AWAL array (`{cc} \hline a`) SAH, dan di
    // AWAL baris (setelah `\\`) juga SAH. Yang RUSAK hanya `\hline` yang
    // menempel ISI baris sebelumnya. Nyata di korpus: `p = \\pm 1\n\hline\np+q`,
    // `\\cos K & = … \\\\\n\\hline\nKM^{2} …`.
    // Perbaikan: sisipkan `\\` sebelum `\hline` bila sebelumnya BUKAN `\\`,
    // BUKAN awal array, dan BUKAN awal ekspresi.
    nama: "hline-tempel-baris",
    apply: (t) =>
      t.replace(/(?<!\\)\\hline/gi, (m, offset: number, whole: string) => {
        const sebelum = whole.slice(Math.max(0, offset - 60), offset);
        // awal array? `\begin{array}{spec}` atau `{spec}` tepat sebelum
        if (/\\begin\s*\{[a-z*]+\}\s*(\{[^}]*\})?\s*$/i.test(sebelum)) return m;
        // awal ekspresi (tak ada apa-apa sebelum)?
        if (sebelum.trim() === "") return m;
        // sudah ada `\\` (baris baru) tepat sebelum (mungkin + spasi)?
        if (/\\\\\s*$/i.test(sebelum)) return m;
        return `\\\\ ${m}`;
      }),
  },
  {
    // ⚠️ `\end {align}` (SPASI antara `\end` dan `{`) & bintang tak cocok
    // (`\begin{align*}` vs `\end{align}`). KaTeX: "Mismatch".
    nama: "end-spasi-dan-bintang",
    apply: (t) =>
      t
        .replace(/\\end\s+\{/gi, "\\end{")
        .replace(/\\end\{(align|gather|equation|multline)\}(?!\*)/gi, "\\end{$1*}")
        .replace(/\\begin\{(align|gather|equation|multline)\}(?!\*)/gi, "\\begin{$1*}"),
  },
  {
    // ⚠️ Perintah SATUAN di dalam math tanpa `\text`: `\cm`, `\kg`, `\dd`.
    // KaTeX: "Undefined control sequence: \cm".
    nama: "satuan-tanpa-text",
    apply: (t) =>
      t.replace(
        /\\(cm|mm|km|kg|mg|gram|liter|ml|dd|km\/jam)\b(?![a-zA-Z])/gi,
        (m, u: string) => `\\text{${u}}`,
      ),
  },
  {
    // ⚠️ Typo `\righarrow` (kehilangan `t`) → `\rightarrow`.
    nama: "typo-righarrow",
    apply: (t) => t.replace(/\\righarrow\b/g, "\\rightarrow"),
  },
  {
    // ⚠️ Opsi jarak `\2mm]` / `\3mm]` — salah ketik `\\[2mm]`.
    nama: "spacing-tanpa-kurung",
    apply: (t) => t.replace(/\\([0-9]+)(mm|pt|em|ex|cm)\s*\]/g, "\\[$1$2]"),
  },
  {
    // ⚠️ `align`/`gather` TELANJANG (tanpa `\[…\]`) → KaTeX menolak di mode
    // inline/text. Perbaikan: bungkus `\[…\]` bila belum dibungkus.
    nama: "env-telanjang-dibungkus",
    apply: (t) =>
      t.replace(
        /(?<!\\\[)(?<!\\\()(?<![\w$])(\\begin\{(align\*?|gather\*?|equation\*?|multline\*?)\}[\s\S]*?\\end\{\2\})(?!\\\])/g,
        (_m, body: string) => `\\[${body}\\]`,
      ),
  },
  {
    // ⚠️ `%` TELANJANG di dalam `\text{…}` — KaTeX memperlakukan `%` sebagai
    // KOMENTAR → argumen makro terpotong: "Unexpected end of input in a macro
    // argument, expected '}'". Nyata: `\text{disc. 10%}`.
    nama: "persen-dalam-text",
    apply: (t) =>
      t.replace(
        /\\(text|mathrm|textbf|textit)\s*\{([^{}]*)\}/gi,
        (_m, perintah: string, isi: string) => `\\${perintah}{${isi.replace(/(?<!\\)%/g, "\\%")}}`,
      ),
  },
  {
    // ⚠️ `\begin{array}` TANPA kolom-spec (`\begin{array}` tanpa `{…}`) —
    // cacat sumber → KaTeX: "Expected node of symbol group type".
    // (Dulu ada di `clean.ts`; dikembalikan di sini sebagai jaring pengaman.)
    nama: "array-tanpa-spec",
    apply: (t) => t.replace(/\\begin\{array\}(?!\s*\{)/g, "\\begin{array}{c}"),
  },
  {
    // ⚠️ `\newcommand{arc}[1]{…}` — argumen pertama BUKAN nama makro (tanpa `\`).
    // KaTeX: "\newcommand's first argument must be a macro name".
    // Perbaikan: `\newcommand{NAME}` → `\newcommand{\NAME}`.
    nama: "newcommand-tanpa-backslash",
    apply: (t) => t.replace(/\\newcommand\s*\{\s*([A-Za-z]+)\s*\}/g, "\\newcommand{\\$1}"),
  },
  {
    // ⚠️ `_` / `^` di dalam `\text{…}` — KaTeX: "Expected 'EOF', got '_'".
    // Contoh: `V_{\text{kerucut_}}` → `_` di teks tak sah.
    // Perbaikan: buang `_`/`^` telanjang di dalam `\text{…}`.
    nama: "underscore-dalam-text",
    apply: (t) =>
      t.replace(/(\\(?:text|mathrm|textbf|textit)\s*\{)([^{}]*[\^_][^{}]*)\}/g, (_m, awal: string, isi: string) =>
        `${awal}${isi.replace(/[_^]/g, "")}}`,
      ),
  },
  {
    // ⚠️ `\cancel{…}` sebagai SUPERSCRIPT/SUBscript tanpa `{}` di depan —
    // KaTeX: "Got function '\cancel' with no arguments as superscript".
    // Contoh: `& = \cancel{mx} \pm …` setelah `^` atau `_`.
    // Perbaikan: beri pembungkus `{…}` pada superscript/subscript yang diikuti
    // perintah berkurung.
    nama: "cancel-superscript",
    apply: (t) =>
      t.replace(/([_^])(\\(?:cancel|bcancel|xcancel|sout|boxed|fbox|text|mathrm|sqrt)\s*\{)/g, "$1{$2"),
  },
  {
    // ⚠️ `\[` / `\]` YATIM (sendirian / sisa pemisah) — token jadi `"\"` saja.
    // KaTeX: "Unexpected character: '\'". Perbaikan: buang `\[`/`\]` yang
    // TIDAK berpasangan (cek jumlah) atau yang berdiri sendiri.
    // ⚠️ `$` NYASAR di AKHIR/RAMBU teks (bukan pasangan) — cacat sumber.
    // Contoh: `…\end{aligned}\(Jadi, panjang\)\boxed{AC=6~\text{cm}}$`
    // → `$` tunggal di akhir menutup token dari `\(` jauh → KaTeX error.
    // Perbaikan: buang `$` yang TIDAK berpasangan (jumlah ganjil di satu token).
    nama: "dolar-tak-berpasangan",
    apply: (t) => {
      if (/^\\\(|^\\\[|^\$/.test(t.trim())) return t; // token ber-delimiter sah
      const n = (t.replace(/\$\$/g, "").match(/\$/g) ?? []).length;
      if (n % 2 === 0) return t;
      // buang `$` yang berdiri sendiri (diikuti/ didahului `}`/spasi/akhir)
      return t.replace(/(?<=[}\s])\$(?=[\s]|$)/g, "");
    },
  },
  {
    // ⚠️ `\(X\)` sebagai PEMISAH di dalam rumus panjang: `…\end{aligned}\(Jadi\)\boxed{…}`.
    nama: "inline-pemisah-panjang",
    apply: (t) => t.replace(/\\\(([A-Za-z][^()\\]{2,40})\\\)/g, "$1"),
  },
  {
    nama: "bracket-yatim-lepas",
    apply: (t) => {
      if (t.trim() === "\\[" || t.trim() === "\\]" || t.trim() === "\\") return "";
      return t;
    },
  },
  {
    // ⚠️ `\]` NYASAR di dalam `\(…\)` / di tengah baris (KaTeX: "Can't use
    // function '\]' in math mode"). Contoh: `…\nJawaban b)\n…\n\[\begin{aligned} M_…`
    // Perbaikan: buang `\]` yang TIDAK punya `\[` pasangan sebelumnya.
    // ⚠️ `\overrightarrowAB` / `\vecAB` — argumen tanpa `{}`.
    // KaTeX: "Undefined control sequence: \overrightarrowAB".
    // Perbaikan: `\overrightarrowAB` → `\overrightarrow{AB}`.
    nama: "overrightarrow-tanpa-kurung",
    apply: (t) =>
      t.replace(/\\(overrightarrow|overleftarrow|vec|hat|bar|tilde|widehat|widetilde)([A-Z]{1,4})\b/g, "\\$1{$2}"),
  },
  {
    // ⚠️ `\[` / `\]` sebagai PEMISAH di dalam `\(…\)` yang panjang (cacat sumber).
    // Contoh: `$egin{aligned}…\end{aligned}\(Jadi, panjang\)oxed{AC=6}\)`.
    nama: "bracket-dalam-panjang",
    apply: (t) => t.replace(/\\\[([^\\\]]{0,40})\\\]/g, "$1"),
  },
  {
    nama: "close-bracket-yatim",
    apply: (t) => {
      const buka = (t.match(/\\\[/g) ?? []).length;
      const tutup = (t.match(/\\\]/g) ?? []).length;
      if (tutup <= buka) return t;
      let sisa = tutup - buka;
      // buang `\]` dari yang PALING AKHIR
      const pos: number[] = [];
      for (let i = t.indexOf("\\]"); i >= 0; i = t.indexOf("\\]", i + 1)) pos.push(i);
      let out = t;
      for (const p of pos.reverse()) {
        if (sisa <= 0) break;
        out = out.slice(0, p) + out.slice(p + 2);
        sisa--;
      }
      return out;
    },
  },
];

/**
 * Jumlah token math ber-delimiter pada teks.
 *
 * Dipakai sebagai PAGAR: "memperbaiki" dengan membuang delimiter memang
 * menurunkan galat (token hilang dari hitungan), padahal isinya rusak. Setiap
 * kandidat perbaikan wajib mempertahankan jumlah token math.
 */
export function countMathTokens(text: string): number {
  return tokenizeMath(text).filter((t) => t.kind === "math").length;
}

/**
 * Jalankan perbaikan secara adaptif: hanya pertahankan yang MENURUNKAN galat
 * KaTeX. Idempoten & aman — teks tanpa galat dikembalikan apa adanya.
 */
export function repairAdaptive(text: string): { text: string; applied: string[]; before: number; after: number } {
  const before = katexErrorCount(text);
  if (before === 0) return { text, applied: [], before, after: 0 };

  let cur = text;
  let best = before;
  const applied: string[] = [];
  // Pagar anti "memperbaiki dengan menghapus": jumlah token math tidak boleh
  // turun. Semua kandidat yang diterima menjaga nilai ini, jadi cukup dihitung
  // sekali di awal.
  const tokenAwal = countMathTokens(cur);
  // ⚠️ ULANGI seluruh daftar sampai tak ada perbaikan yang menurunkan galat.
  // Alasan (bug nyata): satu perbaikan bisa MEMBUKA jalan perbaikan lain
  // (mis. `bracket-dalam-inline` merapikan dulu, baru `bracket-bersarang-…`
  // cocok). Sekali-jalan berurutan tak cukup. Batas iterasi untuk keamanan.
  // ⚠️ PILIH YANG TERBAIK (penurunan terbanyak), bukan yang PERTAMA.
  // Alasan (bug nyata): bila dua perbaikan sama-sama menurunkan 1, memilih yang
  // pertama bisa MEMBLOKIR yang kedua yang lebih tepat untuk token berikutnya.
  for (let putaran = 0; putaran < 30; putaran++) {
    let namaTerbaik: string | null = null;
    let teksTerbaik: string | null = null;
    let galatTerbaik = best;
    for (const r of REPAIRS) {
      let next: string;
      try {
        next = r.apply(cur);
      } catch {
        continue;
      }
      if (next === cur) continue;
      // Tolak kandidat yang menghilangkan rumus (delimiter dibuang / token
      // dilebur). Tanpa pagar ini, "galat turun" bisa berarti "math hilang".
      if (countMathTokens(next) < tokenAwal) continue;
      const n = katexErrorCount(next);
      // ⚠️ Terima yang MENURUNKAN galat, ATAU yang SERI tapi MENGUBAH teks —
      // karena perbaikan setengah jalan (mis. rapikan `\{…\}` dulu) bisa
      // MEMBUKA perbaikan berikutnya. Keselamatan tetap terjaga: galat TIDAK
      // boleh naik (`n <= galatTerbaik`), dan loop dibatasi 30 putaran.
      if (n < galatTerbaik || (n === galatTerbaik && namaTerbaik === null)) {
        galatTerbaik = n;
        namaTerbaik = r.nama;
        teksTerbaik = next;
        if (n === 0) break;
      }
    }
    if (namaTerbaik === null || teksTerbaik === null) break;
    cur = teksTerbaik;
    best = galatTerbaik;
    applied.push(namaTerbaik);
    if (best === 0) break;
  }
  // Invarian "No-Guess": jika tidak ada penurunan galat bersih dibanding kondisi awal,
  // buang seluruh mutasi spekulatif dan kembalikan teks asli utuh.
  if (best >= before) {
    return { text, applied: [], before, after: before };
  }
  return { text: cur, applied, before, after: best };
}
