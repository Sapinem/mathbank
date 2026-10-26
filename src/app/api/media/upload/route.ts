import { z } from "zod";
import { wrapRoute } from "@/lib/api/route-wrapper";
import { uploadMedia } from "@/lib/services/media-service";
import { mediaStorageRoot } from "@/lib/ingest/config";
import {
  BadRequestError,
  PayloadTooLargeError,
  UnsupportedMediaTypeError,
} from "@/lib/auth/guards";

/**
 * POST /api/media — unggah gambar manual (editor soal / galeri).
 *
 * Menerima `multipart/form-data` (field `file`), menyimpan lewat storage yang
 * SAMA dengan ingest, lalu mendaftarkan → `short_id` + shortcode `{{img:…}}`.
 * Inilah pintu yang mencegah gambar guru menjadi orphan.
 *
 * Batas ukuran: 5 MB (selaras praktik QBank) & hanya gambar.
 */
const MAX_BYTES = 5 * 1024 * 1024;

const ALLOWED = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "image/avif",
]);

const emptyQuerySchema = z.object({}).optional();

export const POST = wrapRoute({
  authz: { kind: "route", permission: "media:manage" },
  rateLimit: { capacity: 30, refillPerSec: 0.5 },
  status: 201,
  query: emptyQuerySchema,
  handler: async ({ req }) => {
    const form = await req.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      throw new BadRequestError("Field 'file' wajib berisi berkas gambar.");
    }
    if (!ALLOWED.has(file.type)) {
      throw new UnsupportedMediaTypeError(
        `Tipe berkas tidak didukung: ${file.type || "tak dikenal"}. Gunakan PNG/JPG/GIF/WebP/SVG/AVIF.`,
      );
    }
    if (file.size === 0) {
      throw new BadRequestError("Berkas kosong.");
    }
    if (file.size > MAX_BYTES) {
      throw new PayloadTooLargeError(
        `Ukuran berkas melebihi batas ${MAX_BYTES / 1024 / 1024} MB.`,
      );
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const title = String(form.get("title") ?? "").trim() || file.name.replace(/\.[^.]+$/, "");

    const res = await uploadMedia(
      mediaStorageRoot(),
      { bytes, mimeType: file.type, fileName: file.name },
      { title, sourceOrigin: "manual_upload" },
    );

    return {
      id: res.id,
      shortId: res.shortId,
      shortcode: res.shortcode,
      reused: res.reused,
    };
  },
});
