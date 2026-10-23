import { describe, expect, it } from "vitest";
import { isMathArticle, isMathTitle } from "./math-subject";

describe("gerbang mapel matematika (judul)", () => {
  it("judul matematika eksplisit → MASUK", () => {
    expect(isMathTitle("Soal Matriks Matematika SMA/MA dan Pembahasan (1-40)")).toBe(true);
    expect(isMathTitle("Soal Turunan Fungsi Aljabar Matematika SMA dan Pembahasan")).toBe(true);
  });

  it("judul bertopik matematika tanpa kata 'matematika' → MASUK", () => {
    expect(isMathTitle("Cara Menghitung Integral Tentu Fungsi Aljabar")).toBe(true);
    expect(isMathTitle("Turunan Fungsi Trigonometri dan Pembahasan 20+ Soal Latihan")).toBe(true);
    expect(isMathTitle("Definisi Faktorial dan Pembahasan Soal Latihan")).toBe(true);
    expect(isMathTitle("Cara Menghitung Determinan Matriks 2x2 dan Matriks 3x3")).toBe(true);
    expect(isMathTitle("Persamaan Trigonometri Dasar Dilengkapi Soal Latihan")).toBe(true);
  });

  it("Pengetahuan Kuantitatif (PK) → MASUK (hitungan)", () => {
    expect(isMathTitle("20 Soal TPS Pengetahuan Kuantitatif (PK) UTBK SNBT 2025")).toBe(true);
  });

  it("judul ambigu 'Olimpiade MIPA' tapi slug matematika → MASUK", () => {
    // Temuan korpus: judul bilang MIPA, padahal isinya & slug-nya matematika.
    expect(
      isMathArticle({
        title: "40 Contoh Soal Olimpiade MIPA SMA Unggul DEL Tahun 2018 dan Kunci Jawaban",
        url: "https://www.defantri.com/2019/09/pembahasan-science-expo-matematika-sma-unggul-del-2018.html",
      }),
    ).toBe(true);
    expect(
      isMathArticle({
        title: "24 Contoh Soal Olimpiade MIPA SMA Unggul DEL Tahun 2016 dan Kunci Jawaban",
        url: "https://www.defantri.com/2018/09/soal-hots-matematika-smp.html",
      }),
    ).toBe(true);
  });

  it("judul ALIAS MIPA tanpa slug matematika → SKIP (aman)", () => {
    expect(
      isMathArticle({
        title: "40 Contoh Soal Olimpiade MIPA SMA Unggul DEL Tahun 2018",
        url: "https://www.defantri.com/2019/09/soal-olimpiade-mipa.html",
      }),
    ).toBe(false);
  });

  it("mapel non-matematika → SKIP", () => {
    expect(isMathTitle("100 Contoh Soal OSN-K IPS SMP 2014 + Kunci Jawaban PDF")).toBe(false);
    expect(isMathTitle("70 Soal OSN-K IPA SD/MI 2021 dan Kunci Jawaban Lengkap")).toBe(false);
    expect(isMathTitle("100 Contoh Soal OSN-K Kebumian SMA/MA Tahun 2024")).toBe(false);
    expect(isMathTitle("30 Soal TKA Pendidikan Pancasila SMA/SMK 2025")).toBe(false);
    expect(isMathTitle("25 Paket Soal TKA Bahasa Inggris (Wajib) SMA/SMK")).toBe(false);
    expect(isMathTitle("20 Soal TPS Pemahaman Bacaan dan Menulis (PBM) UTBK SNBT 2024")).toBe(false);
    expect(isMathTitle("30 Soal TPS Penalaran Umum (PU) UTBK SNBT 2025")).toBe(false);
  });

  it("judul kosong / tak dikenal → SKIP (aman)", () => {
    expect(isMathTitle("")).toBe(false);
    expect(isMathTitle("Kumpulan Soal dan Kunci Jawaban")).toBe(false);
  });
});
