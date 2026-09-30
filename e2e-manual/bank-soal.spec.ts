import { test, expect } from "@playwright/test";

/**
 * E2E — Halaman Bank Soal (M4b).
 * Daftar soal, KaTeX ter-render, filter via URL, pencarian.
 */
test.describe("Bank Soal", () => {
  async function cardCount(page: import("@playwright/test").Page) {
    return page.locator('a[href^="/questions/"]:not([href="/questions/new"])').count();
  }

  test("menampilkan daftar soal dari API", async ({ page }) => {
    await page.goto("/questions");
    // Minimal ada beberapa kartu soal (muncul setelah fetch klien selesai)
    const cards = page.locator('a[href^="/questions/"]:not([href="/questions/new"])');
    await expect(cards.first()).toBeVisible({ timeout: 10_000 });
    expect(await cards.count()).toBeGreaterThan(0);
  });

  test("rumus KaTeX ter-render (bukan $ mentah)", async ({ page }) => {
    await page.goto("/questions");
    // KaTeX menyuntik elemen .katex
    await expect(page.locator(".katex").first()).toBeVisible();
    // Tidak ada pembatas $...$ yang lolos mentah di daftar
    const text = await page.locator("main").innerText();
    expect(text).not.toMatch(/\$\$/);
  });

  test("filter Status mengubah URL & jumlah soal", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "mobile", "filter desktop = panel; mobile = sheet");
    await page.goto("/questions");
    await page.locator('a[href^="/questions/"]:not([href="/questions/new"])').first().waitFor();
    const before = await cardCount(page);

    // Pilih filter Status = Perlu Telaah (value "review")
    const statusSelect = page.locator("aside").getByRole("combobox").first();
    await statusSelect.click();
    await page.getByRole("option", { name: "Perlu Telaah" }).click();

    await expect(page).toHaveURL(/status=review/);
    await page.waitForTimeout(500);
    // Jumlah setelah filter ≤ sebelum
    const after = await cardCount(page);
    expect(after).toBeLessThanOrEqual(before);
  });

  test("pencarian memperbarui query ?q=", async ({ page }) => {
    await page.goto("/questions");
    await page.getByPlaceholder("Cari soal…").fill("persamaan");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/q=persamaan/);
  });

  test("mobile: tombol filter membuka Sheet", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "khusus mobile");
    await page.goto("/questions");
    await page.getByRole("button", { name: "Buka filter" }).click();
    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText("Terapkan")).toBeVisible();
  });
});
