/**
 * Ekstraktor dimensi gambar (width & height) murni berbasis pembacaan header byte biner.
 * Fungsi murni (L4) tanpa dependensi eksternal (zero external dependencies).
 * Mendukung format PNG, JPEG, WebP, GIF, dan SVG.
 */

export interface ImageDimensions {
  width: number;
  height: number;
  format: "png" | "jpeg" | "webp" | "gif" | "svg";
}

/**
 * Membaca dimensi gambar dari buffer byte (Uint8Array).
 * Mengembalikan `{ width, height, format }` atau `null` jika tidak dapat dikenali/rusak.
 */
export function getImageDimensions(data: Uint8Array): ImageDimensions | null {
  if (!data || data.length < 10) return null;

  // 1. PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    data[0] === 0x89 &&
    data[1] === 0x50 &&
    data[2] === 0x4e &&
    data[3] === 0x47 &&
    data[4] === 0x0d &&
    data[5] === 0x0a &&
    data[6] === 0x1a &&
    data[7] === 0x0a
  ) {
    if (data.length < 24) return null;
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const width = view.getUint32(16, false);
    const height = view.getUint32(20, false);
    if (width > 0 && height > 0) {
      return { width, height, format: "png" };
    }
  }

  // 2. GIF: GIF87a atau GIF89a
  if (
    data[0] === 0x47 &&
    data[1] === 0x49 &&
    data[2] === 0x46 &&
    data[3] === 0x38 &&
    (data[4] === 0x37 || data[4] === 0x39) &&
    data[5] === 0x61
  ) {
    if (data.length < 10) return null;
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const width = view.getUint16(6, true);
    const height = view.getUint16(8, true);
    if (width > 0 && height > 0) {
      return { width, height, format: "gif" };
    }
  }

  // 3. WebP: RIFF .... WEBP
  if (
    data[0] === 0x52 &&
    data[1] === 0x49 &&
    data[2] === 0x46 &&
    data[3] === 0x46 &&
    data.length >= 12 &&
    data[8] === 0x57 &&
    data[9] === 0x45 &&
    data[10] === 0x42 &&
    data[11] === 0x50
  ) {
    return parseWebPDimensions(data);
  }

  // 4. JPEG: FF D8 ...
  if (data[0] === 0xff && data[1] === 0xd8) {
    return parseJpegDimensions(data);
  }

  // 5. SVG: teks memuat <svg
  return parseSvgDimensions(data);
}

function parseWebPDimensions(data: Uint8Array): ImageDimensions | null {
  if (data.length < 16) return null;
  // Chunk type pada offset 12..16
  const chunkHeader = String.fromCharCode(data[12]!, data[13]!, data[14]!, data[15]!);

  // VP8 Lossy
  if (chunkHeader === "VP8 " && data.length >= 30) {
    // 0x9D 0x01 0x2A adalah kode frame VP8 pada offset 23..26
    if (data[23] === 0x9d && data[24] === 0x01 && data[25] === 0x2a) {
      const width = (data[26]! | (data[27]! << 8)) & 0x3fff;
      const height = (data[28]! | (data[29]! << 8)) & 0x3fff;
      if (width > 0 && height > 0) {
        return { width, height, format: "webp" };
      }
    }
  }

  // VP8L Lossless
  if (chunkHeader === "VP8L" && data.length >= 25) {
    if (data[20] === 0x2f) {
      const b0 = data[21]!;
      const b1 = data[22]!;
      const b2 = data[23]!;
      const b3 = data[24]!;
      const width = 1 + (((b1 & 0x3f) << 8) | b0);
      const height = 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
      if (width > 0 && height > 0) {
        return { width, height, format: "webp" };
      }
    }
  }

  // VP8X Extended
  if (chunkHeader === "VP8X" && data.length >= 30) {
    const width = 1 + (data[24]! | (data[25]! << 8) | (data[26]! << 16));
    const height = 1 + (data[27]! | (data[28]! << 8) | (data[29]! << 16));
    if (width > 0 && height > 0) {
      return { width, height, format: "webp" };
    }
  }

  return null;
}

function parseJpegDimensions(data: Uint8Array): ImageDimensions | null {
  let offset = 2;
  const len = data.length;

  while (offset < len - 1) {
    if (data[offset] !== 0xff) {
      offset++;
      continue;
    }

    // Lewati seluruh padding 0xFF
    while (offset < len && data[offset] === 0xff) {
      offset++;
    }
    if (offset >= len) break;

    const marker = data[offset]!;

    // SOF Markers (Start Of Frame): SOF0, SOF1, SOF2, SOF3, SOF5..SOF7, SOF9..SOF11, SOF13..SOF15
    if (
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf)
    ) {
      if (offset + 7 < len) {
        const height = (data[offset + 4]! << 8) | data[offset + 5]!;
        const width = (data[offset + 6]! << 8) | data[offset + 7]!;
        if (width > 0 && height > 0) {
          return { width, height, format: "jpeg" };
        }
      }
      break;
    }

    // Stop jika sampai ke SOS (Start of Scan) atau EOI (End of Image)
    if (marker === 0xda || marker === 0xd9) {
      break;
    }

    // Standalone markers tanpa panjang (RST0..RST7, SOI, dsb)
    if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0xd8 || marker === 0x01) {
      offset++;
      continue;
    }

    // Segment dengan panjang 2-byte big-endian
    if (offset + 2 < len) {
      const segmentLen = (data[offset + 1]! << 8) | data[offset + 2]!;
      if (segmentLen < 2) break;
      offset += 1 + segmentLen;
    } else {
      break;
    }
  }

  return null;
}

function parseSvgDimensions(data: Uint8Array): ImageDimensions | null {
  // Hanya baca hingga 4096 byte awal untuk efisiensi
  const slice = data.subarray(0, Math.min(data.length, 4096));
  let text: string;
  try {
    text = new TextDecoder("utf-8").decode(slice);
  } catch {
    return null;
  }

  const svgMatch = text.match(/<svg\b([^>]*)>/i);
  if (!svgMatch) return null;

  const svgAttrs = svgMatch[1]!;

  // 1. Coba viewBox="minX minY width height"
  const viewBoxMatch = svgAttrs.match(
    /\bviewBox\s*=\s*["']\s*([-\d.]+)[,\s]+([-\d.]+)[,\s]+([-\d.]+)[,\s]+([-\d.]+)\s*["']/i,
  );
  if (viewBoxMatch) {
    const width = Math.round(parseFloat(viewBoxMatch[3]!));
    const height = Math.round(parseFloat(viewBoxMatch[4]!));
    if (width > 0 && height > 0) {
      return { width, height, format: "svg" };
    }
  }

  // 2. Coba atribut width & height eksplisit
  const widthMatch = svgAttrs.match(/\bwidth\s*=\s*["']\s*([-\d.]+)(?:px|pt)?\s*["']/i);
  const heightMatch = svgAttrs.match(/\bheight\s*=\s*["']\s*([-\d.]+)(?:px|pt)?\s*["']/i);
  if (widthMatch && heightMatch) {
    const width = Math.round(parseFloat(widthMatch[1]!));
    const height = Math.round(parseFloat(heightMatch[1]!));
    if (width > 0 && height > 0) {
      return { width, height, format: "svg" };
    }
  }

  return null;
}
