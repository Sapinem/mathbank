import { test, expect, type Page } from "@playwright/test";

/** Diagnosa: apakah login demo di dev 3010 menyimpan sesi? */
test.describe("DIAG login", () => {
  test("alur login demo", async ({ page }: { page: Page }) => {
    const logs: string[] = [];
    page.on("console", (m) => logs.push(`${m.type()}: ${m.text()}`));
    page.on("response", (r) => {
      if (r.url().includes("/api/auth") || r.url().includes("/login")) {
        logs.push(`RESP ${r.status()} ${r.request().method()} ${r.url()}`);
      }
    });

    await page.goto("/login");
    await page.getByRole("button", { name: /admin/i }).first().click();
    await page.locator("#login-email").waitFor({ state: "visible" });
    await expect(page.locator("#login-email")).not.toHaveValue("", { timeout: 10_000 });
    console.log("EMAIL:", await page.locator("#login-email").inputValue());
    await page.getByRole("button", { name: /^masuk$/i }).click();

    await page.waitForTimeout(4000);
    console.log("URL setelah Masuk:", page.url());
    const me = await page.evaluate(async () => {
      const r = await fetch("/api/auth/me", { credentials: "include" });
      return { status: r.status, body: (await r.text()).slice(0, 300) };
    });
    console.log("ME:", JSON.stringify(me));
    console.log("COOKIES:", JSON.stringify(await page.context().cookies()));

    await page.goto("/questions");
    await page.waitForTimeout(3000);
    console.log("URL di /questions:", page.url());
    console.log("jumlah kartu:", await page.locator('a[href^="/questions/"]:not([href="/questions/new"])').count());
    console.log("LOGS:\n" + logs.join("\n"));
  });
});
