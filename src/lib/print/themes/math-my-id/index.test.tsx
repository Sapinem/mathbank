import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { mathMyIdTheme } from "./index";

describe("mathMyIdTheme", () => {
  it("memiliki metadata yang benar", () => {
    expect(mathMyIdTheme.id).toBe("math-my-id");
    expect(mathMyIdTheme.name).toBe("Standar MathBank");
    expect(mathMyIdTheme.Kop).toBeDefined();
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
