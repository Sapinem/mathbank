import { test, expect } from "@playwright/test";

/**
 * E2E — Tema gelap/terang (L2, `theme-toggle.tsx`).
 *
 * Mengunci perilaku yang dilaporkan "belum bisa":
 * klik "Gelap" HARUS membuat <html class="dark">, latar jadi gelap,
 * dan pilihan tersimpan di localStorage (bertahan setelah reload).
 */
test.describe("Tema", () => {
  test("default mengikuti sistem (terang → light)", async ({ page }) => {
    // Konteks Playwright default = prefers-color-scheme: light
    await page.goto("/");
    const cls = await page.locator("html").getAttribute("class");
    expect(cls).toContain("light");
    expect(cls).not.toContain("dark");
  });

  test("pilih Gelap → html.dark + latar gelap + tersimpan", async ({ page }) => {
    await page.goto("/");

    const html = page.locator("html");
    const bgLight = await page.evaluate(
      () => getComputedStyle(document.body).backgroundColor,
    );

    // Buka menu tema & pilih Gelap
    await page.getByRole("button", { name: "Ganti tema" }).click();
    await page.getByRole("menuitem", { name: "Gelap" }).click();

    await expect(html).toHaveClass(/dark/);
    await expect(html).not.toHaveClass(/\blight\b/);

    const bgDark = await page.evaluate(
      () => getComputedStyle(document.body).backgroundColor,
    );
    expect(bgDark).not.toBe(bgLight);

    // Tersimpan & bertahan setelah reload
    const stored = await page.evaluate(() => localStorage.getItem("theme"));
    expect(stored).toBe("dark");

    await page.reload();
    await expect(page.locator("html")).toHaveClass(/dark/);
  });

  test("ganti Gelap → Terang mengembalikan light", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Ganti tema" }).click();
    await page.getByRole("menuitem", { name: "Gelap" }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);

    await page.getByRole("button", { name: "Ganti tema" }).click();
    await page.getByRole("menuitem", { name: "Terang" }).click();
    await expect(page.locator("html")).toHaveClass(/light/);
    await expect(page.locator("html")).not.toHaveClass(/dark/);
  });

  test("pilihan 'Ikuti Sistem' mengikuti OS gelap", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/");
    await page.getByRole("button", { name: "Ganti tema" }).click();
    await page.getByRole("menuitem", { name: "Ikuti Sistem" }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);

    const stored = await page.evaluate(() => localStorage.getItem("theme"));
    expect(stored).toBe("system");
  });

  test("ikon toggle berubah Sun → Moon saat gelap", async ({ page }) => {
    await page.goto("/");
    const trigger = page.getByRole("button", { name: "Ganti tema" });
    // Terang: hanya ikon Sun terlihat (Moon `dark:block` → hidden)
    await expect(trigger.locator("svg").first()).toBeVisible();

    await trigger.click();
    await page.getByRole("menuitem", { name: "Gelap" }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    // Moon kini tampil
    await expect(trigger.locator("svg:visible")).toHaveCount(1);
  });
});
