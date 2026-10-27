import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ViewModeToggle, modeClass } from "./view-mode-toggle";

describe("ViewModeToggle", () => {
  it("merender tombol segmented desktop dengan label bahasa Indonesia", () => {
    const onChange = vi.fn();
    render(<ViewModeToggle value="list" onChange={onChange} />);

    const listBtn = screen.getByRole("button", { name: "Daftar" });
    const gridBtn = screen.getByRole("button", { name: "Kisi" });
    const masonryBtn = screen.getByRole("button", { name: "Mozaik" });

    expect(listBtn).toBeDefined();
    expect(gridBtn).toBeDefined();
    expect(masonryBtn).toBeDefined();

    expect(listBtn.getAttribute("aria-pressed")).toBe("true");
    expect(gridBtn.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(gridBtn);
    expect(onChange).toHaveBeenCalledWith("grid");
  });

  it("merender trigger dropdown mobile dan item dengan target sentuh >= 44px", () => {
    const onChange = vi.fn();
    render(<ViewModeToggle value="list" onChange={onChange} />);

    const triggerBtn = screen.getByRole("button", { name: /Mode tampilan: Daftar/ });
    expect(triggerBtn).toBeDefined();

    fireEvent.click(triggerBtn);
    const menuItems = screen.getAllByRole("menuitem");
    expect(menuItems.length).toBe(3);
    for (const item of menuItems) {
      expect(item.className).toContain("min-h-[44px]");
    }
    fireEvent.click(menuItems[1]);
    expect(onChange).toHaveBeenCalledWith("grid");
  });

  it("modeClass mengembalikan styling yang sesuai untuk tiap mode", () => {
    expect(modeClass("list")).toContain("divide-y");
    expect(modeClass("grid")).toContain("grid-cols-1");
    expect(modeClass("masonry")).toContain("columns-1");
  });
});
