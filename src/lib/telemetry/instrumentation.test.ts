import { describe, it, expect, vi, afterEach } from "vitest";
import {
  runPruneOnce,
  startTelemetryMaintenance,
  stopTelemetryMaintenance,
  maintenanceStatus,
} from "./instrumentation";
import { setStore, getStore } from "@/lib/api/rate-limit";
import { setIdempotencyStore, getIdempotencyStore } from "@/lib/api/idempotency";

/**
 * Tes **ACT-03 C** — pemeliharaan state in-memory.
 *
 * Membuktikan `prune()` benar-benar dipanggil pada kedua store (rate limit +
 * idempotensi), bahwa pemanggilan bersifat idempoten (satu timer), dan bahwa
 * kegagalan prune TIDAK melempar ke pemanggil (best-effort).
 */

afterEach(() => {
  stopTelemetryMaintenance();
});

/** Simpan store asli agar tiap tes mulai dari keadaan bersih. */
const ORIGINAL_RATE_STORE = getStore();
const ORIGINAL_IDEM_STORE = getIdempotencyStore();

afterEach(() => {
  setStore(ORIGINAL_RATE_STORE);
  setIdempotencyStore(ORIGINAL_IDEM_STORE);
});

describe("runPruneOnce", () => {
  it("memanggil prune() pada store rate-limit dan idempotensi", async () => {
    const ratePrune = vi.fn();
    const idemPrune = vi.fn();
    setStore({ take: () => ({ allowed: true, remaining: 1, retryAfterMs: 0 }), prune: ratePrune });
    setIdempotencyStore({
      get: () => null,
      save: () => {},
      markInFlight: () => {},
      forget: () => {},
      prune: idemPrune,
    });

    await runPruneOnce(1_000);
    expect(ratePrune).toHaveBeenCalledWith(1_000);
    expect(idemPrune).toHaveBeenCalledWith(1_000);
    expect(maintenanceStatus().runs).toBe(1);
    expect(maintenanceStatus().lastError).toBeNull();
  });

  it("store tanpa prune() (kontrak opsional) tidak membuat gagal", async () => {
    setStore({ take: () => ({ allowed: true, remaining: 1, retryAfterMs: 0 }) });
    await expect(runPruneOnce(1)).resolves.toBeUndefined();
  });

  it("kegagalan prune ditelan (best-effort, tak menjatuhkan proses)", async () => {
    setStore({
      take: () => ({ allowed: true, remaining: 1, retryAfterMs: 0 }),
      prune: () => {
        throw new Error("boom");
      },
    });
    await expect(runPruneOnce(2)).resolves.toBeUndefined();
    expect(maintenanceStatus().lastError).toContain("boom");
  });
});

describe("startTelemetryMaintenance", () => {
  it("idempoten: pemanggilan ganda tidak membuat timer kedua", () => {
    startTelemetryMaintenance(60_000);
    const first = maintenanceStatus().timer;
    startTelemetryMaintenance(60_000);
    expect(maintenanceStatus().timer).toBe(first);
    stopTelemetryMaintenance();
    expect(maintenanceStatus().timer).toBeNull();
  });
});
