import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MathMyIdHeader } from "./header";
import { HEADER_CODES } from "./types";
import { HEADER_VARIANTS } from "./header-variants";

describe("MathMyIdHeader", () => {
  it("memiliki renderer untuk seluruh 24 variasi header A1-F4", () => {
    expect(HEADER_CODES).toHaveLength(24);
    for (const code of HEADER_CODES) {
      expect(typeof HEADER_VARIANTS[code]).toBe("function");
    }
  });

  it("merender header A1 pada mode 2-baris dengan judul dan mapel/kelas (U2-T1)", () => {
    const { container } = render(
      <MathMyIdHeader
        title="Limit Fungsi Trigonometri"
        exerciseLabel="Latihan 1"
        options={{
          headerCode: "A1",
          course: "Matematika Tingkat Lanjut",
          is1Line: false,
        }}
      />
    );

    expect(screen.getByText("Limit Fungsi Trigonometri")).toBeInTheDocument();
    expect(screen.getByText("Matematika Tingkat Lanjut")).toBeInTheDocument();
    expect(screen.getByText("Latihan 1")).toBeInTheDocument();
    expect(screen.getByText("Math My ID")).toBeInTheDocument();
    // Memverifikasi baji diagonal polygon
    expect(container.querySelector("polygon[fill='#f5b800']")).toBeInTheDocument();
    expect(container.querySelector("polygon[fill='#072652']")).toBeInTheDocument();
  });

  it("merender header A1 pada mode 1-baris tanpa teks mapel/kelas (U2-T2)", () => {
    render(
      <MathMyIdHeader
        title="Limit Fungsi Trigonometri"
        exerciseLabel="Latihan 1"
        options={{
          headerCode: "A1",
          course: "Matematika Tingkat Lanjut",
          is1Line: true,
        }}
      />
    );

    expect(screen.getByText("Limit Fungsi Trigonometri")).toBeInTheDocument();
    // Pada mode 1-baris, teks mapel/kelas disembunyikan untuk menghemat ruang
    expect(screen.queryByText("Matematika Tingkat Lanjut")).not.toBeInTheDocument();
  });

  it("jatuh kembali ke variasi A1 bila headerCode tidak valid atau kosong (U2-T3)", () => {
    const { container } = render(
      <MathMyIdHeader
        title="Ujian Akhir Semester"
        options={{
          headerCode: "INVALID_CODE",
        }}
      />
    );

    expect(container.querySelector("[data-header-code='A1']")).toBeInTheDocument();
    expect(screen.getByText("Ujian Akhir Semester")).toBeInTheDocument();
  });

  it("merender perwakilan variasi dari setiap kelompok tematis tanpa galat (U2-T4)", () => {
    const testSamples = [
      { code: "A2", expectedText: "Latihan 1" },
      { code: "B2", expectedText: "Latihan 1" },
      { code: "C1", expectedText: "Latihan 1" },
      { code: "D1", expectedText: "Latihan 1" },
      { code: "E1", expectedText: "Latihan 1" },
      { code: "F1", expectedText: "Latihan 1" },
    ];

    for (const sample of testSamples) {
      const { container } = render(
        <MathMyIdHeader
          title={`Soal Uji ${sample.code}`}
          options={{
            headerCode: sample.code,
            exerciseLabel: sample.expectedText,
          }}
        />
      );

      expect(container.querySelector(`[data-header-code='${sample.code}']`)).toBeInTheDocument();
      expect(screen.getByText(`Soal Uji ${sample.code}`)).toBeInTheDocument();
    }
  });

  it("mendukung pemilihan gaya logo lingkaran penuh (LogoSquare)", () => {
    const { container } = render(
      <MathMyIdHeader
        title="Soal Uji Logo"
        options={{
          headerCode: "A1",
          logoStyle: "circle",
        }}
      />
    );

    expect(container.querySelector("svg[viewBox='50 120 1900 1850']")).toBeInTheDocument();
  });
});
