import { test, expect } from "@playwright/test";

/**
 * E2E — Pencarian & Filter (M6).
 * Mode tampilan via URL; filter topik termasuk anak; pencarian trigram.
 */
test.describe("Bank Soal — mode tampilan (M6)", () => {
  test("beralih mode mengubah URL & tata letak", async ({ page, viewport }) => {
    test.skip((viewport?.width ?? 0) < 640, "toggle mode hanya tampil di ≥sm");
    await page.goto("/bank-soal");
    await expect(page.getByRole("button", { name: "Kisi" })).toBeVisible();

    await page.getByRole("button", { name: "Kisi" }).click();
    await expect(page).toHaveURL(/mode=grid/);

    await page.getByRole("button", { name: "Kolom (masonry)" }).click();
    await expect(page).toHaveURL(/mode=masonry/);
    const masonry = page.locator("div.columns-1");
    await expect(masonry).toBeVisible();
  });

  test("mode dari URL dipakai saat halaman dibuka", async ({ page }) => {
    await page.goto("/bank-soal?mode=grid");
    await expect(page.locator("div.grid.grid-cols-1")).toBeVisible();
  });
});

test.describe("Pencarian & filter — API (M6)", () => {
  test("pencarian toleran typo (trigram)", async ({ request }) => {
    // Ambil satu soal untuk mendapat kata yang pasti ada.
    const base = await (await request.get("/api/questions?limit=1")).json();
    const text: string = base.data.items[0]?.contentMarkdown ?? "";
    const word = text.replace(/[^A-Za-z]/g, " ").trim().split(/\s+/)[0] ?? "";
    test.skip(word.length < 5, "tak ada kata uji yang cukup panjang");

    // Potong 2 huruf terakhir → simulasi typo ringan.
    const typo = word.slice(0, word.length - 2);
    const res = await (await request.get(`/api/questions?q=${typo}&limit=5`)).json();
    expect(res.data.total).toBeGreaterThanOrEqual(1);
  });

  test("filter topik induk mencakup soal sub-topik", async ({ request }) => {
    const topics = (await (await request.get("/api/topics")).json()).data;
    const root = topics.find((t: { level: number }) => t.level === 1);
    test.skip(!root, "tak ada topik level 1");
    const res = await (
      await request.get(`/api/questions?topicId=${root.id}&limit=50`)
    ).json();
    // Induk Aljabar punya soal dari anak-anaknya.
    expect(res.data.total).toBeGreaterThanOrEqual(1);
  });
});
