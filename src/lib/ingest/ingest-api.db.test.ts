import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import postgres from "postgres";
import type { Actor } from "@/lib/auth/actor";

/**
 * Tes ALUR API ingest (M9-3) — memanggil ROUTE HANDLER langsung (`wrapRoute`).
 *
 * Menguji: upload → antrean, lihat antrean, commit → soal draft, izin, validasi.
 * Aktor di-mock lewat `resolveActor`.
 */

const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error("TEST_DATABASE_URL wajib untuk tes integrasi (DB uji).");
const sql = postgres(url, { max: 4 });

let mockActor: Actor | null = { id: "ing-machine", name: "Mesin", roles: ["machine"], via: "apikey" };

vi.mock("@/lib/auth/resolve", () => ({
  resolveActor: async () => mockActor,
}));

const { POST: uploadPOST } = await import("@/app/api/v1/ingest/upload/route");
const { GET: queueGET } = await import("@/app/api/v1/ingest/queue/route");
const { POST: commitPOST } = await import("@/app/api/v1/ingest/commit/route");

function req(method: string, path: string, body?: unknown): Request {
  return new Request(`http://localhost:3000${path}`, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function cleanAll() {
  // ADR-0014: bundle_items.question_id = RESTRICT -> harus dihapus lebih dulu.
  await sql`DELETE FROM bundle_items`;
  await sql`DELETE FROM bundles WHERE bundle_type = 'source'`;
  await sql`DELETE FROM question_options`;
  await sql`UPDATE questions SET parent_id = NULL`;
  await sql`DELETE FROM questions`;
  await sql`DELETE FROM ingest_queue`;
  await sql`DELETE FROM sources WHERE slug = 'uji-api'`;
  await sql`ALTER TABLE audit_logs DISABLE TRIGGER trg_audit_logs_immutable`;
  await sql`DELETE FROM audit_logs`;
  await sql`ALTER TABLE audit_logs ENABLE TRIGGER trg_audit_logs_immutable`;
}

beforeAll(async () => {
  await sql`SELECT 1`;
});
beforeEach(cleanAll);
afterAll(async () => {
  await cleanAll();
  await sql.end();
});

/** HTML mathcyber mini (1 soal + kunci). */
const MATHCYBER_HTML = `
<h2><span>Soal Nomor 1</span></h2>
<p>Hasil dari $1+1$ adalah ....</p>
<ol style="list-style-type: upper-alpha"><li>$1$</li><li>$2$</li><li>$3$</li></ol>
<div class="sp-wrap"><div class="sp-body">Jadi $2$. (Jawaban B)</div></div>`;

describe("alur API ingest", () => {
  it("upload → 201 {data}; baris pending", async () => {
    const res = await uploadPOST(
      req("POST", "/api/v1/ingest/upload", {
        title: "Uji API", source: "uji-api", url: "https://x.test/a",
        rawContent: MATHCYBER_HTML, format: "html",
      }),
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.status).toBe("pending");
    expect(json.data.deduped).toBe(false);
    const rows = await sql`SELECT count(*)::int n FROM ingest_queue WHERE source_origin = 'uji-api'`;
    expect(rows[0].n).toBe(1);
  });

  it("upload ulang (isi sama) → deduped", async () => {
    const body = { title: "T", source: "uji-api", rawContent: MATHCYBER_HTML, format: "html" };
    const a = await (await uploadPOST(req("POST", "/api/v1/ingest/upload", body))).json();
    const b = await (await uploadPOST(req("POST", "/api/v1/ingest/upload", body))).json();
    expect(b.data.deduped).toBe(true);
    expect(b.data.id).toBe(a.data.id);
  });

  it("queue GET → daftar + counts (peran manusia)", async () => {
    await uploadPOST(req("POST", "/api/v1/ingest/upload", {
      title: "Q", source: "uji-api", rawContent: MATHCYBER_HTML, format: "html",
    }));
    // `machine` tak punya `question:view` → lihat antrean pakai peran manusia.
    mockActor = { id: "q-admin", name: "Admin", roles: ["admin"], via: "session" };
    const res = await queueGET(req("GET", "/api/v1/ingest/queue?status=pending"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.items.length).toBeGreaterThanOrEqual(1);
    expect(json.data.counts.pending).toBeGreaterThanOrEqual(1);
    mockActor = { id: "ing-machine", name: "Mesin", roles: ["machine"], via: "apikey" };
  });

  it("queue GET oleh machine → 403 (tanpa question:view)", async () => {
    const res = await queueGET(req("GET", "/api/v1/ingest/queue"));
    expect(res.status).toBe(403);
  });

  it("commit → soal DRAFT dibuat; antrean selesai", async () => {
    await uploadPOST(req("POST", "/api/v1/ingest/upload", {
      title: "C", source: "uji-api", rawContent: MATHCYBER_HTML, format: "html",
    }));
    const res = await commitPOST(req("POST", "/api/v1/ingest/commit", { limit: 10 }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.summary.processed).toBe(1);
    expect(json.data.summary.created).toBeGreaterThanOrEqual(1);

    const q = await sql`SELECT q.status FROM questions q
      JOIN bundle_items bi ON bi.question_id = q.id
      JOIN bundles b ON b.id = bi.bundle_id
      JOIN sources s ON s.id = b.source_id
      WHERE s.slug = 'uji-api'`;
    expect(q.every((r) => r.status === "draft")).toBe(true);
    const iq = await sql`SELECT status, imported_questions_count FROM ingest_queue WHERE source_origin='uji-api'`;
    expect(iq[0].status).toBe("completed");
    expect(iq[0].imported_questions_count).toBeGreaterThanOrEqual(1);
  });

  it("commit tanpa pending → processed 0", async () => {
    const res = await commitPOST(req("POST", "/api/v1/ingest/commit", { limit: 10 }));
    const json = await res.json();
    expect(json.data.summary.processed).toBe(0);
  });

  it("izin: peran tanpa question:create → 403", async () => {
    // `reviewer` punya question:create; pilih peran yang tak punya? Semua peran
    // kecuali machine punya. Uji sebaliknya: machine boleh (201), sudah di atas.
    // Di sini pastikan izin DIPERIKSA: aktor tanpa izin apa pun → 403.
    mockActor = { id: "noone", name: "Tanpa Peran", roles: [], via: "session" };
    const res = await uploadPOST(req("POST", "/api/v1/ingest/upload", {
      title: "X", source: "uji-api", rawContent: "<p>x</p>", format: "html",
    }));
    expect(res.status).toBe(403);
    mockActor = { id: "ing-machine", name: "Mesin", roles: ["machine"], via: "apikey" };
  });

  it("validasi: rawContent kosong → 400", async () => {
    const res = await uploadPOST(req("POST", "/api/v1/ingest/upload", {
      title: "Y", source: "uji-api", rawContent: "", format: "html",
    }));
    expect(res.status).toBe(400);
  });

  it("tanpa aktor → 401", async () => {
    mockActor = null;
    const res = await uploadPOST(req("POST", "/api/v1/ingest/upload", {
      title: "Z", source: "uji-api", rawContent: "<p>z</p>", format: "html",
    }));
    expect(res.status).toBe(401);
    mockActor = { id: "ing-machine", name: "Mesin", roles: ["machine"], via: "apikey" };
  });
});
