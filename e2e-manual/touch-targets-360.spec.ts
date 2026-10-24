import { test, expect } from "@playwright/test";

/**
 * E2E — DoD MAT-47 (CRIT-03 & MAJ mobile).
 *
 * Memverifikasi dua janji keras:
 * 1. Pada viewport mobile tersempit (360×800, iPhone SE / Android kecil),
 *    `documentElement.scrollWidth === clientWidth` (zero horizontal overflow)
 *    di rute utama yang menyajikan rumus KaTeX panjang.
 * 2. Setiap kontrol interaktif memenuhi target sentuh WCAG 2.2 AA ≥ 44×44px
 *    pada pointer kasar (touch) — ditegakkan via varian `pointer-coarse:`.
 *
 * Dijalankan manual (`pnpm e2e:manual touch-targets-360`); tidak masuk
 * gerbang `pnpm check` agar CI tetap cepat & stabil.
 */
test.use({ viewport: { width: 360, height: 800 }, hasTouch: true });

const ROUTES = ["/", "/questions", "/references/topics"];

test.describe("MAT-47 — 360px & touch target 44px", () => {
  for (const path of ROUTES) {
    test(`zero horizontal overflow @360px: ${path}`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle").catch(() => {});
      const overflow = await page.evaluate(() => {
        const el = document.documentElement;
        return {
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth,
        };
      });
      expect(
        overflow.scrollWidth,
        `overflow-x @${path}: scrollWidth=${overflow.scrollWidth} clientWidth=${overflow.clientWidth}`,
      ).toBeLessThanOrEqual(overflow.clientWidth + 1);
    });
  }

  test("kontrol interaktif ≥ 44×44px pada pointer kasar", async ({ page }) => {
    await page.goto("/questions");
    // Tunggu konten daftar benar-benar ter-render (bukan skeleton "Loading…").
    await expect(
      page.locator('a[href^="/questions/"]:not([href="/questions/new"])').first(),
    ).toBeVisible({ timeout: 20_000 });
    await page.waitForLoadState("networkidle").catch(() => {});

    // Ambil semua tombol yang terlihat; pastikan dimensi CSS ≥ 44px.
    const sizes = await page.evaluate(() => {
      const out: { label: string; w: number; h: number }[] = [];
      const nodes = Array.from(
        document.querySelectorAll<HTMLElement>(
          "button:not([disabled]), a[role='button'], input[type='checkbox'], input[type='radio']",
        ),
      );
      for (const n of nodes) {
        // Checkbox/radio sering kecil; target sentuh efektifnya adalah <label>
        // pembungkus (CRIT-03). Ukur area terbesar antara kontrol & label-nya.
        let target: HTMLElement = n;
        if (n instanceof HTMLInputElement && (n.type === "checkbox" || n.type === "radio")) {
          const label = n.closest("label");
          if (label instanceof HTMLElement) target = label;
        }
        const r = target.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue; // tersembunyi
        const style = getComputedStyle(target);
        if (style.visibility === "hidden" || style.display === "none") continue;
        out.push({
          label: (n.getAttribute("aria-label") || n.textContent || n.tagName)
            .trim()
            .slice(0, 40),
          w: Math.round(r.width),
          h: Math.round(r.height),
        });
      }
      return out;
    });

    expect(sizes.length, "tidak ada kontrol terdeteksi").toBeGreaterThan(0);

    const tooSmall = sizes.filter((s) => s.w < 44 || s.h < 44);
    expect(
      tooSmall,
      `kontrol < 44px: ${JSON.stringify(tooSmall)}`,
    ).toEqual([]);
  });
});
