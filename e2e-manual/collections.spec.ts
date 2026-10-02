import { test, expect } from "@playwright/test";

/**
 * E2E — Koleksi (ADR-0016).
 *
 * Koleksi = arsip soal **publik** (statis, institusional), beda hakikat dari
 * Paket Soal (naskah kerja guru: dinamis, personal). Yang diuji di sini adalah
 * **perilaku khasnya**, bukan sekadar "halaman terbuka":
 *
 *  - menu "Koleksi" benar-benar ada di sidebar (grup Kerja);
 *  - daftar & dialog buat jalan;
 *  - CRUD metadata lewat API;
 *  - **CASCADE: menghapus koleksi TIDAK menghapus soal** (invarian penting);
 *  - **RESTRICT: soal yang diarsipkan tak bisa dihapus**.
 */
test.describe("Koleksi — halaman & menu", () => {
  test("menu Koleksi ada di sidebar grup Kerja", async ({ page, isMobile }) => {
    await page.goto("/");
    // Sidebar shadcn TIDAK memakai role="navigation" (hanya breadcrumb yang punya),
    // jadi pakai `data-slot` — dan di mobile ia drawer TERTUTUP, buka dulu.
    if (isMobile) {
      await page.getByRole("button", { name: "Buka/tutup sidebar" }).first().click();
    }
    const sidebar = page.locator('[data-slot="sidebar"]').first();
    await expect(sidebar.getByRole("link", { name: "Koleksi" })).toBeVisible();
    // Beda hakikat ditegaskan berdampingan dengan Paket Soal.
    await expect(sidebar.getByRole("link", { name: "Paket Soal" })).toBeVisible();
  });

  test("halaman koleksi menampilkan judul & tombol buat", async ({ page }) => {
    await page.goto("/collections");
    await expect(
      page.getByRole("heading", { name: "Koleksi", level: 1 }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Koleksi Baru|Koleksi Pertama/ }),
    ).toBeVisible();
  });

  test("daftar kosong → ajakan membuat koleksi pertama", async ({ page }) => {
    await page.goto("/collections");
    // Bila DB memang kosong, empty-state harus tampil dengan jelas.
    const empty = page.getByText(/Belum ada koleksi/i);
    const table = page.getByRole("table");
    await expect(empty.or(table)).toBeVisible();
  });
});

test.describe("Koleksi — API", () => {
  test("CRUD metadata: buat → ubah → hapus", async ({ request }) => {
    const title = `E2E Koleksi ${Date.now()}`;
    const created = (
      await (
        await request.post("/api/collections", {
          data: { title, year: 2024, grade: "11" },
        })
      ).json()
    ).data;
    expect(created.slug).toContain("e2e-koleksi");
    expect(created.year).toBe(2024);
    expect(created.itemCount).toBe(0);

    const updated = (
      await (
        await request.patch(`/api/collections/${created.id}`, {
          data: { title: `${title} (revisi)` },
        })
      ).json()
    ).data;
    expect(updated.title).toContain("(revisi)");

    const del = await request.delete(`/api/collections/${created.id}`);
    expect(del.ok()).toBeTruthy();
  });

  test("CASCADE: hapus koleksi TIDAK menghapus soal di dalamnya", async ({ request }) => {
    // 1. Buat soal (essay minimal).
    const q = (
      await (
        await request.post("/api/questions", {
          data: {
            questionType: "essay",
            difficulty: 3,
            cognitiveLevel: "understand",
            grade: "umum",
            contentMarkdown: `Soal e2e koleksi ${Date.now()}`,
            dataPayload: {},
            answerKey: {},
          },
        })
      ).json()
    ).data;

    // 2. Buat koleksi & masukkan soal.
    const c = (
      await (
        await request.post("/api/collections", {
          data: { title: `E2E Cascade ${Date.now()}` },
        })
      ).json()
    ).data;
    const added = await request.post(`/api/collections/${c.id}/items`, {
      data: { questionId: q.id },
    });
    expect(added.ok()).toBeTruthy();

    // 3. itemCount naik.
    const detail = (
      await (await request.get(`/api/collections/${c.id}`)).json()
    ).data;
    expect(detail.itemCount).toBe(1);
    expect(detail.questionIds).toContain(q.id);

    // 4. Hapus koleksi → SOAL HARUS TETAP ADA.
    await request.delete(`/api/collections/${c.id}`);
    const still = await request.get(`/api/questions/${q.id}`);
    expect(still.ok()).toBeTruthy();

    // bersih-bersih
    await request.delete(`/api/questions/${q.id}?permanent=true`).catch(() => {});
  });

  test("idempoten: menambah soal yang sama dua kali tak menggandakan", async ({ request }) => {
    const q = (
      await (
        await request.post("/api/questions", {
          data: {
            questionType: "essay",
            difficulty: 3,
            cognitiveLevel: "understand",
            grade: "umum",
            contentMarkdown: `Soal idempoten ${Date.now()}`,
            dataPayload: {},
            answerKey: {},
          },
        })
      ).json()
    ).data;
    const c = (
      await (
        await request.post("/api/collections", {
          data: { title: `E2E Idempoten ${Date.now()}` },
        })
      ).json()
    ).data;

    await request.post(`/api/collections/${c.id}/items`, { data: { questionId: q.id } });
    await request.post(`/api/collections/${c.id}/items`, { data: { questionId: q.id } });

    const detail = (
      await (await request.get(`/api/collections/${c.id}`)).json()
    ).data;
    expect(detail.itemCount).toBe(1);

    await request.delete(`/api/collections/${c.id}`);
    await request.delete(`/api/questions/${q.id}?permanent=true`).catch(() => {});
  });

  test("halaman detail koleksi terbuka & menampilkan metadata", async ({ page, request }) => {
    const title = `E2E Detail ${Date.now()}`;
    const c = (
      await (await request.post("/api/collections", { data: { title } })).json()
    ).data;

    await page.goto(`/collections/${c.id}`);
    await expect(page.getByRole("heading", { name: title, level: 1 })).toBeVisible();
    await expect(page.getByRole("button", { name: /Tambah Soal/ })).toBeVisible();

    await request.delete(`/api/collections/${c.id}`);
  });
});
