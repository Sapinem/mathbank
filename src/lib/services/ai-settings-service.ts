/**
 * Service Pengaturan AI (M10-b) — validasi & simpan `ai.*`.
 *
 * - Kunci rahasia (`ai.api_key`) disimpan **terenkripsi** lewat `settings-service`.
 * - Baca untuk UI: secret **dimask** ("***") + `isSet` — nilai mentah tak pernah keluar.
 */
import { getSettings, setSettings, type SettingItem } from "@/lib/services/settings-service";
import { AI_KEYS, AI_SECRET_KEYS } from "@/lib/contracts/ai";

/** Item pengaturan AI untuk UI (secret dimask oleh settings-service). */
export async function getAiSettings(): Promise<SettingItem[]> {
  return getSettings([...AI_KEYS]);
}

/** Metadata tipe secret per kunci (untuk penulisan). */
function isSecretKey(key: string): boolean {
  return AI_SECRET_KEYS.includes(key);
}

/** Simpan pengaturan AI dari input klien (camelCase → kunci `ai.*`). */
export async function saveAiSettings(input: {
  enabled?: boolean;
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  maxTokens?: number;
  timeoutMs?: number;
}): Promise<SettingItem[]> {
  const entries: Array<{ key: string; value: string | number | boolean; isSecret?: boolean }> = [];
  if (input.enabled !== undefined) entries.push({ key: "ai.enabled", value: input.enabled });
  if (input.baseUrl !== undefined) entries.push({ key: "ai.base_url", value: input.baseUrl });
  if (input.apiKey !== undefined) entries.push({ key: "ai.api_key", value: input.apiKey, isSecret: true });
  if (input.model !== undefined) entries.push({ key: "ai.model", value: input.model });
  if (input.maxTokens !== undefined) entries.push({ key: "ai.max_tokens", value: input.maxTokens });
  if (input.timeoutMs !== undefined) entries.push({ key: "ai.timeout_ms", value: input.timeoutMs });

  await setSettings(entries, { allowedKeys: AI_KEYS });
  return getAiSettings();
}

/** Kunci yang rahasia (untuk dipakai di tempat lain). */
export function secretAiKeys(): readonly string[] {
  return AI_SECRET_KEYS;
}

export { isSecretKey };
