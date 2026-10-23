import { describe, it, expect } from "vitest";
import { m4thlabAdapter } from "./m4thlab";
import { mathcyberAdapter } from "./mathcyber";
import { defantriAdapter } from "./defantri";
import { pickHtmlAdapter, pickJsonAdapter, KNOWN_SOURCES } from "./index";

// ── Fixture mini (potongan nyata dari korpus) ─────────────────

const M4THLAB_OK = `
<div class="contoh-soal">
  <div class="cs-header">Contoh Soal 1</div>
  <div class="cs-body">
    <div class="cs-teks">Faktorisasi dari $x^2+7x+12$ adalah ....</div>
    <div class="cs-opsi">
      <div class="cs-opt" onclick="pilihJawaban(this, true)">
        <span class="cs-marker">A</span><span class="cs-opt-text">$(x+3)(x+4)$</span></div>
      <div class="cs-opt" onclick="pilihJawaban(this, false)">
        <span class="cs-marker">B</span><span class="cs-opt-text">$(x+2)(x+6)$</span></div>
      <div class="cs-opt" onclick="pilihJawaban(this, false)">
        <span class="cs-marker">C</span><span class="cs-opt-text">$(x-3)(x-4)$</span></div>
      <div class="cs-opt" onclick="pilihJawaban(this, false)">
        <span class="cs-marker">D</span><span class="cs-opt-text">$(x-2)(x-6)$</span></div>
    </div>
    <div class="cs-toggle-pem">Lihat Pembahasan</div>
    <div class="cs-pembahasan"><div class="cs-pem-body">Cari dua bilangan yang berjumlah 7.</div></div>
  </div>
</div>`;

const MATHCYBER_OL = `
<h2><span>Soal Nomor 1</span></h2>
<p>Tentukan nilai dari $2+3$.</p>
<ol style="list-style-type: upper-alpha"><li>$4$</li><li>$5$</li><li>$6$</li><li>$7$</li></ol>
<div class="sp-wrap"><div class="sp-head">Pembahasan</div>
<div class="sp-body">Hasilnya $5$. (Jawaban B)</div></div>`;

const MATHCYBER_INLINE = `
<h2><span>Soal Nomor 2</span></h2>
<p>Banyak pilihan adalah $\cdots$<br>
A. $900$ &nbsp;&nbsp; D. $600$<br>
B. $800$ &nbsp;&nbsp; E. $460$<br>
C. $700$</p>`;

const DEFANTRI_OK = `
<h4>1. Soal OSN-K</h4>
<blockquote>Perhatikan gambar!<br>
<div class="question">
<label><div class="box white"><input type="radio" name="q1" value="correct">$(A)$ 13 cm</div></label>
<label><div class="box white"><input type="radio" name="q1" value="corect">$(B)$ 15 cm</div></label>
<label><div class="box white"><input type="radio" name="q1" value="corect">$(C)$ 21 cm</div></label>
</div></blockquote>`;

describe("adapter m4thlab", () => {
  it("mengekstrak stem, opsi, kunci (pilihJawaban true), pembahasan", () => {
    const r = m4thlabAdapter(M4THLAB_OK, { source: "m4thlab" });
    expect(r.items).toHaveLength(1);
    const it = r.items[0]!;
    expect(it.type).toBe("single_choice");
    expect(it.options).toHaveLength(4);
    expect(it.correct).toEqual(["A"]);
    expect(it.options[0]!.isCorrect).toBe(true);
    expect(it.options[1]!.isCorrect).toBe(false);
    expect(it.stem).toContain("Faktorisasi");
    expect(it.explanation).toContain("dua bilangan");
  });

  it("artikel tanpa contoh-soal → kosong + catatan", () => {
    const r = m4thlabAdapter("<p>artikel biasa</p>", { source: "m4thlab" });
    expect(r.items).toHaveLength(0);
    expect(r.warnings.length).toBeGreaterThan(0);
  });
});

describe("adapter mathcyber", () => {
  it("opsi <ol upper-alpha> + kunci (Jawaban X)", () => {
    const r = mathcyberAdapter(MATHCYBER_OL, { source: "mathcyber" });
    expect(r.items).toHaveLength(1);
    const it = r.items[0]!;
    expect(it.options).toHaveLength(4);
    expect(it.correct).toEqual(["B"]);
    expect(it.options[1]!.isCorrect).toBe(true);
    expect(it.explanation).toContain("Hasilnya");
  });

  it("opsi INLINE 2-kolom (A. … D. … B. … E. …) → terurut A–E", () => {
    const r = mathcyberAdapter(MATHCYBER_INLINE, { source: "mathcyber" });
    const it = r.items[0]!;
    expect(it.type).toBe("single_choice");
    expect(it.options.map((o) => o.label)).toEqual(["A", "B", "C", "D", "E"]);
    expect(it.options[0]!.text).toContain("900");
    expect(it.options[3]!.text).toContain("600");
    expect(it.stem).not.toContain("900");
  });

  // ── Kunci: pola dua bahasa (diselaraskan 2026-10-02) ──────────────
  // Sebelumnya hanya `(Jawaban X)` yang dikenali, sehingga artikel
  // berbahasa Inggris (yang memakai `(Answer X)` / `choose option X`)
  // masuk TANPA kunci. Diukur pada korpus nyata: 4% → 73%.
  it("kunci pola INDONESIA: (Jawaban X)", () => {
    const html = `<h2><span>Soal Nomor 1</span></h2><p>$$1+1$$</p>
      <ol style="list-style-type: upper-alpha"><li>1</li><li>2</li><li>3</li></ol>
      <div class="sp-wrap"><div class="sp-body">Hasilnya 2. (Jawaban B)</div></div>`;
    const r = mathcyberAdapter(html, { source: "mathcyber" });
    expect(r.items[0]!.correct).toEqual(["B"]);
  });

  it("kunci pola INGGRIS: (Answer X)", () => {
    const html = `<h2><span>Problem Number 1</span></h2><p>What is $$1+1$$?</p>
      <ol style="list-style-type: upper-alpha"><li>1</li><li>2</li><li>3</li></ol>
      <div class="sp-wrap"><div class="sp-body">It is 2. (Answer B)</div></div>`;
    const r = mathcyberAdapter(html, { source: "mathcyber" });
    expect(r.items[0]!.correct).toEqual(["B"]);
  });

  it("kunci INGGRIS tanpa kurung: 'Answer: C'", () => {
    const html = `<h2><span>Problem Number 1</span></h2><p>$$1+1$$</p>
      <ol style="list-style-type: upper-alpha"><li>1</li><li>2</li><li>3</li></ol>
      <div class="sp-wrap"><div class="sp-body">Answer: C is the value.</div></div>`;
    const r = mathcyberAdapter(html, { source: "mathcyber" });
    expect(r.items[0]!.correct).toEqual(["C"]);
  });

  it("kunci teks INGGRIS: 'The true answer is <strong>option B' (tag HTML di tengah)", () => {
    // Regresi: tag HTML harus dibuang dulu — bila tidak, regex yang melarang
    // `<`/`>` tak akan pernah cocok (artikel beaver sempat 0 kunci).
    const html = `<h2><span>Problem Number 1</span></h2><p>$$1+1$$</p>
      <ol style="list-style-type: upper-alpha"><li>1</li><li>2</li><li>3</li></ol>
      <div class="sp-wrap"><div class="sp-body">The true answer is <strong>option B. </strong></span></div></div>`;
    const r = mathcyberAdapter(html, { source: "mathcyber" });
    expect(r.items[0]!.correct).toEqual(["B"]);
  });

  it("kunci teks: 'You should choose option D'", () => {
    const html = `<h2><span>Problem Number 1</span></h2><p>$$1+1$$</p>
      <ol style="list-style-type: upper-alpha"><li>1</li><li>2</li><li>3</li><li>4</li></ol>
      <div class="sp-wrap"><div class="sp-body">You should choose option D.</div></div>`;
    const r = mathcyberAdapter(html, { source: "mathcyber" });
    expect(r.items[0]!.correct).toEqual(["D"]);
  });

  it("PENTING: 'shown in Option A' BUKAN kunci (frasa penjelas)", () => {
    // Di artikel beaver, `option` muncul dalam dua makna. Kalimat "shown in
    // Option A" hanya MENJELASKAN opsi, bukan menetapkan kunci — bila ikut
    // ditangkap, kunci jadi salah.
    const html = `<h2><span>Problem Number 1</span></h2><p>$$1+1$$</p>
      <ol style="list-style-type: upper-alpha"><li>1</li><li>2</li><li>3</li></ol>
      <div class="sp-wrap"><div class="sp-body">That tower is the one shown in Option A.</div></div>`;
    const r = mathcyberAdapter(html, { source: "mathcyber" });
    expect(r.items[0]!.correct).toEqual([]);
    expect(r.items[0]!.warnings.join(" ")).toContain("Kunci jawaban tidak ditemukan");
  });

  it("tanpa pola kunci apa pun → kosong + peringatan (tak menebak)", () => {
    const html = `<h2><span>Problem Number 1</span></h2><p>$$1+1$$</p>
      <ol style="list-style-type: upper-alpha"><li>1</li><li>2</li><li>3</li></ol>
      <div class="sp-wrap"><div class="sp-body">Pembahasan panjang tanpa penanda kunci.</div></div>`;
    const r = mathcyberAdapter(html, { source: "mathcyber" });
    expect(r.items[0]!.correct).toEqual([]);
  });

  it("artikel tanpa penanda → kosong + catatan", () => {
    const r = mathcyberAdapter("<p>artikel</p>", { source: "mathcyber" });
    expect(r.items).toHaveLength(0);
  });
});

describe("adapter defantri", () => {
  it("grup name=qN → 1 soal; kunci dari value=correct", () => {
    const r = defantriAdapter(DEFANTRI_OK, { source: "defantri" });
    expect(r.items).toHaveLength(1);
    const it = r.items[0]!;
    expect(it.options).toHaveLength(3);
    expect(it.correct).toEqual(["A"]);
    expect(it.options[0]!.isCorrect).toBe(true);
    expect(it.stem).toContain("Perhatikan gambar");
  });

  it("PENTING: 'corect' adalah PENGECOH, bukan kunci", () => {
    const html = `<blockquote>Soal<br><div class="question">
      <label><input type="radio" name="q1" value="corect">$(A)$ a</label>
      <label><input type="radio" name="q1" value="corect">$(B)$ b</label>
      </div></blockquote>`;
    const it = defantriAdapter(html, { source: "defantri" }).items[0]!;
    expect(it.correct).toEqual([]); // tak ada kunci
    expect(it.options.every((o) => !o.isCorrect)).toBe(true);
  });

  it("REGRESI: stem di DALAM <div class='question'> tetap terambil", () => {
    // Bug: stem dianggap isi sebelum div.question → kosong → soal dibuang.
    const html = `<h4>1. Soal</h4><blockquote><div class="question">
      Diketahui $\\log 2 = 8$. Nilai $x$ adalah ....<br>
      <label><input type="radio" name="q1" value="corect">$(A)$ 1</label>
      <label><input type="radio" name="q1" value="correct">$(B)$ 2</label>
      </div></blockquote>`;
    const r = defantriAdapter(html, { source: "defantri" });
    expect(r.items).toHaveLength(1);
    expect(r.skipped).toBe(0);
    expect(r.items[0]!.stem).toContain("Diketahui");
    expect(r.items[0]!.correct).toEqual(["B"]);
  });

  it("REGRESI: '<!--more-->' TIDAK boleh mengalahkan pembuka soal", () => {
    // Bug nyata (UTBK): Blogger menyisipkan <!--more--> DI ANTARA stem dan
    // <div class="question">. Karena pembuka diambil via Math.max(), <!--more-->
    // "menang" atas <h4>/<blockquote> → start jatuh setelah stem → stem KOSONG
    // → soal DIBUANG (4 soal hilang di 1 artikel).
    const html = `<h4>1. Soal pertama</h4><blockquote>Berapa $1+1$?
      <!--more-->
      <div class="question">
        <label><input type="radio" name="q1" value="correct">$(A)$ 2</label>
        <label><input type="radio" name="q1" value="corect">$(B)$ 3</label>
      </div></blockquote>`;
    const r = defantriAdapter(html, { source: "defantri" });
    expect(r.items).toHaveLength(1);
    expect(r.items[0]!.stem).toContain("1+1");
    expect(r.items[0]!.correct).toEqual(["A"]);
  });

  it("REGRESI: stem 'pembuka bersama' SEBELUM <h4> tetap terambil", () => {
    // Bug nyata (4 artikel OSNP): deskripsi soal ada di <p> SEBELUM <h4>,
    // sedangkan radio di dalam <blockquote>. Tanpa ini, stem kosong → soal dibuang.
    const html = `<p>Perhatikan jaring-jaring makanan berikut, terdapat $(1)$ rantai makanan.</p>
      </div><br>
      <h4>1. Soal OSN-P IPA SD/MI 2025</h4>
      <blockquote>
      <div class="question">
        <label><input type="radio" name="q1" value="corect">$(A)$ $6$</label>
        <label><input type="radio" name="q1" value="correct">$(B)$ $7$</label>
      </div></blockquote>`;
    const r = defantriAdapter(html, { source: "defantri" });
    expect(r.items).toHaveLength(1);
    expect(r.items[0]!.stem).toContain("jaring-jaring makanan");
    expect(r.items[0]!.correct).toEqual(["B"]);
  });

  it("PEMBAHASAN: <details> 'Alternatif Pembahasan' ikut terambil", () => {
    // Sumber defantri menaruh pembahasan di <details> setelah soal.
    const html = `<h4>1. Soal</h4><blockquote>Berapa $1+1$?<br>
      <div class="question">
        <label><input type="radio" name="q1" value="correct">$(A)$ 2</label>
        <label><input type="radio" name="q1" value="corect">$(B)$ 3</label>
      </div></blockquote>
      <details class='sp'><summary>Alternatif Pembahasan:</summary><p>Karena $1+1=2$ maka jawabannya $(A)$.</p></details>`;
    const it = defantriAdapter(html, { source: "defantri" }).items[0]!;
    expect(it.correct).toEqual(["A"]);
    expect(it.explanation).toBeDefined();
    expect(it.explanation).toContain("1+1=2");
  });

  it("PEMBAHASAN BS: <details> setelah `<ul>` benar-salah ikut terambil", () => {
    // Temuan nyata TKA: beberapa grup BS dalam satu `<ul>`; `<details>`
    // pembahasan ada SETELAH `</ul>` → dulu tak terbaca karena blok dipotong
    // di radio berikutnya.
    const html = `<h4>1. Soal TKA</h4>
      <ul>
        <li>Pernyataan satu.
          <div class="question">
            <label><input type="radio" name="q201" value="correct">Benar</label>
            <label><input type="radio" name="q201" value="corect">Salah</label>
          </div>
        </li>
        <li>Pernyataan dua.
          <div class="question">
            <label><input type="radio" name="q202" value="corect">Benar</label>
            <label><input type="radio" name="q202" value="correct">Salah</label>
          </div>
        </li>
      </ul>
      <details class='sp'><summary>Alternatif Pembahasan:</summary>
        <p>Karena $2+2=4$ maka pernyataan pertama benar.</p></details>
      <h4>2. Soal berikutnya</h4>
      <blockquote>Soal lain.<div class="question">
        <label><input type="radio" name="q3" value="correct">$(A)$ a</label>
        <label><input type="radio" name="q3" value="corect">$(B)$ b</label>
      </div></blockquote>`;

    const items = defantriAdapter(html, { source: "defantri" }).items;
    const mg = items.find((i) => i.type === "matrix_grid");
    expect(mg).toBeDefined();
    // Bukti utama: pembahasan BS kini terbaca.
    expect(mg!.explanation).toBeDefined();
    expect(mg!.explanation).toContain("2+2=4");
    // Tidak menyerobot pembahasan soal lain.
    const pg = items.find((i) => i.type === "single_choice");
    expect(pg!.explanation ?? "").not.toContain("2+2=4");
  });

  it("PEMBAHASAN: tanpa <details> → explanation kosong (bukan error)", () => {
    const html = `<blockquote>Berapa $2+2$?<br><div class="question">
      <label><input type="radio" name="q1" value="correct">$(A)$ 4</label>
      <label><input type="radio" name="q1" value="corect">$(B)$ 5</label>
      </div></blockquote>`;
    const it = defantriAdapter(html, { source: "defantri" }).items[0]!;
    expect(it.explanation).toBeUndefined();
  });

  it("REGRESI: opsi '$(A)$ $P \\gt Q$' → LaTeX tetap SEIMBANG", () => {
    // Bug: pembuangan `\)` sisa label ikut memakan penutup math opsi
    // (`\(P \gt Q` tanpa `\)`) → KaTeX rusak.
    const html = `<blockquote>Manakah yang benar?<br><div class="question">
      <label><input type="radio" name="q1" value="corect">$(A)$   $P \\gt Q$</label>
      <label><input type="radio" name="q1" value="correct">$(B)$  $Q \\gt P$</label>
      </div></blockquote>`;
    const it = defantriAdapter(html, { source: "defantri" }).items[0]!;
    expect(it.options).toHaveLength(2);
    const a = it.options[0]!;
    expect(a.label).toBe("A");
    // `\(` harus seimbang dengan `\)`.
    const open = (a.text.match(/\\\(/g) ?? []).length;
    const close = (a.text.match(/\\\)/g) ?? []).length;
    expect(open).toBe(close);
    expect(a.text).toContain("P \\gt Q");
  });
});

describe("pemilih adapter", () => {
  it("sumber eksplisit dipakai", () => {
    expect(pickHtmlAdapter({ source: "m4thlab" }, "")).toBe(m4thlabAdapter);
  });

  it("deteksi otomatis dari penanda HTML", () => {
    expect(pickHtmlAdapter({ source: "?" }, M4THLAB_OK)).toBe(m4thlabAdapter);
    expect(pickHtmlAdapter({ source: "?" }, MATHCYBER_OL)).toBe(mathcyberAdapter);
    expect(pickHtmlAdapter({ source: "?" }, DEFANTRI_OK)).toBe(defantriAdapter);
  });

  it("sumber tak dikenal → null", () => {
    expect(pickHtmlAdapter({ source: "unknown" }, "<p>x</p>")).toBeNull();
    expect(KNOWN_SOURCES).toContain("mathcyber");
  });

  it("adapter JSON dayaserap via pickJsonAdapter", () => {
    expect(pickJsonAdapter({ source: "pusmendik_dayaserap" })).not.toBeNull();
    expect(pickJsonAdapter({ source: "unknown" })).toBeNull();
  });
});
