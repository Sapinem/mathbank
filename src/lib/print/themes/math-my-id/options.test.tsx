import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MathMyIdOptions } from "./options";

describe("MathMyIdOptions", () => {
  it("merender dropdown pemilih header dan memanggil onChange saat memilih variasi baru", () => {
    const handleChange = vi.fn();
    render(
      <MathMyIdOptions
        options={{
          headerCode: "A1",
          footerCode: "F1",
          logoStyle: "mi",
          runningHeader: true,
        }}
        onChange={handleChange}
      />
    );

    const headerSelect = screen.getByLabelText(/gaya strip header/i);
    expect(headerSelect).toBeInTheDocument();
    expect(headerSelect).toHaveValue("A1");

    fireEvent.change(headerSelect, { target: { value: "B2" } });
    expect(handleChange).toHaveBeenCalledWith("headerCode", "B2");
  });

  it("merender dropdown pemilih footer dan memanggil onChange", () => {
    const handleChange = vi.fn();
    render(
      <MathMyIdOptions
        options={{
          headerCode: "A1",
          footerCode: "F1",
        }}
        onChange={handleChange}
      />
    );

    const footerSelect = screen.getByLabelText(/gaya strip footer/i);
    expect(footerSelect).toBeInTheDocument();
    expect(footerSelect).toHaveValue("F1");

    fireEvent.change(footerSelect, { target: { value: "G4" } });
    expect(handleChange).toHaveBeenCalledWith("footerCode", "G4");
  });

  it("mengganti gaya logo antara 'mi' dan 'circle'", () => {
    const handleChange = vi.fn();
    render(
      <MathMyIdOptions
        options={{
          logoStyle: "mi",
        }}
        onChange={handleChange}
      />
    );

    const circleBtn = screen.getByRole("button", { name: /lambang lingkaran/i });
    fireEvent.click(circleBtn);
    expect(handleChange).toHaveBeenCalledWith("logoStyle", "circle");
  });

  it("mengubah status toggle running header", () => {
    const handleChange = vi.fn();
    render(
      <MathMyIdOptions
        options={{
          runningHeader: true,
        }}
        onChange={handleChange}
      />
    );

    const toggleBtn = screen.getByRole("button", { name: /running header otomatis/i });
    fireEvent.click(toggleBtn);
    expect(handleChange).toHaveBeenCalledWith("runningHeader", false);
  });
});
