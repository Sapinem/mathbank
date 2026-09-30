/**
 * Enkripsi rahasia pengaturan (M10-b) — AES-256-GCM.
 *
 * **Keputusan D2 (2026-09-30):** `ai.api_key` disimpan **terenkripsi at-rest**.
 * Kunci enkripsi dari ENV `SETTINGS_ENC_KEY` (32 byte: hex 64 char atau base64).
 *
 * Format tersimpan (string): `v1:<iv-b64>:<tag-b64>:<ciphertext-b64>`.
 * Awalan `v1` memungkinkan rotasi skema tanpa menebak format lama.
 *
 * **Aturan:** fungsi murni — tanpa DB, tanpa network (L6).
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";
const VERSION = "v1";
const IV_BYTES = 12; // GCM standar

/** Apakah teks ini hasil `encryptSecret`? */
export function isEncrypted(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(`${VERSION}:`);
}

/** Ambil kunci 32 byte dari ENV. Melempar bila tak ada / salah panjang. */
export function getEncryptionKey(env: Record<string, string | undefined> = process.env): Buffer {
  const raw = env.SETTINGS_ENC_KEY?.trim();
  if (!raw) {
    throw new Error(
      "SETTINGS_ENC_KEY belum diatur — wajib 32 byte (hex 64 char atau base64). Lihat .env.example.",
    );
  }
  const key = parseKey(raw);
  if (key.length !== 32) {
    throw new Error(`SETTINGS_ENC_KEY harus 32 byte, dapat ${key.length} byte.`);
  }
  return key;
}

/** Terima hex (64) atau base64 → Buffer. */
function parseKey(raw: string): Buffer {
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, "hex");
  return Buffer.from(raw, "base64");
}

/** Enkripsi teks → string `v1:iv:tag:ct` (base64). */
export function encryptSecret(plaintext: string, key: Buffer): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64"), tag.toString("base64"), ct.toString("base64")].join(":");
}

/** Dekripsi string `v1:iv:tag:ct`. Melempar bila rusak / kunci salah. */
export function decryptSecret(stored: string, key: Buffer): string {
  const parts = stored.split(":");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error("Format rahasia terenkripsi tak dikenal.");
  }
  const [, ivB64, tagB64, ctB64] = parts;
  const decipher = createDecipheriv(ALGO, key, Buffer.from(ivB64!, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64!, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(ctB64!, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

/** Buat kunci baru 32 byte (hex) — untuk setup awal. */
export function generateEncryptionKey(): string {
  return randomBytes(32).toString("hex");
}
