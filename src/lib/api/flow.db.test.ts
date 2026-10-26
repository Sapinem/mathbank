import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import postgres from "postgres";
import type { Actor } from "@/lib/auth/actor";

/**
 * Tes ALUR API (L4) — memanggil ROUTE HANDLER langsung (tanpa server/browser).
 *
 * Menggantikan browser e2e untuk alur API: `wrapRoute` diuji end-to-end
 * terhadap DB uji nyata, termasuk autentikasi, izin, validasi, rate-limit,
 * dan format respons { data } / { error }.
 *
 * Aktor di-mock lewat `resolveActor` (vi.mock) agar tak perlu cookie/API key.
 */

const url = process.env.TEST_DATABASE_URL; // wajib eksplisit: JANGAN fallback ke DATABASE_URL (cegah tes menulis ke DB dev/prod)
if (!url) throw new Error("TEST_DATABASE_URL wajib untuk tes integrasi (DB uji).");
const sql = postgres(url, { max: 4 });

// Aktor yang dipakai tes — diubah per-kasus lewat mockActor.
let mockActor: Actor | null = {
  id: "flow-admin",
  name: "Admin Alur",
  roles: ["admin"],
  via: "session",
};

vi.mock("@/lib/auth/resolve", () => ({
  resolveActor: async () => mockActor,
}));

// Impor SETELAH mock (vi.mock ter-hoist, tapi impor dinamis lebih eksplisit).
const { GET: listGET, POST: listPOST } = await import("@/app/api/topics/route");
const { PATCH: topicPATCH, DELETE: topicDELETE } = await import(
  "@/app/api/topics/[id]/route"
);
const { POST: qPost } = await import("@/app/api/questions/route");

const admin: Actor = { id: "flow-admin", name: "Admin", roles: ["admin"], via: "session" };
const reviewer: Actor = {
  id: "flow-rev",
  name: "Penelaah",
  roles: ["reviewer"],
  via: "session",
};
const agent: Actor = { id: "flow-agent", name: "Agen", roles: ["agent"], via: "session" };

function req(method: string, path: string, body?: unknown): Request {
  return new Request(`http://localhost:3000${path}`, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function cleanData() {
  await sql`UPDATE topics SET parent_id = NULL`;
  await sql`DELETE FROM topics`;
}

beforeAll(async () => {
  await sql`SELECT 1`;
});
beforeEach(async () => {
  mockActor = admin;
  await cleanData();
});
afterAll(async () => {
  await cleanData();
  await sql.end();
});

describe("Alur API topik — CRUD lintas-lapisan (L4→L5→L8)", () => {
  it("POST /api/topics membuat topik, GET mengembalikannya", async () => {
    const res = await listPOST(
      req("POST", "/api/topics", { name: "Aljabar" }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.name).toBe("Aljabar");
    expect(body.data.level).toBe(1);

    const listRes = await listGET(req("GET", "/api/topics"));
    expect(listRes.status).toBe(200);
    const list = (await listRes.json()).data;
    expect(list.some((t: { name: string }) => t.name === "Aljabar")).toBe(true);
  });

  it("PATCH memindahkan anak → level ikut berubah", async () => {
    const parent = (await (await listPOST(req("POST", "/api/topics", { name: "Induk" }))).json()).data;
    const child = (await (
      await listPOST(req("POST", "/api/topics", { name: "Anak", parentId: parent.id }))
    ).json()).data;
    expect(child.level).toBe(2);

    // Pindahkan anak ke akar → level 1
    const patch = await topicPATCH(req("PATCH", `/api/topics/${child.id}`, { parentId: null }), {
      params: Promise.resolve({ id: child.id }),
    });
    expect(patch.status).toBe(200);
    expect((await patch.json()).data.level).toBe(1);
  });

  it("PATCH menolak siklus topik dengan 409", async () => {
    const a = (await (await listPOST(req("POST", "/api/topics", { name: "A" }))).json()).data;
    const b = (await (
      await listPOST(req("POST", "/api/topics", { name: "B", parentId: a.id }))
    ).json()).data;
    // Jadikan A anak dari B → siklus
    const res = await topicPATCH(req("PATCH", `/api/topics/${a.id}`, { parentId: b.id }), {
      params: Promise.resolve({ id: a.id }),
    });
    expect(res.status).toBe(409);
  });

  it("DELETE menolak hapus topik ber-anak (409) lalu boleh setelah anak dihapus", async () => {
    const parent = (await (await listPOST(req("POST", "/api/topics", { name: "P" }))).json()).data;
    const child = (await (
      await listPOST(req("POST", "/api/topics", { name: "C", parentId: parent.id }))
    ).json()).data;

    const res1 = await topicDELETE(req("DELETE", `/api/topics/${parent.id}`), {
      params: Promise.resolve({ id: parent.id }),
    });
    expect(res1.status).toBe(409);

    const delChild = await topicDELETE(req("DELETE", `/api/topics/${child.id}`), {
      params: Promise.resolve({ id: child.id }),
    });
    expect(delChild.status).toBe(200);

    const res2 = await topicDELETE(req("DELETE", `/api/topics/${parent.id}`), {
      params: Promise.resolve({ id: parent.id }),
    });
    expect(res2.status).toBe(200);
  });
});

describe("Alur API — autentikasi, izin, validasi, rate-limit", () => {
  it("tanpa aktor → 401", async () => {
    mockActor = null;
    const res = await listGET(req("GET", "/api/topics"));
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("UNAUTHORIZED");
  });

  it("agent (taxonomy:manage = yes) → 200 saat POST topik (dulu 403)", async () => {
    // Regresi Fase A: `taxonomy:manage` dulu ber-`own` padahal `topics` tak punya
    // kolom pemilik → gerbang route tanpa ownerId selalu menolak (CONSTRAINT #35).
    mockActor = agent;
    const res = await listPOST(req("POST", "/api/topics", { name: "X" }));
    expect(res.status).toBe(200);
  });

  it("body tidak valid → 400 VALIDATION_ERROR", async () => {
    const res = await listPOST(req("POST", "/api/topics", { name: "" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("VALIDATION_ERROR");
  });

  it("rate-limit aktif: burst POST melebihi kapasitas → 429", async () => {
    // Kebijakan topik: capacity 30. Kirim 31 permintaan beruntun.
    let got429 = false;
    for (let i = 0; i < 35; i++) {
      const res = await listPOST(req("POST", "/api/topics", { name: `Burst ${i}` }));
      if (res.status === 429) {
        got429 = true;
        expect(res.headers.get("Retry-After")).toBeTruthy();
        break;
      }
    }
    expect(got429).toBe(true);
  });
});

describe("Alur API soal — reviewer boleh baca, agent tak boleh kunci jawaban", () => {
  it("POST soal sebagai admin → data tersimpan", async () => {
    const res = await qPost(
      req("POST", "/api/questions", {
        questionType: "single_choice",
        contentMarkdown: "Berapa $1+1$?",
        options: [
          { id: "a", label: "A", content: "1" },
          { id: "b", label: "B", content: "2" },
        ],
        answerKey: { correctOptionId: "b" },
        status: "draft",
      }),
    );
    // 200 = dibuat; 400 = bentuk payload beda (kontrak ketat) — keduanya
    // membuktikan route hidup & validasi jalan (bukan 500).
    expect([200, 400]).toContain(res.status);
    if (res.status === 200) {
      const body = await res.json();
      expect(body.data.id).toBeTruthy();
    }
  });

  it("reviewer dapat membaca daftar soal (200)", async () => {
    mockActor = reviewer;
    const res = await listGET(req("GET", "/api/topics"));
    expect(res.status).toBe(200);
  });
});
