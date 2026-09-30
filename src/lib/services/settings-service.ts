/**
 * Service pengaturan aplikasi (L5) — baca/tulis `app_settings` (key-value).
 *
 * **Keamanan (penting):** nilai `is_secret` (mis. `ai.api_key`) **TIDAK PERNAH**
 * dikembalikan mentah — dikembalikan sebagai `"***"` bila ada, `null` bila kosong.
 * Penulisan nilai secret tidak akan menimpa dengan string kosong/mask.
 */
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { appSettings } from "@/lib/db/schema/system";
import { decryptSecret, encryptSecret, isEncrypted, getEncryptionKey } from "@/lib/crypto/secrets";

/** Nilai pengaturan umum (JSON). */
export type SettingValue = string | number | boolean | null | object;

export interface SettingItem {
  key: string;
  value: SettingValue;
  isSecret: boolean;
  /** true bila secret ADA isinya (nilai asli tak pernah dikirim). */
  isSet?: boolean;
}

/** Kunci pengaturan UMUM yang dikenal (halaman Pengaturan → Umum). */
export const GENERAL_KEYS = [
  "general.org_name",
  "general.default_grade",
  "general.default_difficulty",
] as const;

/**
 * Kunci RAHASIA yang disimpan **terenkripsi at-rest** (AES-256-GCM, M10-b / D2).
 * Bila terdaftar di sini, nilai ditulis sebagai `v1:iv:tag:ct` dan didekripsi saat dibaca.
 */
export const ENCRYPTED_KEYS: readonly string[] = ["ai.api_key"];

const SECRET_MASK = "***";

/** TRUE bila kunci ini harus dienkripsi at-rest. */
export function isEncryptedKey(key: string): boolean {
  return ENCRYPTED_KEYS.includes(key);
}

/** Baca banyak pengaturan; secret dimask. */
export async function getSettings(keys: string[]): Promise<SettingItem[]> {
  if (keys.length === 0) return [];
  const rows = await db
    .select({
      key: appSettings.key,
      value: appSettings.value,
      isSecret: appSettings.isSecret,
    })
    .from(appSettings)
    .where(inArray(appSettings.key, keys));

  return rows.map((r) => ({
    key: r.key,
    value: r.isSecret ? (r.value ? SECRET_MASK : null) : (r.value as SettingValue),
    isSecret: r.isSecret,
    isSet: r.isSecret ? Boolean(r.value) : undefined,
  }));
}

/** Nilai tunggal (internal) — TIDAK dimask. Dipakai service lain (mis. AI client). */
export async function getSettingRaw(key: string): Promise<SettingValue | undefined> {
  const [row] = await db
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.key, key))
    .limit(1);
  if (!row) return undefined;
  const v = row.value;
  // Kunci terenkripsi: dekripsi bila berbentuk ciphertext.
  if (isEncryptedKey(key) && typeof v === "string" && isEncrypted(v)) {
    try {
      return decryptSecret(v, getEncryptionKey());
    } catch {
      return undefined; // rusak / kunci ENV berubah
    }
  }
  return v as SettingValue;
}

/** Tulis banyak pengaturan (upsert). Lewati secret bernilai mask/kosong. */
export async function setSettings(
  entries: Array<{ key: string; value: SettingValue; isSecret?: boolean }>,
  opts: { allowedKeys?: readonly string[] } = {},
): Promise<void> {
  const filtered = opts.allowedKeys
    ? entries.filter((e) => opts.allowedKeys!.includes(e.key))
    : entries;

  for (const e of filtered) {
    // Jangan timpa secret dengan mask/kosong (UI mengirim balik "***").
    if (e.value === SECRET_MASK || e.value === "") continue;
    // Kunci terenkripsi: enkripsi sebelum simpan.
    const toStore =
      isEncryptedKey(e.key) && typeof e.value === "string"
        ? encryptSecret(e.value, getEncryptionKey())
        : e.value;
    await db
      .insert(appSettings)
      .values({
        key: e.key,
        value: toStore,
        isSecret: e.isSecret ?? false,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: { value: toStore, updatedAt: new Date() },
      });
  }
}
