import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tes unit `commitIngestBatch` — tanpa DB.
 *
 * Yang dikunci: batch yang SUDAH ter-commit tidak dilaporkan sebagai gagal
 * hanya karena penandaan event melempar. Sebelumnya exception itu naik ke
 * route, pemanggil menerima 500, dan pengulangan dengan id yang sama kena 409
 * padahal soalnya sudah tersimpan.
 */
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("./config", () => ({ mediaStorageRoot: () => "/tmp/media-uji" }));
vi.mock("./service", () => ({ processQueueItem: vi.fn() }));
vi.mock("./event-resolve", () => ({
  resolveEventsForBundles: vi.fn(),
  findUnknownEvents: vi.fn(),
}));

import { processQueueItem } from "./service";
import { resolveEventsForBundles, findUnknownEvents } from "./event-resolve";
import { commitIngestBatch } from "./commit-batch";
import type { Actor } from "@/lib/auth/actor";
import type { IngestQueueItem } from "@/lib/db/schema/system";

const actor: Actor = { id: "u-1", name: "Uji", roles: ["admin"], via: "session" };

const hasil = (bundleId?: string) => ({
  id: "q-1",
  status: "completed" as const,
  bundleId,
  created: 2,
  linked: 0,
  skipped: 0,
  rejected: 0,
  failed: 0,
  storedCount: 2,
  failedCount: 0,
  failures: [],
  mediaOk: 0,
  mediaFailed: 0,
});

const item = { id: "i-1" } as IngestQueueItem;

beforeEach(() => {
  vi.mocked(processQueueItem).mockReset();
  vi.mocked(resolveEventsForBundles).mockReset();
  vi.mocked(findUnknownEvents).mockReset();
});

describe("commitIngestBatch", () => {
  it("mengagregasi ringkasan satu putaran", async () => {
    vi.mocked(processQueueItem).mockResolvedValue(hasil());
    const r = await commitIngestBatch([item, item, item], { actor, limit: 2 });
    expect(r.summary.processed).toBe(2);
    expect(r.summary.created).toBe(4);
    expect(r.summary.remaining).toBe(1);
    expect(r.eventsTagged).toBe(0);
    expect(r.eventsError).toBeUndefined();
  });

  it("tidak menyentuh katalog event bila tak ada bundle", async () => {
    vi.mocked(processQueueItem).mockResolvedValue(hasil());
    await commitIngestBatch([item], { actor, limit: 10 });
    expect(resolveEventsForBundles).not.toHaveBeenCalled();
    expect(findUnknownEvents).not.toHaveBeenCalled();
  });

  it("kegagalan penandaan event TIDAK membatalkan batch yang sudah ter-commit", async () => {
    vi.mocked(processQueueItem).mockResolvedValue(hasil("b-1"));
    vi.mocked(resolveEventsForBundles).mockRejectedValue(new Error("katalog event terkunci"));

    const r = await commitIngestBatch([item], { actor, limit: 10 });

    expect(r.summary.processed).toBe(1);
    expect(r.summary.created).toBe(2);
    expect(r.eventsTagged).toBe(0);
    expect(r.unknownEvents).toEqual([]);
    expect(r.eventsError).toBe("Penandaan event gagal; soal sudah tersimpan.");
  });
});
