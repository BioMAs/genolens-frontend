/**
 * capture.spec.ts
 * Produit les captures d'écran du deck commercial dans marketing/screenshots/.
 *
 * Les sélecteurs viennent de la passe de recon : la navigation interne de la
 * vue comparaison se fait par des `button`, PAS par `role="tab"`.
 */
import { test, type Page } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const MARKETING = path.resolve(__dirname, '../../marketing')
const SHOTS = path.join(MARKETING, 'screenshots')

const routes = JSON.parse(
  fs.readFileSync(path.join(MARKETING, 'demo-routes.json'), 'utf-8')
) as { projectId: string; analysisId: string; comparisonName: string }

for (const key of ['projectId', 'comparisonName'] as const) {
  if (!routes[key]) {
    throw new Error(`demo-routes.json : "${key}" est vide — relancer recon.spec.ts`)
  }
}

const P = routes.projectId
const C = routes.comparisonName
const COMPARISON_URL = `/projects/${P}/comparisons/${C}`

async function shoot(page: Page, name: string, settleMs = 2500): Promise<void> {
  // Laisse Plotly/Recharts terminer leur animation d'entrée avant de figer.
  await page.waitForTimeout(settleMs)
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: false })
  console.log(`  ✓ ${name}`)
}

async function shootRoute(page: Page, name: string, url: string, settleMs = 2500): Promise<void> {
  await page.goto(url, { waitUntil: 'networkidle' })
  await shoot(page, name, settleMs)
}

/** Clique un onglet de la vue comparaison (ce sont des boutons) puis capture. */
async function shootTab(
  page: Page,
  name: string,
  tabLabel: RegExp,
  settleMs = 4000
): Promise<void> {
  const btn = page.getByRole('button', { name: tabLabel }).first()
  await btn.click()
  await shoot(page, name, settleMs)
}

test('capture the deck screenshots', async ({ page }) => {
  test.setTimeout(900_000)
  fs.mkdirSync(SHOTS, { recursive: true })

  // ── Écrans accessibles par URL ──────────────────────────────────────────
  await shootRoute(page, '01-dashboard', '/dashboard', 3500)
  await shootRoute(page, '02-project-hub', `/projects/${P}`, 3000)
  await shootRoute(page, '03-setup', `/projects/${P}/setup`, 3000)
  await shootRoute(page, '04-analyses', `/projects/${P}/analyses`, 3000)
  await shootRoute(page, '05-analysis-new', `/projects/${P}/analyses/new`, 3000)
  await shootRoute(page, '06-multi-comparison', `/projects/${P}/multi-comparison`, 5000)
  await shootRoute(page, '07-contrast-scatter', `/projects/${P}/contrast-scatter`, 5000)
  await shootRoute(page, '17-pricing', '/pricing', 2500)
  await shootRoute(page, '18-my-modules', '/profile', 2500)

  // ── Onglets de la vue comparaison ───────────────────────────────────────
  await page.goto(COMPARISON_URL, { waitUntil: 'networkidle' })
  await shoot(page, '08-comparison-overview', 6000)

  await shootTab(page, '09-deg-table', /^DEG Table$/i)
  await shootTab(page, '10-method-statistics', /^Method statistics$/i)
  await shootTab(page, '11-enrichment', /^Enrichment$/i, 6000)
  await shootTab(page, '12-clustering', /^Clustering$/i, 6000)
  await shootTab(page, '13-signature-score', /^Signature score$/i, 5000)
  await shootTab(page, '14-skin-effect', /^Skin effect$/i, 6000)
  await shootTab(page, '15-report', /^Report$/i, 6000)

  // La capture du chat IA vit dans capture-ai.spec.ts : elle dépend d'un appel
  // LLM lent (Modal en scale-to-zero) et doit pouvoir être relancée seule sans
  // refaire les dix-sept autres.
})
