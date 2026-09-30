import { test, expect } from "@playwright/test";

/**
 * E2E — Login demo: form email/sandi + pil user demo.
 * Membutuhkan akun demo ter-seed (`pnpm seed:users`).
 */
test.describe("Login demo (form + pil)", () => {
  test("halaman login menampilkan form & pil akun demo", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Masuk ke MathBank" })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Kata sandi")).toBeVisible();
    await expect(page.getByRole("button", { name: "Masuk", exact: true })).toBeVisible();
    // Pil demo
    await expect(page.getByRole("button", { name: "Admin", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Guru", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Penelaah", exact: true })).toBeVisible();
  });

  test("klik pil mengisi email & sandi otomatis", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Penelaah", exact: true }).click();
    await expect(page.getByLabel("Email")).toHaveValue("penelaah@mathbank.local");
    await expect(page.getByLabel("Kata sandi")).not.toHaveValue("");
  });

  test("masuk sebagai penelaah → identitas reviewer", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Penelaah", exact: true }).click();
    await page.getByRole("button", { name: "Masuk", exact: true }).click();
    await expect(page).toHaveURL("http://localhost:3100/");

    const me = await page.evaluate(async () => {
      const r = await fetch("/api/auth/me");
      return (await r.json()).data as { name: string; roles: string[]; via: string };
    });
    expect(me.roles).toContain("reviewer");
    expect(me.via).toBe("session");
  });

  test("menu pengguna menampilkan peran & tombol Ganti peran", async ({ page, viewport }) => {
    test.skip((viewport?.width ?? 0) < 1024, "sidebar menu pengguna tersembunyi di mobile");
    await page.goto("/login");
    await page.getByRole("button", { name: "Admin", exact: true }).click();
    await page.getByRole("button", { name: "Masuk", exact: true }).click();
    await expect(page).toHaveURL("http://localhost:3100/");

    await page.getByRole("button", { name: /Menu pengguna/i }).click();
    await expect(page.getByRole("menuitem", { name: /Ganti peran \(demo\)/i })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: /Keluar/i })).toBeVisible();
  });

  test("kunci demo tak dikenal → 404", async ({ request }) => {
    const res = await request.post("/api/dev/quick-login", {
      data: { key: "tidak-ada" },
    });
    expect(res.status()).toBe(404);
  });
});
