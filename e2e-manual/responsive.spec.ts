import { test, expect } from "@playwright/test";

/**
 * E2E — Responsif (RENCANA-UI-MOBILE.md).
 *
 * Komponen `sidebar` resmi shadcn memakai breakpoint `md` (768px):
 * - ≥ 768px: sidebar tampil (bisa mengecil ke ikon via SidebarTrigger/⌘B).
 * - < 768px: sidebar jadi drawer (terbuka dari tombol SidebarTrigger).
 *
 * Proyek `desktop` (1280px) & `mobile` (Pixel 5 ~393px) menjalankan berkas ini
 * dengan perilaku berbeda — karena itu pakai `isMobile`.
 */
test.describe("Shell responsif", () => {
  test("pemicu sidebar tampil di kedua ukuran", async ({ page }) => {
    await page.goto("/");
    // Ada 2 pemicu (satu di sidebar, satu di header) — minimal 1 terlihat.
    const triggers = page.getByRole("button", { name: "Buka/tutup sidebar" });
    expect(await triggers.count()).toBeGreaterThanOrEqual(1);
    await expect(triggers.first()).toBeVisible();
  });

  test("sidebar: tampil di desktop, drawer di mobile", async ({ page }, testInfo) => {
    const isMobile = testInfo.project.name === "mobile";
    await page.goto("/");

    if (isMobile) {
      // Tak ada sidebar tetap.
      await expect(page.locator('[data-slot="sidebar"]').first()).toBeHidden();
      // Klik pemicu → drawer (dialog) terbuka berisi nav.
      await page.getByRole("button", { name: "Buka/tutup sidebar" }).first().click();
      const drawer = page.getByRole("dialog");
      await expect(drawer).toBeVisible();
      await expect(drawer.getByRole("link", { name: "Bank Soal" })).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(drawer).toBeHidden();
    } else {
      // Desktop: sidebar tetap dengan navigasi.
      const sidebar = page.locator('[data-slot="sidebar"]').first();
      await expect(sidebar).toBeVisible();
      await expect(page.getByRole("link", { name: "Bank Soal" }).first()).toBeVisible();
    }
  });

  test("tidak ada gulir horizontal di beranda & bank soal", async ({ page }) => {
    for (const path of ["/", "/questions"]) {
      await page.goto(path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1,
      );
      expect(overflow, `overflow-x di ${path}`).toBe(false);
    }
  });
});
