/**
 * recon.spec.ts
 * Passe de reconnaissance sur le projet DEMO avant toute capture commerciale.
 *
 * Produit deux fichiers dans marketing/ :
 *   - demo-routes.json  : les ids réels, consommés par capture.spec.ts et demo-video.spec.ts
 *   - recon-report.md   : l'état de chaque écran (peuplé / vide / verrouillé)
 *
 * La découverte s'appuie sur les liens réellement présents dans le DOM (constatés
 * via probe.spec.ts), pas sur des routes supposées :
 *   - les datasets ne sont PAS listés sur /datasets mais sur /setup
 *   - /analyses contient un lien "new" à écarter avant de prendre un id d'analyse
 *   - la vue comparaison vit sur /projects/{id}/comparisons/{nom}, sans passer
 *     par /analyses/{analysisId}
 */
import { test, expect, type Page } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const PROJECT_ID = '3a39cc1a-0689-4806-86ef-3847dfcf560b'
const OUT_DIR = path.resolve(__dirname, '../../marketing')
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface ScreenReport {
  name: string
  url: string
  status: 'populated' | 'empty' | 'error'
  note: string
}

const reports: ScreenReport[] = []

async function hrefsOn(page: Page, url: string): Promise<string[]> {
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.waitForTimeout(3500)
  return page.$$eval('a[href]', (as) =>
    Array.from(new Set(as.map((a) => a.getAttribute('href') || ''))).filter(Boolean)
  )
}

async function inspect(page: Page, name: string, url: string): Promise<void> {
  try {
    await page.goto(url, { waitUntil: 'networkidle' })
    await page.waitForTimeout(2500)

    const bodyText = (await page.locator('body').innerText()).trim()
    // Le shell (nav + profil) pèse ~200 caractères à lui seul : en dessous de
    // 260 il n'y a pas de contenu propre à l'écran.
    const looksEmpty =
      bodyText.length < 260 || /no data|no results|nothing here|no datasets found/i.test(bodyText)
    // Seul "Request access" signale un module réellement verrouillé ; "Upgrade
    // Plan" est un bouton permanent et ne doit pas déclencher d'alerte.
    const locked = /request access/i.test(bodyText)

    const notes = [`${bodyText.length} chars`]
    if (locked) notes.unshift('LOCKED MODULE')

    reports.push({
      name,
      url,
      status: looksEmpty ? 'empty' : 'populated',
      note: notes.join(' — '),
    })
  } catch (err) {
    reports.push({ name, url, status: 'error', note: String(err).slice(0, 180) })
  }
}

test('recon: inventory the DEMO screens and discover real ids', async ({ page }) => {
  test.setTimeout(480_000)
  fs.mkdirSync(OUT_DIR, { recursive: true })

  // ── Garde-fou : jamais de capture avec un compte contenant des projets clients
  await page.goto('/dashboard', { waitUntil: 'networkidle' })
  await page.waitForTimeout(3000)
  const dashHrefs = await page.$$eval('a[href]', (as) =>
    Array.from(new Set(as.map((a) => a.getAttribute('href') || ''))).filter(Boolean)
  )
  const projectLinks = dashHrefs.filter((h) => /^\/projects\/[0-9a-f-]{36}$/i.test(h))
  console.log(`projets visibles: ${projectLinks.length} -> ${projectLinks.join(', ')}`)

  // ── Comparaison : le lien de reprise du dashboard pointe sur un résultat réel
  let comparisonName =
    dashHrefs
      .find((h) => h.includes(`/projects/${PROJECT_ID}/comparisons/`))
      ?.split('/comparisons/')[1]
      ?.split(/[?#]/)[0] ?? ''

  // ── Analyse : écarter le lien "new" et ne garder qu'un id en UUID
  const analysisHrefs = await hrefsOn(page, `/projects/${PROJECT_ID}/analyses`)
  const analysisId =
    analysisHrefs
      .map((h) => h.split('/analyses/')[1]?.split(/[/?#]/)[0] ?? '')
      .find((seg) => UUID_RE.test(seg)) ?? ''

  // ── Dataset : les datasets sont listés sur /setup, pas sur /datasets
  const setupHrefs = await hrefsOn(page, `/projects/${PROJECT_ID}/setup`)
  const datasetId =
    setupHrefs
      .map((h) => h.split('/datasets/')[1]?.split(/[/?#]/)[0] ?? '')
      .find((seg) => UUID_RE.test(seg)) ?? ''

  // Repli : si /setup n'expose pas de lien dataset, tenter depuis l'analyse
  let datasetIdFinal = datasetId
  if (!datasetIdFinal && analysisId) {
    const anaHrefs = await hrefsOn(page, `/projects/${PROJECT_ID}/analyses/${analysisId}`)
    datasetIdFinal =
      anaHrefs
        .map((h) => h.split('/datasets/')[1]?.split(/[/?#]/)[0] ?? '')
        .find((seg) => UUID_RE.test(seg)) ?? ''
    if (!comparisonName) {
      comparisonName =
        anaHrefs
          .find((h) => h.includes('/comparisons/'))
          ?.split('/comparisons/')[1]
          ?.split(/[?#]/)[0] ?? ''
    }
  }

  const routes = {
    projectId: PROJECT_ID,
    datasetId: datasetIdFinal,
    analysisId,
    comparisonName,
  }
  fs.writeFileSync(path.join(OUT_DIR, 'demo-routes.json'), JSON.stringify(routes, null, 2))
  console.log('--- discovered routes ---')
  console.log(JSON.stringify(routes, null, 2))

  // ── Inventaire des écrans ────────────────────────────────────────────────
  await inspect(page, 'dashboard', '/dashboard')
  await inspect(page, 'project-hub', `/projects/${PROJECT_ID}`)
  await inspect(page, 'setup', `/projects/${PROJECT_ID}/setup`)
  await inspect(page, 'analyses', `/projects/${PROJECT_ID}/analyses`)
  await inspect(page, 'analysis-new', `/projects/${PROJECT_ID}/analyses/new`)
  await inspect(page, 'multi-comparison', `/projects/${PROJECT_ID}/multi-comparison`)
  await inspect(page, 'contrast-scatter', `/projects/${PROJECT_ID}/contrast-scatter`)
  await inspect(page, 'pricing', '/pricing')
  await inspect(page, 'profile-modules', '/profile')
  await inspect(page, 'tools', '/tools')
  if (analysisId) {
    await inspect(page, 'analysis-detail', `/projects/${PROJECT_ID}/analyses/${analysisId}`)
  }
  if (comparisonName) {
    await inspect(
      page,
      'comparison-detail',
      `/projects/${PROJECT_ID}/comparisons/${comparisonName}`
    )
  }
  if (datasetIdFinal) {
    await inspect(
      page,
      'clustering',
      `/projects/${PROJECT_ID}/datasets/${datasetIdFinal}/clustering`
    )
    await inspect(
      page,
      'enrichment',
      `/projects/${PROJECT_ID}/datasets/${datasetIdFinal}/enrichment`
    )
  }

  // ── Onglets réels de la vue comparaison : corrige les sélecteurs devinés ──
  const tabs: string[] = []
  if (comparisonName) {
    await page.goto(`/projects/${PROJECT_ID}/comparisons/${comparisonName}`, {
      waitUntil: 'networkidle',
    })
    await page.waitForTimeout(4000)
    for (const role of ['tab', 'button'] as const) {
      const loc = page.getByRole(role)
      const n = await loc.count()
      for (let i = 0; i < Math.min(n, 40); i++) {
        const t = (await loc.nth(i).innerText().catch(() => '')).trim()
        if (t && t.length < 40 && !tabs.includes(`${role}: ${t}`)) tabs.push(`${role}: ${t}`)
      }
    }
  }
  console.log('--- controls found on comparison view ---')
  console.log(tabs.join('\n'))

  // ── Rapport ──────────────────────────────────────────────────────────────
  const needsAttention = reports.filter(
    (r) => r.status !== 'populated' || r.note.includes('LOCKED')
  )
  const lines = [
    '# Recon report — DEMO project',
    '',
    `Captured against \`${process.env.PLAYWRIGHT_BASE_URL ?? 'https://app.genolens.com'}\`.`,
    `Projects visible to the capture account: **${projectLinks.length}**.`,
    '',
    '## Discovered ids',
    '',
    '```json',
    JSON.stringify(routes, null, 2),
    '```',
    '',
    '## Controls on the comparison view',
    '',
    tabs.length ? tabs.map((t) => `- \`${t}\``).join('\n') : '_none found_',
    '',
    '## Screen inventory',
    '',
    '| Screen | Status | Note |',
    '|---|---|---|',
    ...reports.map((r) => `| ${r.name} | ${r.status} | ${r.note} |`),
    '',
    '## Screens needing attention',
    '',
    needsAttention.length
      ? needsAttention.map((r) => `- **${r.name}** (${r.url}) — ${r.status}, ${r.note}`).join('\n')
      : '_none — every screen is populated_',
    '',
  ]
  fs.writeFileSync(path.join(OUT_DIR, 'recon-report.md'), lines.join('\n'))

  expect(projectLinks.length, 'capture account must see exactly the DEMO project').toBe(1)
  expect(analysisId, 'analysis id must be discoverable').not.toBe('')
  expect(comparisonName, 'comparison name must be discoverable').not.toBe('')
})
