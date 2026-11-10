/**
 * Proteksi idempotensi request (`Idempotency-Key`) — #4 enterprise, ADR-0029.
 *
 * Desain:
 *  - **Interface `IdempotencyStore`** (async) → `MemoryStore` untuk tes/dev tanpa
 *    DB, `PgIdempotencyStore` (`idempotency-store-pg.ts`) untuk server.
 *  - Alur: klien mengirim header `Idempotency-Key` pada mutasi. Key sama dalam
 *    jendela TTL → respons tersimpan dikembalikan tanpa menjalankan handler.
 *  - **Klaim atomik**: `claim()` adalah satu operasi (bukan baca-lalu-tulis),
 *    sehingga dua permintaan paralel dengan key sama tak bisa dua-duanya lolos.
 *  - **Fail-closed**: bila store tak bisa dihubungi, permintaan DITOLAK. Melepas
 *    proteksi diam-diam akan menjalankan mutasi dua kali — persis yang dicegah.
 */

/** Entri respons tersimpan. */
interface Entry {
  status: number;
  body: unknown;
  /**
   * Sidik jari request (method + path + body mentah). Key yang sama dengan
   * **payload berbeda** bukan "permintaan ulang" — itu salah pakai klien dan
   * harus ditolak, bukan dijawab dengan respons lama.
   */
  fingerprint: string;
  /** Kapan entri kedaluwarsa (ms epoch). */
  expiresAt: number;
  /** Penanda "sedang diproses" — cegah dua request paralel key sama. */
  inFlight: boolean;
}

/** Kontrak penyimpanan — implementasi memori (tes) & PostgreSQL (server). */
export interface IdempotencyStore {
  /**
   * Klaim `key` untuk permintaan ini — **atomik**.
   * Mengembalikan keputusan yang sama seperti `checkIdempotency` dulu.
   */
  claim(key: string, fingerprint: string, ttlMs: number): Promise<IdempotencyCheck>;
  /** Simpan hasil agar request berikutnya dengan key sama di-replay. */
  remember(
    key: string,
    status: number,
    body: unknown,
    fingerprint: string,
    ttlMs: number,
  ): Promise<void>;
  /** Hapus entri `key` (mis. saat handler gagal). */
  forget(key: string): Promise<void>;
  /** Bersihkan entri kedaluwarsa. */
  prune?(now: number): Promise<void> | void;
  /** Reset semua (tes). */
  clear?(): Promise<void> | void;
}

/** Hasil pemeriksaan idempotensi untuk sebuah key. */
export type IdempotencyCheck =
  | { kind: "fresh" } // belum pernah → jalankan handler
  | { kind: "replay"; status: number; body: unknown } // sudah ada → pakai ulang
  | { kind: "in-flight" } // sedang diproses → tolak sementara
  | { kind: "mismatch" }; // key sama, payload beda → 422 (jangan replay)

/** TTL bawaan: 60 detik (sesuai catatan enterprise). */
export const DEFAULT_TTL_MS = 60_000;

/** Implementasi in-memory — satu proses, cukup untuk tes & dev tanpa DB. */
export class MemoryStore implements IdempotencyStore {
  private map = new Map<string, Entry>();

  async claim(key: string, fingerprint: string, ttlMs: number): Promise<IdempotencyCheck> {
    const now = Date.now();
    const existing = this.map.get(key);

    if (!existing || existing.expiresAt <= now) {
      this.map.set(key, { status: 0, body: null, fingerprint, expiresAt: now + ttlMs, inFlight: true });
      return { kind: "fresh" };
    }
    if (existing.inFlight) return { kind: "in-flight" };
    if (existing.fingerprint !== fingerprint) return { kind: "mismatch" };
    return { kind: "replay", status: existing.status, body: existing.body };
  }

  async remember(
    key: string,
    status: number,
    body: unknown,
    fingerprint: string,
    ttlMs: number,
  ): Promise<void> {
    this.map.set(key, {
      status,
      body,
      fingerprint,
      expiresAt: Date.now() + ttlMs,
      inFlight: false,
    });
  }

  async forget(key: string): Promise<void> {
    this.map.delete(key);
  }

  prune(now: number): void {
    for (const [k, e] of this.map) {
      if (e.expiresAt <= now) this.map.delete(k);
    }
  }

  clear(): void {
    this.map.clear();
  }

  size(): number {
    return this.map.size;
  }
}

let store: IdempotencyStore = new MemoryStore();

/** Ganti implementasi store (dipanggil bootstrap server, ADR-0029). */
export function setIdempotencyStore(next: IdempotencyStore): void {
  store = next;
}

/** Store aktif (tes). */
export function getIdempotencyStore(): IdempotencyStore {
  return store;
}

/** Klaim key idempotensi (atomik di store). */
export function checkIdempotency(
  key: string,
  fingerprint: string,
  ttlMs = DEFAULT_TTL_MS,
): Promise<IdempotencyCheck> {
  return store.claim(key, fingerprint, ttlMs);
}

/** Simpan hasil agar request berikutnya dengan key sama di-replay. */
export function rememberResponse(
  key: string,
  status: number,
  body: unknown,
  fingerprint: string,
  ttlMs = DEFAULT_TTL_MS,
): Promise<void> {
  return store.remember(key, status, body, fingerprint, ttlMs);
}
