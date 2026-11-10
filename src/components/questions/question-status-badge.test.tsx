import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { QuestionStatusBadge } from "./question-status-badge";

describe("QuestionStatusBadge", () => {
  it("merender badge draf beserta ikon", () => {
    const { container } = render(<QuestionStatusBadge status="draft" />);
    expect(screen.getByText("Draf")).toBeInTheDocument();
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("data-icon", "inline-start");
  });

  it("merender badge telaah beserta ikon", () => {
    const { container } = render(<QuestionStatusBadge status="review" />);
    expect(screen.getByText("Perlu Telaah")).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("merender badge arsip beserta ikon dan coretan", () => {
    const { container } = render(<QuestionStatusBadge status="archived" />);
    expect(screen.getByText("Arsip")).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("tidak merender apa pun saat status ready secara default", () => {
    const { container } = render(<QuestionStatusBadge status="ready" />);
    expect(container.firstChild).toBeNull();
  });

  it("merender badge ready bila showReady=true", () => {
    const { container } = render(<QuestionStatusBadge status="ready" showReady />);
    expect(screen.getByText("Siap")).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeInTheDocument();
  });
});
