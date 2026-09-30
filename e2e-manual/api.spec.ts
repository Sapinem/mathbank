import { test, expect } from "@playwright/test";

/**
 * E2E — Smoke API (M4a) & navigasi dasar.
 * Memastikan kontrak route berjalan (dengan AUTH_DEV_BYPASS pada webServer).
 */
test.describe("API", () => {
  test("GET /api/questions mengembalikan daftar terpaginasi", async ({ request }) => {
    const res = await request.get("/api/questions?limit=3");
    expect(res.status()).toBe(200);
    const { data } = await res.json();
    expect(Array.isArray(data.items)).toBe(true);
    expect(typeof data.total).toBe("number");
    expect(data.items.length).toBeLessThanOrEqual(3);
  });

  test("GET /api/topics & /api/sources mengembalikan array", async ({ request }) => {
    for (const path of ["/api/topics", "/api/sources", "/api/events"]) {
      const res = await request.get(path);
      expect(res.status(), path).toBe(200);
      const { data } = await res.json();
      expect(Array.isArray(data), path).toBe(true);
    }
  });

  test("filter status=review hanya mengembalikan status review", async ({ request }) => {
    const res = await request.get("/api/questions?status=review");
    expect(res.status()).toBe(200);
    const { data } = await res.json();
    for (const q of data.items) {
      expect(q.status).toBe("review");
    }
  });
});

test.describe("Navigasi", () => {
  test("beranda (Dasbor) memuat", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/MathBank/i);
  });

  test("tautan sidebar menuju Bank Soal", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "mobile", "sidebar tersembunyi di mobile");
    await page.goto("/");
    await page.getByRole("link", { name: "Bank Soal" }).first().click();
    await expect(page).toHaveURL(/\/questions/);
  });
});
