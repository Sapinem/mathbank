import { test, expect } from "@playwright/test";

/**
 * E2E — Editor & Detail soal (M4c).
 * Alur CRUD: buat → simpan draf → detail → kirim telaah → hapus.
 *
 * Desktop-saja (editor pakai `DesktopOnly`); di mobile di-skip.
 */
test.describe("Bank Soal — Editor (M4c)", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name === "mobile", "editor desktop-saja");
  });

  test("rute /questions/new membuka editor", async ({ page }) => {
    await page.goto("/questions/new");
    await expect(page.getByRole("heading", { name: "Soal Baru" })).toBeVisible();
    await expect(page.getByLabel("Isi soal")).toBeVisible();
    await expect(page.getByLabel("Tipe soal")).toBeVisible();
  });

  test("tombol simpan terkunci sampai pertanyaan & kunci terisi", async ({
    page,
  }) => {
    await page.goto("/questions/new");
    const simpan = page.getByRole("button", { name: "Simpan Draf" });
    await expect(simpan).toBeDisabled();

    await page.getByLabel("Isi soal").fill("Berapa $1+1$?");
    await expect(simpan).toBeEnabled();
  });

  test("alur: buat → simpan → detail → kirim telaah → hapus", async ({
    page,
  }) => {
    const marker = `e2e-${Date.now()}`;
    const isi = `[${marker}] Hitung $2+2$.`;

    await page.goto("/questions/new");
    await page.getByLabel("Isi soal").fill(isi);
    await page.getByLabel("Isi opsi A").fill("$4$");
    await page.getByRole("button", { name: "Tandai opsi A sebagai kunci" }).click();

    // Simpan draf → harus pindah ke halaman detail
    await page.getByRole("button", { name: "Simpan Draf" }).click();
    await expect(page).toHaveURL(/\/questions\/[0-9a-f-]{36}$/, {
      timeout: 15_000,
    });
    await expect(page.getByRole("heading", { name: "Detail Soal" })).toBeVisible();
    await expect(page.getByText("Draf")).toBeVisible();
    await expect(page.getByText(marker, { exact: false })).toBeVisible();

    // FSM: draft → review
    await page.getByRole("button", { name: "Kirim Telaah" }).click();
    await expect(page.getByText("Perlu Telaah")).toBeVisible({ timeout: 10_000 });

    // Hapus (konfirmasi dialog)
    await page.getByRole("button", { name: "Hapus soal" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Hapus" }).click();
    await expect(page).toHaveURL(/\/questions$/, { timeout: 10_000 });
  });
});
