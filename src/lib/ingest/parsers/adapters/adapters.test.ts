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
