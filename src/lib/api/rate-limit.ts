/**
 * Rate limiting (L1/L4) — token bucket.
 *
 * Desain:
 *  - **Interface `RateLimitStore`** (async) → `MemoryStore` untuk tes/dev tanpa
 *    DB, `PgRateLimitStore` (`rate-limit-store-pg.ts`) untuk server (ADR-0029).
 *  - **Token bucket**: kapasitas `burst`, diisi ulang `refillPerSec` per detik.
 *  - **Bersama lintas instance**: store PG menyimpan bucket di tabel, sehingga
 *    dua replika berbagi satu kuota dan restart tidak mengosongkannya.
 *
 * Prinsip: **nol dependensi** (janji "install saat perlu").
 *
 * Lihat: docs/KEAMANAN.md (utang S1), docs/RISET-BETTER-AUTH.md §7.5.
 */

/** Hasil pemeriksaan satu permintaan. */
export interface RateLimitResult {
  /** Boleh lanjut? */
  allowed: boolean;
  /** Sisa token setelah permintaan ini. */
  remaining: number;
  /** Milidetik sampai token berikutnya tersedia (0 bila allowed). */
  retryAfterMs: number;
}

/** Kontrak penyimpanan state — ganti implementasi untuk Redis nanti. */
export interface RateLimitStore {
  /**
   * Ambil & pakai 1 token untuk `key`.
   * @param now waktu kini (ms) — injeksi untuk tes deterministik.
   */
  take(
    key: string,
    opts: { capacity: number; refillPerSec: number; now: number },
  ): Promise<RateLimitResult>;

  /** Bersihkan state kedaluwarsa (dipanggil berkala). */
  prune?(now: number): Promise<void> | void;

  /** Reset semua (untuk tes). */
  clear?(): Promise<void> | void;
}

interface Bucket {
  tokens: number;
  updatedAt: number;
}

/**
 * Store in-memory (peta sederhana). Satu bucket per key.
 * TTL implisit: bucket yang lama tak dipakai dibersihkan `prune()`.
 */
export class MemoryStore implements RateLimitStore {
  private buckets = new Map<string, Bucket>();

  async take(
    key: string,
    opts: { capacity: number; refillPerSec: number; now: number },
  ): Promise<RateLimitResult> {
    const { capacity, refillPerSec, now } = opts;
    const prev = this.buckets.get(key) ?? {
      tokens: capacity,
      updatedAt: now,
    };

    // Isi ulang token berdasarkan waktu berlalu.
    const elapsedSec = Math.max(0, (now - prev.updatedAt) / 1000);
    const refilled = Math.min(capacity, prev.tokens + elapsedSec * refillPerSec);

    if (refilled < 1) {
      const deficit = 1 - refilled;
      const retryAfterMs = Math.ceil((deficit / refillPerSec) * 1000);
      this.buckets.set(key, { tokens: refilled, updatedAt: now });
      return { allowed: false, remaining: 0, retryAfterMs };
    }

    const tokens = refilled - 1;
    this.buckets.set(key, { tokens, updatedAt: now });
    return { allowed: true, remaining: Math.floor(tokens), retryAfterMs: 0 };
  }

  /** Buang bucket yang sudah penuh kembali (tak perlu disimpan). */
  prune(now: number): void {
    for (const [key, b] of this.buckets) {
      // Anggap kedaluwarsa bila token penuh atau lama tak aktif (> 1 jam).
      if (now - b.updatedAt > 3_600_000) this.buckets.delete(key);
    }
  }

  clear(): void {
    this.buckets.clear();
  }

  /** Jumlah bucket aktif (untuk tes/pemantauan). */
  size(): number {
    return this.buckets.size;
  }
}

/** Store aktif — dapat diganti (mis. `setStore(new RedisStore())`). */
let store: RateLimitStore = new MemoryStore();

/** Ganti implementasi store (mis. saat beralih ke Redis). */
export function setStore(next: RateLimitStore): void {
  store = next;
}

/** Store saat ini (untuk tes). */
export function getStore(): RateLimitStore {
  return store;
}

/** Kebijakan rate limit per "kelas" endpoint. */
export interface RateLimitPolicy {
  /** Kapasitas burst (jumlah permintaan instan). */
  capacity: number;
  /** Pengisian ulang per detik. */
  refillPerSec: number;
}

/** Kebijakan bawaan (dapat disetel). */
export const DEFAULT_POLICY: RateLimitPolicy = {
  capacity: 60,
  refillPerSec: 1, // ≈ 60/menit steady-state
};

/**
 * **PERF-03:** kebijakan khusus penyajian gambar (`/img/{shortId}`).
 *
 * Burst dinaikkan ke **300** karena satu paket soal (40–50 soal) memuat
 * puluhan gambar sekaligus dalam satu burst saat halaman/pratinjau dibuka —
 * kebijakan default (60) memicu HTTP 429 palsu. Refill tetap 1/detik agar
 * laju berkelanjutan tak berubah.
 */
export const IMAGE_POLICY: RateLimitPolicy = {
  capacity: 300,
  refillPerSec: 1,
};

/**
 * **Fase 3:** kebijakan khusus probe kesehatan (`/api/health`, `/api/ready`).
 *
 * Probe ini publik & murah, tapi jalur DB-nya menjalankan
 * `checkDbInvariants()` — tanpa batas, satu klien bisa membanjiri DB dengan
 * probe. Burst 120 + isi 2/detik (≈120/menit) jauh di atas kadens monitoring
 * normal (beberapa monitor × tiap 10–60 detik) namun tetap membatasi banjir.
 * Cabang liveness murni (`?probe=liveness`, tanpa DB) sengaja TIDAK
 * dibatasi — probe orkestrator tak boleh gagal tertutup oleh rate limit.
 */
export const HEALTH_POLICY: RateLimitPolicy = {
  capacity: 120,
  refillPerSec: 2,
};

/**
 * Cek & pakai token untuk `key`. Murni terhadap store terpasang.
 * @param now injeksi waktu (tes deterministik); default `Date.now()`.
 */
export async function checkRateLimit(
  key: string,
  policy: RateLimitPolicy = DEFAULT_POLICY,
  now: number = Date.now(),
): Promise<RateLimitResult> {
  return store.take(key, {
    capacity: policy.capacity,
    refillPerSec: policy.refillPerSec,
    now,
  });
}

/**
 * Bangun key dari identitas aktor + IP.
 * Prioritas: id aktor (stabil) → IP (fallback).
 */
export function rateLimitKey(
  actorId: string | null,
  ip: string | null,
  scope: string,
): string {
  return `${scope}:${actorId ?? ip ?? "anon"}`;
}

/** Error rate limit (dipetakan ke HTTP 429). */
export class RateLimitError extends Error {
  readonly code = "RATE_LIMITED";
  readonly retryAfterMs: number;
  constructor(retryAfterMs: number) {
    super("Terlalu banyak permintaan. Coba lagi nanti.");
    this.name = "RateLimitError";
    this.retryAfterMs = retryAfterMs;
  }
}
