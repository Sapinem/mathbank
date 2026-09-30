import { test, expect } from "@playwright/test";

/**
 * E2E — Halaman Topik (M5).
 * Pohon tampil; buat kategori; anti-siklus & RESTRICT lewat API.
 */
test.describe("Referensi — Topik (M5)", () => {
  test("halaman topik menampilkan pohon", async ({ page }) => {
    await page.goto("/references/topics");
    await expect(page.getByRole("heading", { name: "Topik" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Kategori Baru" })).toBeVisible();
  });

  test("dialog buat kategori terbuka", async ({ page }) => {
    await page.goto("/references/topics");
    await page.getByRole("button", { name: "Kategori Baru" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByLabel("Nama topik")).toBeVisible();
  });

  test("API menolak siklus topik (409)", async ({ request }) => {
    // Buat dua topik: induk & anak, lalu coba jadikan anak sebagai induk induk.
    const parentRes = await request.post("/api/topics", {
      data: { name: `E2E Parent ${Date.now()}` },
    });
    const parent = (await parentRes.json()).data;
    const childRes = await request.post("/api/topics", {
      data: { name: `E2E Child ${Date.now()}`, parentId: parent.id },
    });
    const child = (await childRes.json()).data;

    const cyc = await request.patch(`/api/topics/${parent.id}`, {
      data: { parentId: child.id },
    });
    expect(cyc.status()).toBe(409);

    // Bersihkan (anak dulu, lalu induk).
    await request.delete(`/api/topics/${child.id}`);
    await request.delete(`/api/topics/${parent.id}`);
  });

  test("API menolak hapus topik ber-anak (409) lalu boleh setelah anak dihapus", async ({
    request,
  }) => {
    const parent = (await (
      await request.post("/api/topics", { data: { name: `E2E P ${Date.now()}` } })
    ).json()).data;
    const child = (await (
      await request.post("/api/topics", {
        data: { name: `E2E C ${Date.now()}`, parentId: parent.id },
      })
    ).json()).data;

    const del1 = await request.delete(`/api/topics/${parent.id}`);
    expect(del1.status()).toBe(409);

    await request.delete(`/api/topics/${child.id}`);
    const del2 = await request.delete(`/api/topics/${parent.id}`);
    expect(del2.ok()).toBeTruthy();
  });
});
