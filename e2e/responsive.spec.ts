import { test, expect } from "@playwright/test";

/**
 * E2E — Responsif (RENCANA-UI-MOBILE.md).
 *
 * Menguji asas "kelola di desktop, lihat di mobile" pada breakpoint `lg` (1024px).
 * Proyek `desktop` (1280px) & `mobile` (Pixel 5 ~393px) menjalankan berkas ini
 * dengan perilaku yang sama sekali berbeda — karena itu pakai `isMobile`.
 */
test.describe("Shell responsif", () => {
  test("sidebar: tetap di desktop, tersembunyi di mobile", async ({ page }, testInfo) => {
    const isMobile = testInfo.project.name === "mobile";
    await page.goto("/");
    const aside = page.locator("aside").first();
    if (isMobile) {
      await expect(aside).toBeHidden();
    } else {
      await expect(aside).toBeVisible();
    }
  });

  test("tombol ☰ ada & tampil hanya di mobile", async ({ page }, testInfo) => {
    const isMobile = testInfo.project.name === "mobile";
    await page.goto("/");
    // Pakai locator CSS (bukan getByRole): di desktop tombol `lg:hidden`
    // sehingga tidak ada di accessibility tree — getByRole tak menemukannya.
    const ham = page.locator('button[aria-label="Buka menu"]');
    await expect(ham).toHaveCount(1);
    if (isMobile) {
      await expect(ham).toBeVisible();
      // Klik → drawer terbuka, berisi tautan navigasi
      await ham.click();
      const drawer = page.getByRole("dialog");
      await expect(drawer).toBeVisible();
      await expect(drawer.getByText("Dasbor")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(drawer).toBeHidden();
    } else {
      await expect(ham).toBeHidden();
    }
  });

  test("tidak ada gulir horizontal di beranda & bank soal", async ({ page }) => {
    for (const path of ["/", "/bank-soal"]) {
      await page.goto(path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1,
      );
      expect(overflow, `overflow-x di ${path}`).toBe(false);
    }
  });
});
