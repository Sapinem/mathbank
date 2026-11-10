import { describe, it, expect } from "vitest";
import { getImageDimensions } from "./dimensions";

describe("getImageDimensions", () => {
  describe("PNG", () => {
    it("membaca dimensi dari buffer PNG valid", () => {
      // PNG header: 8 bytes magic + 4 bytes length + 4 bytes 'IHDR' + 4 bytes width + 4 bytes height
      const buf = new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG magic
        0x00, 0x00, 0x00, 0x0d, // IHDR length (13)
        0x49, 0x48, 0x44, 0x52, // 'IHDR'
        0x00, 0x00, 0x02, 0x80, // width: 640
        0x00, 0x00, 0x01, 0xe0, // height: 480
        0x08, 0x06, 0x00, 0x00, 0x00,
      ]);
      const res = getImageDimensions(buf);
      expect(res).toEqual({ width: 640, height: 480, format: "png" });
    });
  });

  describe("JPEG", () => {
    it("membaca dimensi dari buffer JPEG dengan marker SOF0", () => {
      // JPEG: SOI (FF D8) + APP0 (FF E0 00 10 ...) + SOF0 (FF C0 00 11 08 height width ...)
      const buf = new Uint8Array([
        0xff, 0xd8, // SOI
        0xff, 0xe0, 0x00, 0x10, // APP0 length 16
        0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00,
        0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
        0xff, 0xc0, // SOF0
        0x00, 0x11, // length 17
        0x08, // precision 8
        0x01, 0x90, // height: 400
        0x03, 0x20, // width: 800
        0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
      ]);
      const res = getImageDimensions(buf);
      expect(res).toEqual({ width: 800, height: 400, format: "jpeg" });
    });

    it("membaca dimensi dari buffer JPEG dengan marker SOF2 (progressive)", () => {
      const buf = new Uint8Array([
        0xff, 0xd8, // SOI
        0xff, 0xc2, // SOF2
        0x00, 0x0b, // length 11
        0x08, // precision
        0x00, 0xc8, // height: 200
        0x01, 0x2c, // width: 300
        0x01, 0x01, 0x11, 0x00,
      ]);
      const res = getImageDimensions(buf);
      expect(res).toEqual({ width: 300, height: 200, format: "jpeg" });
    });
  });

  describe("GIF", () => {
    it("membaca dimensi dari buffer GIF89a", () => {
      const buf = new Uint8Array([
        0x47, 0x49, 0x46, 0x38, 0x39, 0x61, // 'GIF89a'
        0xf4, 0x01, // width: 500 (little-endian)
        0x2c, 0x01, // height: 300 (little-endian)
        0x70, 0x00, 0x00,
      ]);
      const res = getImageDimensions(buf);
      expect(res).toEqual({ width: 500, height: 300, format: "gif" });
    });
  });

  describe("WebP", () => {
    it("membaca dimensi dari buffer WebP Lossy (VP8)", () => {
      const buf = new Uint8Array(30);
      // 'RIFF' .... 'WEBP'
      buf.set([0x52, 0x49, 0x46, 0x46], 0);
      buf.set([0x57, 0x45, 0x42, 0x50], 8);
      // 'VP8 ' chunk
      buf.set([0x56, 0x50, 0x38, 0x20], 12);
      // key frame code: 0x9D 0x01 0x2A at offset 23
      buf.set([0x9d, 0x01, 0x2a], 23);
      // width: 400 (0x0190), height: 300 (0x012c) at offset 26 & 28
      buf[26] = 0x90;
      buf[27] = 0x01;
      buf[28] = 0x2c;
      buf[29] = 0x01;
      const res = getImageDimensions(buf);
      expect(res).toEqual({ width: 400, height: 300, format: "webp" });
    });

    it("membaca dimensi dari buffer WebP Lossless (VP8L)", () => {
      const buf = new Uint8Array(25);
      buf.set([0x52, 0x49, 0x46, 0x46], 0);
      buf.set([0x57, 0x45, 0x42, 0x50], 8);
      // 'VP8L' chunk
      buf.set([0x56, 0x50, 0x38, 0x4c], 12);
      // signature byte 0x2F at offset 20
      buf[20] = 0x2f;
      // width = 1 + (((b1 & 0x3f) << 8) | b0) => for width 500: 499 = 0x01F3 => b0 = 0xF3, b1 low = 0x01
      // height = 1 + (((b3 & 0xf) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)) => for height 300: 299 = 0x012B => (299 << 6)
      // let's calculate b0, b1, b2, b3:
      // width - 1 = 499 (0x01F3)
      // height - 1 = 299 (0x012B)
      // packed = 499 | (299 << 14)
      const packed = 499 | (299 << 14);
      buf[21] = packed & 0xff;
      buf[22] = (packed >> 8) & 0xff;
      buf[23] = (packed >> 16) & 0xff;
      buf[24] = (packed >> 24) & 0xff;

      const res = getImageDimensions(buf);
      expect(res).toEqual({ width: 500, height: 300, format: "webp" });
    });

    it("membaca dimensi dari buffer WebP Extended (VP8X)", () => {
      const buf = new Uint8Array(30);
      buf.set([0x52, 0x49, 0x46, 0x46], 0);
      buf.set([0x57, 0x45, 0x42, 0x50], 8);
      // 'VP8X' chunk
      buf.set([0x56, 0x50, 0x38, 0x58], 12);
      // width - 1 (24-bit LE at 24)
      // for width 1024: 1023 = 0x0003FF => [0xFF, 0x03, 0x00]
      buf[24] = 0xff;
      buf[25] = 0x03;
      buf[26] = 0x00;
      // height - 1 (24-bit LE at 27)
      // for height 768: 767 = 0x0002FF => [0xFF, 0x02, 0x00]
      buf[27] = 0xff;
      buf[28] = 0x02;
      buf[29] = 0x00;

      const res = getImageDimensions(buf);
      expect(res).toEqual({ width: 1024, height: 768, format: "webp" });
    });
  });

  describe("SVG", () => {
    it("membaca dimensi dari atribut viewBox SVG", () => {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 450"><circle r="10"/></svg>`;
      const buf = new TextEncoder().encode(svg);
      const res = getImageDimensions(buf);
      expect(res).toEqual({ width: 600, height: 450, format: "svg" });
    });

    it("membaca dimensi dari atribut width dan height SVG", () => {
      const svg = `<svg width="800px" height="600px"><rect/></svg>`;
      const buf = new TextEncoder().encode(svg);
      const res = getImageDimensions(buf);
      expect(res).toEqual({ width: 800, height: 600, format: "svg" });
    });
  });

  describe("Edge cases & Galat", () => {
    it("mengembalikan null untuk buffer kosong", () => {
      expect(getImageDimensions(new Uint8Array(0))).toBeNull();
    });

    it("mengembalikan null untuk buffer terlalu pendek", () => {
      expect(getImageDimensions(new Uint8Array([0x89, 0x50]))).toBeNull();
    });

    it("mengembalikan null untuk format yang tidak dikenal", () => {
      expect(getImageDimensions(new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09]))).toBeNull();
    });
  });
});
