import { deflateRawSync } from "node:zlib";

/**
 * Penulis ZIP minimal (M12, D6) — **tanpa dependency**, hanya `node:zlib`.
 *
 * Mendukung format ZIP dengan metode **deflate** (8). Cukup untuk membungkus
 * berkas ekspor GitSync (banyak `.xml` kecil). Menulis CRC-32 sendiri karena
 * Node tak menyediakannya di `zlib`.
 *
 * Struktur berkas (per entri):
 *   [Local File Header][nama][data ter-deflate]
 * … lalu di akhir:
 *   [Central Directory Header per entri][End Of Central Directory]
 */

/** Tabel CRC-32 (dihitung sekali). */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

/** Hitung CRC-32 dari buffer. */
export function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]!) & 0xff]! ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

export interface ZipEntry {
  /** Nama dalam arsip (pakai `/`, tanpa `..`). */
  name: string;
  /** Isi berkas. */
  data: Buffer;
}

/**
 * Susun buffer ZIP dari daftar entri.
 * Semua nama disanitasi: buang `\` → `/`, tolak `..`, buang `/` di depan.
 */
export function createZip(entries: ZipEntry[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;

  for (const e of entries) {
    const name = sanitizeEntryName(e.name);
    const nameBuf = Buffer.from(name, "utf8");
    const crc = crc32(e.data);
    const compressed = deflateRawSync(e.data, { level: 9 });
    // Bila deflate malah lebih besar (data kecil), simpan apa adanya (store).
    const useDeflate = compressed.length < e.data.length;
    const method = useDeflate ? 8 : 0;
    const payload = useDeflate ? compressed : e.data;

    // ── Local File Header ──
    const lfh = Buffer.alloc(30);
    lfh.writeUInt32LE(0x04034b50, 0); // signature
    lfh.writeUInt16LE(20, 4); // version needed
    lfh.writeUInt16LE(0, 6); // flags
    lfh.writeUInt16LE(method, 8); // compression method
    lfh.writeUInt16LE(0, 10); // mod time
    lfh.writeUInt16LE(0, 12); // mod date
    lfh.writeUInt32LE(crc, 14); // crc-32
    lfh.writeUInt32LE(payload.length, 18); // compressed size
    lfh.writeUInt32LE(e.data.length, 22); // uncompressed size
    lfh.writeUInt16LE(nameBuf.length, 26); // name length
    lfh.writeUInt16LE(0, 28); // extra length
    locals.push(lfh, nameBuf, payload);

    // ── Central Directory Header ──
    const cdh = Buffer.alloc(46);
    cdh.writeUInt32LE(0x02014b50, 0); // signature
    cdh.writeUInt16LE(20, 4); // version made by
    cdh.writeUInt16LE(20, 6); // version needed
    cdh.writeUInt16LE(0, 8); // flags
    cdh.writeUInt16LE(method, 10); // method
    cdh.writeUInt16LE(0, 12); // mod time
    cdh.writeUInt16LE(0, 14); // mod date
    cdh.writeUInt32LE(crc, 16);
    cdh.writeUInt32LE(payload.length, 20);
    cdh.writeUInt32LE(e.data.length, 24);
    cdh.writeUInt16LE(nameBuf.length, 28);
    cdh.writeUInt16LE(0, 30); // extra
    cdh.writeUInt16LE(0, 32); // comment
    cdh.writeUInt16LE(0, 34); // disk number
    cdh.writeUInt16LE(0, 36); // internal attrs
    cdh.writeUInt32LE(0, 38); // external attrs
    cdh.writeUInt32LE(offset, 42); // local header offset
    centrals.push(cdh, nameBuf);

    offset += lfh.length + nameBuf.length + payload.length;
  }

  const centralBuf = Buffer.concat(centrals);
  // ── End Of Central Directory ──
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4); // disk
  eocd.writeUInt16LE(0, 6); // cd start disk
  eocd.writeUInt16LE(entries.length, 8); // entries on disk
  eocd.writeUInt16LE(entries.length, 10); // total entries
  eocd.writeUInt32LE(centralBuf.length, 12); // cd size
  eocd.writeUInt32LE(offset, 16); // cd offset
  eocd.writeUInt16LE(0, 20); // comment length

  return Buffer.concat([...locals, centralBuf, eocd]);
}

/** Sanitasi nama entri: `/` saja, tanpa `..`, tanpa leading `/`. */
export function sanitizeEntryName(name: string): string {
  return name
    .replace(/\\/g, "/")
    .split("/")
    .filter((seg) => seg && seg !== "." && seg !== "..")
    .join("/");
}
