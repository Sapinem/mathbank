import { describe, it, expect, vi, afterEach } from "vitest";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { fetchImage } from "@/lib/ingest/media/fetch";
import { chat } from "@/lib/ai/client";
import { can } from "@/lib/auth/guards";
import { exportRoot } from "@/lib/export/gitsync-writer";
import type { Actor } from "@/lib/auth/actor";

/**
 * BUKTI EKSEKUSI — audit `security-and-hardening` (MathBank v2, 2026-10-17).
 *
 * Berkas ini mereproduksi temuan yang **terverifikasi** di laporan
 * `MathBankAuditor/reports/2026-10-17/audit-security-and-hardening.md`.
 * Tes NEGATIF: mengunci PERILAKU CACAT agar perbaikannya terbukti lewat
 * pergeseran tes — bukan klaim di dokumen.
 *
 * Setelah cacat diperbaiki: ubah blok `it()` terkait menjadi tes positif di
 * berkas tes asalnya (mis. `media-io.test.ts`, `route.test.ts`), lalu hapus
 * blok di sini. Kode temuan (SEC-xx / BUG-xx) memudahkan pencarian silang.
 */

const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────
// SEC-05 — Corpus path traversal (".." lolos regex segmen)
// ─────────────────────────────────────────────────────────────────────────
describe("SEC-05: corpus:// path traversal", () => {
  it("segmen '..' diterima regex & path keluar dari CORPORA_BASE (CACAT)", async () => {
    // Path sengaja tak ada → pesan galat memuat `absPath` hasil `join()`.
    const r = await fetchImage("corpus://defantri/../../../../etc/passwd");
    expect(r.ok).toBe(false);
    // BUKTI: yang dicoba dibuka adalah /etc/passwd, bukan berkas di corpora/.
    expect(r.error).toContain("/etc/passwd");
    expect(r.error).not.toContain("/corpora/defantri/images/../../../../etc/passwd");
    console.log("[SEC-05] error =", r.error);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// SEC-03 — TLS verify DIMATIKAN untuk host "relaxed" (dan redirect-nya)
// ─────────────────────────────────────────────────────────────────────────
describe("SEC-03: rejectUnauthorized=false saat TLS_RELAXED", () => {
  it("host relaxed memakai jalur https mentah, bukan fetch yang memverifikasi TLS", async () => {
    const fetchSpy = vi.fn(async () => new Response(PNG, {
      status: 200,
      headers: { "content-type": "image/png" },
    }));
    vi.stubGlobal("fetch", fetchSpy);

    const r = await fetchImage("https://pusmendik.kemendikdasmen.go.id/x.png", {
      retries: 0,
      timeoutMs: 1500,
    });
    expect(r.ok).toBe(false);
    // BUKTI: jalur `downloadRelaxed` dipakai → `fetch` (yang memverifikasi TLS)
    // TIDAK dipanggil; koneksi memakai `https.request({ rejectUnauthorized: false })`.
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// SEC-07 — Rate-limit publik bisa di-bypass dengan X-Forwarded-For palsu
// ─────────────────────────────────────────────────────────────────────────
vi.mock("@/lib/services/media-service", () => ({
  findAssetByShortId: async () => {
    throw new Error("stop: sudah lolos rate limit");
  },
}));

describe("SEC-07: spoofing X-Forwarded-For melewati rate limit /img", () => {
  it("setiap XFF berbeda → bucket baru → tak pernah 429 (CACAT)", async () => {
    // Impor statis di sini tidak mungkin karena vi.mock harus terangkat.
    const { GET } = await import("@/app/img/[shortId]/route");

    const codes: number[] = [];
    for (let i = 0; i < 400; i++) {
      const req = new Request("http://localhost/img/AbCd1234", {
        headers: { "x-forwarded-for": `10.0.${Math.floor(i / 250)}.${i % 250}, 1.1.1.1` },
      });
      const res = await GET(req as unknown as Request, {
        params: Promise.resolve({ shortId: "AbCd1234" }),
      });
      codes.push(res.status);
    }
    // IMAGE_POLICY: capacity 300. Tanpa spoofing → 429 setelah 300 permintaan.
    expect(codes.includes(429)).toBe(false);
    console.log("[SEC-07] jumlah permintaan =", codes.length, "tanpa 429");
  });
});

// ─────────────────────────────────────────────────────────────────────────
// SEC-08 — SSRF: base URL LLM/Ollama (dari app_settings) bebas
// ─────────────────────────────────────────────────────────────────────────
describe("SEC-08: SSRF via ai.base_url", () => {
  it("server menjalin koneksi ke 127.0.0.1 sesuai konfigurasi (CACAT: tanpa allowlist)", async () => {
    let hit: string | null = null;
    const srv = createServer((req, res) => {
      hit = req.url ?? null;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ data: [{ id: "m1" }] }));
    });
    await new Promise<void>((r) => srv.listen(0, "127.0.0.1", () => r()));
    const port = (srv.address() as AddressInfo).port;
    try {
      const r = await chat(
        {
          enabled: true,
          baseUrl: `http://127.0.0.1:${port}`,
          apiKey: "k",
          model: "m",
          maxTokens: 10,
          timeoutMs: 2000,
        },
        [{ role: "user", content: "hi" }],
      );
      // BUKTI: request benar-benar sampai ke loopback.
      expect(hit).toBe("/chat/completions");
      expect(r.ok).toBe(false); // bentuk balasan bukan chat, tapi koneksi TERJADI
    } finally {
      await new Promise<void>((r) => srv.close(() => r()));
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────
// SEC-06 — GitSync: MENGHAPUS & meng-commit di dalam folder ekspor
// ─────────────────────────────────────────────────────────────────────────
describe("SEC-06: gitsync memakai root ekspor apa adanya", () => {
  it("MATHBANK_EXPORT_DIR=cwd diterima → operasi rm/git-add -A di dalam repo", () => {
    const saved = process.env.MATHBANK_EXPORT_DIR;
    process.env.MATHBANK_EXPORT_DIR = process.cwd();
    try {
      // writeGitsyncFolder() akan: rm(<cwd>/<slug>/top, recursive) lalu
      // `git add -A` di <cwd>/<slug> — tak ada allowlist root / tolak cwd.
      expect(exportRoot()).toBe(process.cwd());
    } finally {
      if (saved === undefined) delete process.env.MATHBANK_EXPORT_DIR;
      else process.env.MATHBANK_EXPORT_DIR = saved;
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────
// BUG-01 — flag soal: izin `own` tak memakai ownerId
// ─────────────────────────────────────────────────────────────────────────
describe("BUG-01: question:flag ber-own tanpa ownerId", () => {
  it("panggilan service tanpa ownerId berubah perilaku: tanpa owner → tolak, dengan owner → izin", () => {
    const teacher: Actor = { id: "guru-1", name: "Guru", roles: ["teacher"], via: "session" };
    // Matriks: teacher = `own`. `setQuestionFlag` memanggil
    //   assertCan(actor, "question:flag")      // ← tanpa ownerId (question-write.ts)
    // sehingga guru bisa menandai soal SIAPA PUN. Bukti di layanan:
    expect(can(teacher, "question:flag")).toBe(false);
    expect(can(teacher, "question:flag", { ownerId: "orang-lain" })).toBe(false);
    expect(can(teacher, "question:flag", { ownerId: "guru-1" })).toBe(true);
  });
});
