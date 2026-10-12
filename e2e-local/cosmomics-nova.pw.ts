import fs from 'fs';
import path from 'path';
import { expect, test, type Page } from '@playwright/test';

/**
 * CosmOmics nova — visual checks on the dev-only bench page (/cosmomics-check).
 * Reference: docs/reference/cosmomics/CosmOmics_pathway_nova_flyer.png (same fixture).
 */

const OUT = process.env.COSMOMICS_CAPTURE_DIR ?? 'test-results/cosmomics';
const REAL_JSON = process.env.COSMOMICS_REAL_JSON;
const REFERENCE_ORDER = [
  'Regeneration', 'Firming', 'Barrier', 'Anti-ageing', 'Soothing', 'Antioxidant', 'Not linked to a claim',
];

test.beforeAll(() => fs.mkdirSync(OUT, { recursive: true }));

async function openBench(page: Page, query = '') {
  await page.goto(`/cosmomics-check${query}`);
  await page.waitForSelector('[data-cosmomics-nova] svg');
  await page.waitForFunction(() => window.__NOVA_RENDER_MS__ !== undefined);
}

/** Pairs of claim labels whose rendered boxes intersect. */
function labelOverlaps(page: Page) {
  return page.evaluate(() => {
    const groups = [...document.querySelectorAll<SVGGElement>('[data-cosmomics-nova] [data-claim-label]')];
    const boxes = groups.map((g) => ({ name: g.dataset.claimLabel, b: g.getBBox() }));
    const hits: string[] = [];
    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) {
        const a = boxes[i].b;
        const c = boxes[j].b;
        const apart = a.x + a.width < c.x || c.x + c.width < a.x || a.y + a.height < c.y || c.y + c.height < a.y;
        if (!apart) hits.push(`${boxes[i].name} × ${boxes[j].name}`);
      }
    }
    return hits;
  });
}

/** Texts of the nova that stick out of its viewBox (would be cut). */
function clippedTexts(page: Page) {
  return page.evaluate(() => {
    const svg = document.querySelector<SVGSVGElement>('[data-cosmomics-nova] svg')!;
    const vb = svg.viewBox.baseVal;
    return [...svg.querySelectorAll('text')]
      .filter((t) => {
        const b = t.getBBox();
        return b.x < vb.x - 0.5 || b.y < vb.y - 0.5 || b.x + b.width > vb.x + vb.width + 0.5 || b.y + b.height > vb.y + vb.height + 0.5;
      })
      .map((t) => t.textContent);
  });
}

test('reference fixture at 1000 px: reference order, no overlap, nothing cut', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 1300 });
  await openBench(page);

  const titles = await page.$$eval('[data-cosmomics-nova] [data-claim-label]', (groups) =>
    groups.map((g) => g.querySelector('text')?.textContent),
  );
  expect(titles).toEqual(REFERENCE_ORDER);
  expect(await labelOverlaps(page)).toEqual([]);
  expect(await clippedTexts(page)).toEqual([]);

  await page.locator('[data-cosmomics-nova]').screenshot({ path: path.join(OUT, 'nova_mock_1000.png') });
  await page.screenshot({ path: path.join(OUT, 'page_mock_1000.png'), fullPage: true });
});

test('reference fixture at 375 px: no horizontal scroll, nothing cut', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await openBench(page);

  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(375);
  expect(await labelOverlaps(page)).toEqual([]);
  expect(await clippedTexts(page)).toEqual([]);

  await page.screenshot({ path: path.join(OUT, 'page_mock_375.png'), fullPage: true });
});

test('15 claims, 300 sub-groups, 2 000 terms render in under 300 ms', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await openBench(page, '?perf=1');

  const ms = await page.evaluate(() => window.__NOVA_RENDER_MS__!);
  const bubbles = await page.locator('[data-cosmomics-nova] circle[data-subgroup]').count();
  expect(bubbles).toBe(300);
  expect(ms).toBeLessThan(300);
  expect(await labelOverlaps(page)).toEqual([]);
  test.info().annotations.push({ type: 'render', description: `${ms.toFixed(0)} ms` });

  await page.locator('[data-cosmomics-nova]').screenshot({ path: path.join(OUT, 'nova_perf.png') });
});

test('real dataset (COSMOMICS_REAL_JSON)', async ({ page }) => {
  test.skip(!REAL_JSON, 'Set COSMOMICS_REAL_JSON to a nova payload saved from the API');
  const payload = JSON.parse(fs.readFileSync(REAL_JSON!, 'utf8'));
  await page.addInitScript((data) => {
    (window as unknown as { __COSMOMICS_DATA__: unknown }).__COSMOMICS_DATA__ = data;
  }, payload);
  await page.setViewportSize({ width: 1000, height: 1300 });
  await openBench(page);
  await expect(page.locator('[data-bench-status]')).toContainText('injected');

  expect(await labelOverlaps(page)).toEqual([]);
  expect(await clippedTexts(page)).toEqual([]);

  await page.locator('[data-cosmomics-nova]').screenshot({ path: path.join(OUT, 'nova_real_1000.png') });
  await page.screenshot({ path: path.join(OUT, 'page_real_1000.png'), fullPage: true });
});
