import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import postgres from "postgres";
import type { Actor } from "@/lib/auth/actor";

/**
 * Tes ALUR API paket (L4) — route handler dipanggil langsung, tanpa browser.
 * Melengkapi tes service: memverifikasi pagar izin & format respons.
 */
const url = process.env.TEST_DATABASE_URL; // wajib eksplisit: JANGAN fallback ke DATABASE_URL (cegah tes menulis ke DB dev/prod)
if (!url) throw new Error("TEST_DATABASE_URL wajib untuk tes integrasi (DB uji).");
const sql = postgres(url, { max: 4 });

let mockActor: Actor | null = {
  id: "api-admin",
  name: "Admin",
  roles: ["admin"],
  via: "session",
};
vi.mock("@/lib/auth/resolve", () => ({
  resolveActor: async () => mockActor,
}));

const { GET: listGET, POST: listPOST } = await import("@/app/api/bundles/route");
const { GET: oneGET, PATCH: onePATCH, DELETE: oneDELETE } = await import(
  "@/app/api/bundles/[id]/route"
);
const { POST: itemsPOST, PUT: itemsPUT } = await import(
  "@/app/api/bundles/[id]/items/route"
);
const { GET: validateGET } = await import("@/app/api/bundles/[id]/validate/route");
const { POST: dupPOST } = await import("@/app/api/bundles/[id]/duplicate/route");
const { createQuestion } = await import("@/lib/services/question-service");

const admin: Actor = { id: "api-admin", name: "Admin", roles: ["admin"], via: "session" };
const agent: Actor = { id: "api-agent", name: "Agen", roles: ["agent"], via: "session" };

/**
 * ADR-0030: setiap mutasi baris WAJIB membawa `If-Match`. Baris yang baru
 * di-seed selalu ber-versi 1; uji yang mengubah dua kali memberi versinya sendiri
 * lewat argumen `headers`.
 */
function req(
  method: string,
  path: string,
  body?: unknown,
  headers: Record<string, string> = {},
): Request {
  const base: Record<string, string> = { "if-match": '"1"' };
  if (body) base["content-type"] = "application/json";
  return new Request(`http://localhost:3000${path}`, {
    method,
    headers: { ...base, ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
}
function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

async function mkQuestion(tag = "") {
  return createQuestion(
    {
      questionType: "single_choice",
      difficulty: 3,
      cognitiveLevel: "remember",
      grade: "g1",
      // ADR-0012: konten identik = soal yang SAMA (unique `content_hash`).
      // Beri tag agar tiap pemanggilan menghasilkan soal berbeda.
      contentMarkdown: `Soal $1+1$?${tag ? ` (${tag})` : ""}`,
      dataPayload: {},
      answerKey: { correct: ["B"] },
      status: "draft",
      childOrder: 0,
      options: [
        { label: "A", contentMarkdown: "1", isCorrect: false, orderIndex: 0 },
        { label: "B", contentMarkdown: "2", isCorrect: true, orderIndex: 1 },
      ],
      topicIds: [],
      tagIds: [],
    },
    admin,
  );
}

async function clean() {
  await sql`DELETE FROM bundle_items`;
  await sql`DELETE FROM bundles`;
  await sql`DELETE FROM questions`;
}

beforeAll(async () => {
  await sql`SELECT 1`;
});
beforeEach(async () => {
  mockActor = admin;
  await clean();
});
afterAll(async () => {
  await clean();
  await sql.end();
});

describe("Alur API paket (L4)", () => {
  it("POST /api/bundles → buat; GET → tampil di daftar", async () => {
    const res = await listPOST(req("POST", "/api/bundles", { title: "Paket API", bundleType: "exam" }));
    expect(res.status).toBe(200);
    const b = (await res.json()).data;
    expect(b.title).toBe("Paket API");

    const list = (await (await listGET(req("GET", "/api/bundles"))).json()).data;
    expect(list.items.some((x: { id: string }) => x.id === b.id)).toBe(true);
    // API-05: amplop paginasi menyertakan `total`.
    expect(list.total).toBeGreaterThanOrEqual(1);
  });

  it("alur lengkap: buat → tambah soal → GET detail berisi item → validasi → duplikat", async () => {
    const b = (await (
      await listPOST(req("POST", "/api/bundles", { title: "Alur", bundleType: "exam" }))
    ).json()).data;
    const q = await mkQuestion();

    const addRes = await itemsPOST(
      req("POST", `/api/bundles/${b.id}/items`, { questionId: q.id }),
      ctx(b.id),
    );
    expect(addRes.status).toBe(200);

    const detail = (await (await oneGET(req("GET", `/api/bundles/${b.id}`), ctx(b.id))).json()).data;
    expect(detail.items.length).toBe(1);
    expect(detail.itemCount).toBe(1);

    const val = (await (
      await validateGET(req("GET", `/api/bundles/${b.id}/validate`), ctx(b.id))
    ).json()).data;
    expect(val.itemCount).toBe(1);
    expect(val.valid).toBe(true);

    const dup = await dupPOST(req("POST", `/api/bundles/${b.id}/duplicate`), ctx(b.id));
    expect(dup.status).toBe(200);
    expect((await dup.json()).data.itemCount).toBe(1);
  });

  it("PATCH mengubah status & DELETE mengarsipkan (tak tampil lagi)", async () => {
    const b = (await (
      await listPOST(req("POST", "/api/bundles", { title: "Arsip API", bundleType: "exam" }))
    ).json()).data;
    const patch = await onePATCH(req("PATCH", `/api/bundles/${b.id}`, { status: "ready" }), ctx(b.id));
    expect(patch.status).toBe(200);
    const patched = (await patch.json()).data;
    expect(patched.status).toBe("ready");
    // ADR-0030: PATCH menaikkan versi → DELETE wajib memakai versi BARU.
    const del = await oneDELETE(
      req("DELETE", `/api/bundles/${b.id}`, undefined, { "if-match": `"${patched.version}"` }),
      ctx(b.id),
    );
    expect(del.status).toBe(200);
    const list = (await (await listGET(req("GET", "/api/bundles"))).json()).data;
    expect(list.items.find((x: { id: string }) => x.id === b.id)).toBeUndefined();
  });

  it("PUT items menyusun ulang urutan", async () => {
    const b = (await (
      await listPOST(req("POST", "/api/bundles", { title: "Urut API", bundleType: "exam" }))
    ).json()).data;
    const q1 = await mkQuestion("q1");
    const q2 = await mkQuestion("q2");
    // Alur klien yang benar (ADR-0030): baca ETag dulu, kirim balik sebagai
    // If-Match. Setiap penambahan item menaikkan versi paket.
    const versionNow = async () =>
      (await (await oneGET(req("GET", `/api/bundles/${b.id}`), ctx(b.id))).json()).data
        .version as number;

    const i1 = (await (
      await itemsPOST(
        req("POST", `/api/bundles/${b.id}/items`, { questionId: q1.id }, {
          "if-match": `"${await versionNow()}"`,
        }),
        ctx(b.id),
      )
    ).json()).data;
    const i2 = (await (
      await itemsPOST(
        req("POST", `/api/bundles/${b.id}/items`, { questionId: q2.id }, {
          "if-match": `"${await versionNow()}"`,
        }),
        ctx(b.id),
      )
    ).json()).data;

    const res = await itemsPUT(
      req("PUT", `/api/bundles/${b.id}/items`, { itemIds: [i2.id, i1.id] }, {
        "if-match": `"${await versionNow()}"`,
      }),
      ctx(b.id),
    );
    expect(res.status).toBe(200);
    const detail = (await (await oneGET(req("GET", `/api/bundles/${b.id}`), ctx(b.id))).json()).data;
    expect(detail.items.map((i: { item: { id: string } }) => i.item.id)).toEqual([i2.id, i1.id]);
  });
});

describe("Alur API paket — pagar izin & validasi", () => {
  it("tanpa aktor → 401", async () => {
    mockActor = null;
    expect((await listGET(req("GET", "/api/bundles"))).status).toBe(401);
  });

  it("agent (tanpa bundle:manage) → 403 saat POST", async () => {
    mockActor = agent;
    const res = await listPOST(req("POST", "/api/bundles", { title: "X", bundleType: "exam" }));
    expect(res.status).toBe(403);
  });

  it("body tidak valid → 400 VALIDATION_ERROR", async () => {
    const res = await listPOST(req("POST", "/api/bundles", { title: "", bundleType: "exam" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("VALIDATION_ERROR");
  });

  it("GET paket tak ada → 404", async () => {
    const res = await oneGET(
      req("GET", "/api/bundles/00000000-0000-7000-8000-000000000000"),
      ctx("00000000-0000-7000-8000-000000000000"),
    );
    expect(res.status).toBe(404);
  });
});
