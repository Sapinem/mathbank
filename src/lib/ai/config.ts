/**
 * Konfigurasi AI (M10-a) — baca `app_settings` (`ai.*`) → objek `AiConfig`.
 *
 * Kunci rahasia (`ai.api_key`) **terenkripsi at-rest** (D2); didekripsi di sini
 * sebelum dipakai. Nilai mentah TIDAK pernah keluar dari modul ini.
 */
import { getSettingRaw } from "@/lib/services/settings-service";
import { decryptSecret, isEncrypted, getEncryptionKey } from "@/lib/crypto/secrets";
import { AI_KEYS } from "@/lib/contracts/ai";

export interface AiConfig {
  enabled: boolean;
  baseUrl: string;
  apiKey: string;
  model: string;
  maxTokens: number;
  timeoutMs: number;
}

const DEFAULTS: AiConfig = {
  enabled: false,
  baseUrl: "",
  apiKey: "",
  model: "",
  maxTokens: 1024,
  timeoutMs: 60000,
};

/** Baca konfigurasi AI lengkap (secret didekripsi). */
export async function getAiConfig(): Promise<AiConfig> {
  const entries = await Promise.all(AI_KEYS.map(async (k) => [k, await getSettingRaw(k)] as const));
  const raw = Object.fromEntries(entries) as Record<string, unknown>;

  const apiKeyStored = typeof raw["ai.api_key"] === "string" ? (raw["ai.api_key"] as string) : "";
  let apiKey = "";
  if (apiKeyStored) {
    if (isEncrypted(apiKeyStored)) {
      try {
        apiKey = decryptSecret(apiKeyStored, getEncryptionKey());
      } catch {
        // Kunci rusak / ENV berubah → anggap tak ada (jangan bikin app crash).
        apiKey = "";
      }
    } else {
      // Toleransi: nilai lama plaintext (pra-enkripsi) tetap terbaca.
      apiKey = apiKeyStored;
    }
  }

  return {
    enabled: Boolean(raw["ai.enabled"] ?? DEFAULTS.enabled),
    baseUrl: typeof raw["ai.base_url"] === "string" ? (raw["ai.base_url"] as string) : DEFAULTS.baseUrl,
    apiKey,
    model: typeof raw["ai.model"] === "string" ? (raw["ai.model"] as string) : DEFAULTS.model,
    maxTokens: numberOr(raw["ai.max_tokens"], DEFAULTS.maxTokens),
    timeoutMs: numberOr(raw["ai.timeout_ms"], DEFAULTS.timeoutMs),
  };
}

function numberOr(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

/** TRUE bila AI siap dipakai (enabled + base_url + model). */
export function isAiReady(cfg: AiConfig): boolean {
  return cfg.enabled && Boolean(cfg.baseUrl) && Boolean(cfg.model);
}
