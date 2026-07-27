/**
 * probe.spec.ts — sonde de diagnostic.
 * Dump les liens et le texte réels des écrans de listing, pour construire
 * une découverte d'ids fiable plutôt que devinée.
 */
import { test } from '@playwright/test'

const P = '3a39cc1a-0689-4806-86ef-3847dfcf560b'

const TARGETS: [string, string][] = [
  ['DASHBOARD', '/dashboard'],
  ['DATASETS', `/projects/${P}/datasets`],
  ['ANALYSES', `/projects/${P}/analyses`],
]

test('probe: dump real hrefs on listing screens', async ({ page }) => {
  test.setTimeout(180_000)

  for (const [label, url] of TARGETS) {
    await page.goto(url, { waitUntil: 'networkidle' })
    await page.waitForTimeout(4000)

    const hrefs = await page.$$eval('a[href]', (as) =>
      Array.from(new Set(as.map((a) => a.getAttribute('href') || ''))).filter(Boolean)
    )
    const buttonTexts = await page.$$eval('button', (bs) =>
      bs.map((b) => (b.textContent || '').trim()).filter((t) => t && t.length < 60).slice(0, 25)
    )

    console.log(`\n===== ${label} — ${url} =====`)
    console.log('--- hrefs ---')
    console.log(hrefs.join('\n') || '(aucun)')
    console.log('--- boutons ---')
    console.log(buttonTexts.join(' | ') || '(aucun)')
    console.log('--- texte (600 premiers caractères) ---')
    console.log((await page.locator('body').innerText()).trim().slice(0, 600))
  }
})
