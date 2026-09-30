import { test, expect } from "@playwright/test";

/**
 * E2E — Telaah & Pengaturan (M4d).
 * Telaah: tab perlu-telaah/ditandai. Pengaturan: bagian umum tersimpan.
 */
test.describe("Telaah (M4d)", () => {
  test("menampilkan dua tab: Perlu Telaah & Ditandai", async ({ page }) => {
    await page.goto("/review");
    await expect(page.getByRole("tab", { name: "Perlu Telaah" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Ditandai" })).toBeVisible();
  });

  test("tab Ditandai dapat dibuka", async ({ page }) => {
    await page.goto("/review");
    await page.getByRole("tab", { name: "Ditandai" }).click();
    await expect(page.getByRole("tabpanel", { name: "Ditandai" })).toBeVisible();
  });
});

test.describe("Pengaturan (M4d)", () => {
  test("bagian Umum tampil dengan field yang bisa diisi", async ({ page }) => {
    await page.goto("/system/settings");
    await expect(page.getByRole("heading", { name: "Pengaturan" })).toBeVisible();
    await expect(page.getByLabel("Nama Organisasi")).toBeVisible();
    await expect(page.getByRole("button", { name: "Simpan" })).toBeVisible();
  });

  test("simpan pengaturan umum menampilkan konfirmasi", async ({ page }) => {
    await page.goto("/system/settings");
    await page.getByLabel("Nama Organisasi").fill("Organisasi E2E");
    await page.getByRole("button", { name: "Simpan" }).click();
    await expect(page.getByText("Tersimpan")).toBeVisible({ timeout: 10_000 });
  });

  test("bagian AI ditandai menyusul M10", async ({ page }) => {
    await page.goto("/system/settings");
    await expect(page.getByText("Belum tersedia — M10")).toBeVisible();
  });
});
