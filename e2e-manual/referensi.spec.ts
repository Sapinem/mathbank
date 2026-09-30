import { test, expect } from "@playwright/test";

/**
 * E2E — Referensi: Sumber, Event, Label (M5).
 * Halaman tampil & API CRUD bekerja; RESTRICT menolak hapus yang dipakai.
 */
test.describe("Referensi — Sumber (M5)", () => {
  test("halaman sumber menampilkan tabel", async ({ page }) => {
    await page.goto("/references/sources");
    await expect(page.getByRole("heading", { name: "Sumber & Asal" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sumber Baru" })).toBeVisible();
  });

  test("buat & hapus sumber via API", async ({ request }) => {
    const label = `E2E Sumber ${Date.now()}`;
    const created = (
      await (await request.post("/api/sources", { data: { kind: "book", label } })).json()
    ).data;
    expect(created.slug).toContain("e2e-sumber");
    const del = await request.delete(`/api/sources/${created.id}`);
    expect(del.ok()).toBeTruthy();
  });
});

test.describe("Referensi — Event (M5)", () => {
  test("halaman event menampilkan tabel", async ({ page }) => {
    await page.goto("/references/events");
    await expect(page.getByRole("heading", { name: "Event" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Event Baru" })).toBeVisible();
  });

  test("buat event dengan subtes via API", async ({ request }) => {
    const name = `E2E Event ${Date.now()}`;
    const created = (
      await (
        await request.post("/api/events", {
          data: { name, shortname: "E2E", category: "uji", subtests: ["A", "B"] },
        })
      ).json()
    ).data;
    expect(created.subtests).toEqual(["A", "B"]);
    await request.delete(`/api/events/${created.id}`);
  });
});

test.describe("Referensi — Label (M5)", () => {
  test("halaman label menampilkan tabel", async ({ page }) => {
    await page.goto("/references/labels");
    await expect(page.getByRole("heading", { name: "Label" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Label Baru" })).toBeVisible();
  });

  test("buat label via API", async ({ request }) => {
    const name = `E2E Label ${Date.now()}`;
    const created = (
      await (await request.post("/api/tags", { data: { name } })).json()
    ).data;
    expect(created.slug).toContain("e2e-label");
    await request.delete(`/api/tags/${created.id}`);
  });
});
