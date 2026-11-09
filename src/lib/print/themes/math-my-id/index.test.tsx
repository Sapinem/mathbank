import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { mathMyIdTheme } from "./index";

describe("mathMyIdTheme", () => {
  it("memiliki metadata dan kontrak tema naskah lengkap", () => {
    expect(mathMyIdTheme.id).toBe("math-my-id");
    expect(mathMyIdTheme.name).toBe("Standar MathBank");
    expect(mathMyIdTheme.Kop).toBeDefined();
    expect(mathMyIdTheme.Header).toBeDefined();
    expect(mathMyIdTheme.Footer).toBeDefined();
    expect(mathMyIdTheme.renderOptions).toBeDefined();
    expect(mathMyIdTheme.defaultOptions).toEqual({
      headerCode: "A1",
      footerCode: "F1",
      logoStyle: "mi",
      runningHeader: true,
      watermarkOpacity: 0.08,
    });
  });

  it("merender komponen Kop dengan data naskah", () => {
    const Kop = mathMyIdTheme.Kop;
    render(
      <Kop
        title="Ujian Matematika Peminatan"
        institutionName="SMA Negeri 1 Jakarta"
        grade="12"
        year={2026}
        questionCount={30}
        durationMinutes={90}
        options={{}}
      />
    );

    expect(screen.getByText(/ujian matematika peminatan/i)).toBeInTheDocument();
    expect(screen.getByText(/sma negeri 1 jakarta/i)).toBeInTheDocument();
    expect(screen.getByText(/30 Soal/i)).toBeInTheDocument();
  });
});
