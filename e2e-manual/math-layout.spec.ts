import { test, expect, type Page } from "@playwright/test";

/**
 * E2E — Kontrak tata letak matematika di halaman detail soal (regresi
 * "scroll kanan-kiri" pada pembahasan).
 *
 * Yang dijamin (bukan hanya keberadaan elemen, tapi GEOMETRI nyata):
 *  1. Tidak ada elemen di dalam konten soal yang menjadi kontainer gulir
 *     horizontal (`overflow-x: auto|scroll`) kecuali rumus DISPLAY
 *     (`.katex-display` yang memang boleh menggulir).
 *  2. Tidak ada elemen yang benar-benar dapat digulir horizontal
 *     (scrollWidth > clientWidth) selain rumus display.
 *  3. Halaman tidak menghasilkan gulir horizontal (scrollWidth == innerWidth).
 *
 * Diuji pada soal dengan PEMBAHASAN panjang (banyak LaTeX) — kasus yang paling
 * rawan, karena sebelumnya seluruh blok pembahasan menjadi satu kotak gulir
 * (`no-scrollbar` hanya menyembunyikan scrollbar; gulirnya tetap ada).
 */

/** Login via akun demo (server dev punya DEMO_LOGIN=enabled). */
async function loginDemo(page: Page) {
  await page.goto("/login");
  const admin = page.getByRole("button", { name: /admin/i });
  if ((await admin.count()) === 0) return; // sudah login / tanpa demo
  await admin.first().click();
  await expect(page.locator("#login-email")).not.toHaveValue("", { timeout: 15_000 });
  await page.getByRole("button", { name: /^masuk$/i }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
  await page.waitForTimeout(4000);
  // Pastikan cookie sesi terdaftar di konteks (kadang perlu satu navigasi lagi).
  await page.goto("/questions");
  if (/\/login/.test(page.url())) {
    await page.goto("/questions");
  }
}

/** Ambil id soal dengan pembahasan (explanation) terpanjang lewat API. */
async function longestSolutionIds(page: Page, limit: number): Promise<string[]> {
  return page.evaluate(async (n) => {
    const list = await fetch("/api/questions?limit=100", { credentials: "include" });
    const lj = await list.json();
    const items: Array<{ id: string }> = lj?.data?.items ?? [];

    const scored: Array<{ id: string; len: number }> = [];
    for (const it of items) {
      const r = await fetch(`/api/questions/${it.id}`, { credentials: "include" });
      if (!r.ok) continue;
      const j = await r.json();
      const d = j.data ?? j;
      const sols: Array<{ contentMarkdown?: string }> = d.solutions ?? [];
      const expl: string = d?.key?.explanation ?? "";
      const len =
        sols.reduce((a, s) => a + (s.contentMarkdown?.length ?? 0), 0) + expl.length;
      scored.push({ id: it.id, len });
    }
    scored.sort((a, b) => b.len - a.len);
    return scored.slice(0, n).map((s) => s.id);
  }, limit);
}

/** Ukur pelanggaran gulir horizontal di DOM halaman saat ini. */
async function measureHorizontalScroll(page: Page) {
  return page.evaluate(() => {
    const isDisplay = (el: Element) =>
      el.classList.contains("katex-display") ||
      el.classList.contains("katex") ||
      !!el.closest(".katex-display");

    const scrollContainers: Array<{ cls: string; tag: string }> = [];
    const actuallyScrollable: Array<{
      cls: string;
      tag: string;
      sw: number;
      cw: number;
      txt: string;
    }> = [];

    for (const el of Array.from(document.querySelectorAll<HTMLElement>("body *"))) {
      if (isDisplay(el)) continue;
      const cs = getComputedStyle(el);
      if (cs.overflowX === "auto" || cs.overflowX === "scroll") {
        scrollContainers.push({
          cls: el.className.toString().slice(0, 80),
          tag: el.tagName,
        });
        if (el.scrollWidth > el.clientWidth + 1) {
          actuallyScrollable.push({
            cls: el.className.toString().slice(0, 80),
            tag: el.tagName,
            sw: el.scrollWidth,
            cw: el.clientWidth,
            txt: el.textContent?.slice(0, 50) ?? "",
          });
        }
      }
    }

    return {
      docScrollW: document.documentElement.scrollWidth,
      innerW: window.innerWidth,
      scrollContainers,
      actuallyScrollable,
      katexCount: document.querySelectorAll(".katex").length,
      katexInlineCount: document.querySelectorAll(".katex-inline").length,
    };
  });
}

test.describe("Detail soal — tidak ada scroll kanan-kiri pada pembahasan", () => {
  test("soal dengan pembahasan panjang: tidak ada kontainer gulir horizontal", async ({
    page,
  }) => {
    await loginDemo(page);
    const ids = await longestSolutionIds(page, 5);
    expect(ids.length, "harus ada soal ber-pembahasan untuk diuji").toBeGreaterThan(0);

    for (const id of ids) {
      await page.goto(`/questions/${id}`);
      // Tunggu KaTeX ter-render (konten soal ada).
      await page.locator(".katex").first().waitFor({ timeout: 20_000 });
      await page.waitForTimeout(300);

      const m = await measureHorizontalScroll(page);

      expect(
        m.scrollContainers,
        `soal ${id}: ada elemen ber-overflow-x auto/scroll (bukan rumus display): ${JSON.stringify(
          m.scrollContainers,
        )}`,
      ).toHaveLength(0);

      expect(
        m.actuallyScrollable,
        `soal ${id}: elemen benar-benar bergulir horizontal: ${JSON.stringify(
          m.actuallyScrollable,
        )}`,
      ).toHaveLength(0);

      expect(
        m.docScrollW,
        `soal ${id}: halaman menggulir horizontal (${m.docScrollW} > ${m.innerW})`,
      ).toBeLessThanOrEqual(m.innerW + 1);
    }
  });

  test("pembahasan tidak dapat di-drag kanan-kiri (uji gulir langsung)", async ({
    page,
  }) => {
    await loginDemo(page);
    const ids = await longestSolutionIds(page, 1);
    test.skip(ids.length === 0, "tak ada soal ber-pembahasan");

    await page.goto(`/questions/${ids[0]}`);
    await page.locator(".katex").first().waitFor({ timeout: 20_000 });
    await page.waitForTimeout(300);

    // Coba gulirkan setiap kemungkinan kontainer konten ke kanan sejauh mungkin,
    // lalu pastikan benar-benar tidak bergerak (scrollLeft tetap 0).
    const offenders = await page.evaluate(() => {
      const bad: Array<{ cls: string; moved: number }> = [];
      for (const el of Array.from(document.querySelectorAll<HTMLElement>("body *"))) {
        if (el.closest(".katex-display")) continue;
        const cs = getComputedStyle(el);
        if (cs.overflowX !== "auto" && cs.overflowX !== "scroll") continue;
        el.scrollLeft = 9999;
        if (el.scrollLeft > 0) {
          bad.push({ cls: el.className.toString().slice(0, 80), moved: el.scrollLeft });
          el.scrollLeft = 0;
        }
      }
      return bad;
    });

    expect(
      offenders,
      `elemen konten yang bisa digeser kanan-kiri: ${JSON.stringify(offenders)}`,
    ).toHaveLength(0);
  });
});
