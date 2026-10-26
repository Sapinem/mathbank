/**
 * Alias deprecation — uji murni, tanpa DB.
 *
 * Yang dijaga: alias **tidak boleh** mengubah perilaku handler kanonik. Ia hanya
 * menambahkan tiga header; status, body, dan header lain harus lolos apa adanya.
 */
import { describe, expect, it } from "vitest";
import { INGEST_CANONICAL, INGEST_V1_SUNSET, ingestV1Alias } from "./deprecation";

const canonical = async (): Promise<Response> =>
  new Response(JSON.stringify({ data: { ok: true } }), {
    status: 201,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

describe("ingestV1Alias", () => {
  it("meneruskan status, body, dan header kanonik", async () => {
    const res = await ingestV1Alias(canonical)(new Request("http://x/api/v1/ingest/upload"));
    expect(res.status).toBe(201);
    expect(res.headers.get("content-type")).toBe("application/json");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ data: { ok: true } });
  });

  it("menambahkan Deprecation, Sunset, dan Link ke pengganti", async () => {
    const res = await ingestV1Alias(canonical)(new Request("http://x/api/v1/ingest/upload"));
    expect(res.headers.get("Deprecation")).toBe("true");
    expect(res.headers.get("Sunset")).toBe(INGEST_V1_SUNSET);
    expect(res.headers.get("Link")).toBe(`<${INGEST_CANONICAL}>; rel="successor-version"`);
  });

  it("meneruskan argumen kedua (params) ke handler kanonik", async () => {
    const seen: unknown[] = [];
    const handler = async (_req: Request, args?: unknown) => {
      seen.push(args);
      return new Response(null, { status: 204 });
    };
    const params = { params: Promise.resolve({ id: "abc" }) };
    await ingestV1Alias(handler)(new Request("http://x/api/v1/ingest/queue"), params);
    expect(seen[0]).toBe(params);
  });

  it("tanggal Sunset jatuh tepat 90 hari setelah 2026-10-27", () => {
    const sunset = Date.parse(INGEST_V1_SUNSET);
    const decided = Date.parse("2026-10-27T00:00:00Z");
    expect(sunset - decided).toBe(90 * 24 * 60 * 60 * 1000);
  });
});
