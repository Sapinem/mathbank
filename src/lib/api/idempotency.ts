/**
 * Proteksi idempotensi request (`Idempotency-Key`) — #4 enterprise.
 *
 * Desain (sejalan dengan `rate-limit.ts`):
 *  - **Interface `IdempotencyStore`** → in-memory (`MemoryStore`) sekarang;
 *    **siap-swap** ke Redis saat multi-instance (kunci harus lintas proses).
 *  - Alur: klien mengirim header `Idempotency-Key` (UUID) pada mutasi
 *    `POST`/`PATCH`. Bila key **sama** masuk lagi dalam jendela TTL →
 *    kembalikan respons yang **disimpan** (tanpa menjalankan handler lagi) →
 *    mencegah double-submit (jaringan lambat / klik ganda).
 *  - **Nol dependensi** (janji "install saat perlu").
 *
 * Lihat: docs/audit/CATATAN-PENYEMPURNAAN-ENTERPRISE.md §4.
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

/** Kontrak penyimpanan — ganti implementasi untuk Redis nanti. */
export interface IdempotencyStore {
  /** Ambil entri yang masih berlaku untuk `key` (atau null). */
  get(key: string): Entry | null;
  /** Simpan hasil respons untuk `key` selama `ttlMs`. */
  save(key: string, entry: Entry): void;
  /** Tandai `key` sedang diproses (in-flight) selama `ttlMs`. */
  markInFlight(key: string, fingerprint: string, ttlMs: number): void;
  /** Hapus entri `key` (mis. saat handler gagal). */
  forget(key: string): void;
  /** Bersihkan entri kedaluwarsa. */
  prune?(now: number): void;
  /** Reset semua (tes). */
  clear?(): void;
}

/** Implementasi in-memory sederhana. */
export class MemoryStore implements IdempotencyStore {
  private map = new Map<string, Entry>();

  get(key: string): Entry | null {
    const e = this.map.get(key);
    if (!e) return null;
    if (e.expiresAt <= Date.now()) {
      this.map.delete(key);
      return null;
    }
    return e;
  }

  save(key: string, entry: Entry): void {
    this.map.set(key, { ...entry, inFlight: false });
  }

  markInFlight(key: string, fingerprint: string, ttlMs: number): void {
    this.map.set(key, {
      status: 0,
      body: null,
      fingerprint,
      expiresAt: Date.now() + ttlMs,
      inFlight: true,
    });
  }

  forget(key: string): void {
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

/** Ganti implementasi store (mis. Redis). */
export function setIdempotencyStore(next: IdempotencyStore): void {
  store = next;
}

/** Store aktif (tes). */
export function getIdempotencyStore(): IdempotencyStore {
  return store;
}

/** Hasil pemeriksaan idempotensi untuk sebuah key. */
export type IdempotencyCheck =
  | { kind: "fresh" } // belum pernah → jalankan handler
  | { kind: "replay"; status: number; body: unknown } // sudah ada → pakai ulang
  | { kind: "in-flight" } // sedang diproses → tolak sementara
  | { kind: "mismatch" }; // key sama, payload beda → 422 (jangan replay)

/** TTL bawaan: 60 detik (sesuai catatan enterprise). */
export const DEFAULT_TTL_MS = 60_000;

/**
 * Periksa key idempotensi.
 * - Bila belum ada → tandai in-flight & kembalikan `fresh`.
 * - Bila sudah ada (selesai) dengan sidik jari SAMA → `replay`.
 * - Bila sudah ada dengan sidik jari BEDA → `mismatch` (key dipakai ulang
 *   untuk payload lain; me-replay akan mengembalikan resource yang salah).
 * - Bila sedang diproses → `in-flight`.
 */
export function checkIdempotency(
  key: string,
  fingerprint: string,
  ttlMs = DEFAULT_TTL_MS,
): IdempotencyCheck {
  const existing = store.get(key);
  if (!existing) {
    store.markInFlight(key, fingerprint, ttlMs);
    return { kind: "fresh" };
  }
  if (existing.inFlight) return { kind: "in-flight" };
  if (existing.fingerprint !== fingerprint) return { kind: "mismatch" };
  return { kind: "replay", status: existing.status, body: existing.body };
}

/** Simpan hasil agar request berikutnya dengan key sama di-replay. */
export function rememberResponse(
  key: string,
  status: number,
  body: unknown,
  fingerprint: string,
  ttlMs = DEFAULT_TTL_MS,
): void {
  store.save(key, {
    status,
    body,
    fingerprint,
    expiresAt: Date.now() + ttlMs,
    inFlight: false,
  });
}
