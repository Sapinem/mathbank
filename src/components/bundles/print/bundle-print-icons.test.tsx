import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  YouTubeIcon,
  InstagramIcon,
  FacebookIcon,
  TelegramIcon,
  TwitterIcon,
  DotMatrixOrnament,
  TechnicalKopBorder,
  SlantedHeaderStripes,
} from "./bundle-print-icons";

describe("bundle-print-icons", () => {
  it("merender seluruh ikon media sosial dengan atribut svg yang valid", () => {
    const { container: yt } = render(<YouTubeIcon className="size-4 text-blue-900" />);
    expect(yt.querySelector("svg")).toBeInTheDocument();
    expect(yt.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");

    const { container: ig } = render(<InstagramIcon className="size-4" />);
    expect(ig.querySelector("svg")).toBeInTheDocument();

    const { container: fb } = render(<FacebookIcon className="size-4" />);
    expect(fb.querySelector("svg")).toBeInTheDocument();

    const { container: tg } = render(<TelegramIcon className="size-4" />);
    expect(tg.querySelector("svg")).toBeInTheDocument();

    const { container: tw } = render(<TwitterIcon className="size-4" />);
    expect(tw.querySelector("svg")).toBeInTheDocument();
  });

  it("merender ornamen dot matrix dengan elemen lingkaran SVG", () => {
    const { container } = render(<DotMatrixOrnament className="w-20 h-16" rows={4} cols={6} />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    const circles = container.querySelectorAll("circle");
    expect(circles.length).toBeGreaterThan(0);
  });

  it("merender garis pembatas teknikal kop dengan garis dan simpul lingkaran", () => {
    const { container } = render(<TechnicalKopBorder className="w-full h-3" />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(container.querySelector("polyline, path")).toBeInTheDocument();
    expect(container.querySelector("circle")).toBeInTheDocument();
  });

  it("merender 3 garis aksen miring running header", () => {
    const { container } = render(<SlantedHeaderStripes className="h-4" />);
    const stripes = container.querySelectorAll("[data-slot='stripe']");
    expect(stripes.length).toBe(3);
  });
});
