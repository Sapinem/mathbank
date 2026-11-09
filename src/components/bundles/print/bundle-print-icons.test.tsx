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
  MathMyIdMiLogo,
  MathMyIdMiLogoLight,
  MathMyIdFullLogo,
  MATH_MY_ID_COLORS,
} from "./bundle-print-icons";

describe("bundle-print-icons", () => {
  it("mengekspor konstanta token warna resmi Math My ID", () => {
    expect(MATH_MY_ID_COLORS.navy).toBe("#072652");
    expect(MATH_MY_ID_COLORS.blue).toBe("#0047b3");
    expect(MATH_MY_ID_COLORS.blueLight).toBe("#2b7fff");
    expect(MATH_MY_ID_COLORS.gold).toBe("#f5b800");
    expect(MATH_MY_ID_COLORS.goldDark).toBe("#d99b00");
  });

  it("merender MathMyIdMiLogo dengan viewBox 0 0 120 76 dan elemen SVG valid", () => {
    const { container } = render(<MathMyIdMiLogo className="h-5 w-auto" />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg?.getAttribute("viewBox")).toBe("0 0 120 76");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelectorAll("path").length).toBeGreaterThan(0);
    expect(container.querySelector("circle")).toBeInTheDocument();
  });

  it("merender MathMyIdMiLogoLight untuk latar gelap", () => {
    const { container } = render(<MathMyIdMiLogoLight className="h-5 w-auto" />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg?.getAttribute("viewBox")).toBe("0 0 120 76");
  });

  it("merender MathMyIdFullLogo dengan viewBox 50 120 1900 1850", () => {
    const { container } = render(<MathMyIdFullLogo className="size-6" />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg?.getAttribute("viewBox")).toBe("50 120 1900 1850");
    expect(container.querySelectorAll("path").length).toBe(4);
  });

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
