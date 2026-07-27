/**
 * demo-video.spec.ts
 * Enregistre le parcours de démonstration (~2 min 15) en 1920×1080.
 *
 * Le storyboard suit l'interface RÉELLE constatée à la recon : la vue
 * comparaison concentre tout en onglets (Overview, DEG Table, Enrichment,
 * Skin effect, Report), il n'y a pas de routes séparées à enchaîner.
 *
 * Les temporisations sont volontairement longues : cette séquence est regardée
 * par un humain, et une coupe au milieu d'un graphique se lit comme un bug.
 * Elles sont aussi calées sur les timecodes de marketing/demo-storyboard.md.
 */
import { test, type Page } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const MARKETING = path.resolve(__dirname, '../../marketing')
const routes = JSON.parse(
  fs.readFileSync(path.join(MARKETING, 'demo-routes.json'), 'utf-8')
) as { projectId: string; comparisonName: string }

const P = routes.projectId
const COMPARISON_URL = `/projects/${P}/comparisons/${routes.comparisonName}`

test.use({
  video: { mode: 'on', size: { width: 1920, height: 1080 } },
})

/**
 * Journal des plans : les timecodes du storyboard doivent être MESURÉS et non
 * estimés. Un premier montage estimé dérivait de ~20 s, ce qui désynchronisait
 * la voix off. On enregistre donc l'instant réel de chaque plan.
 */
const beats: { at: string; shot: string }[] = []
let t0 = 0

function mmss(ms: number): string {
  const s = Math.round(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function beat(shot: string): void {
  beats.push({ at: mmss(Date.now() - t0), shot })
  console.log(`  ${mmss(Date.now() - t0)}  ${shot}`)
}

/** Clique un onglet (ce sont des boutons) et laisse le contenu respirer. */
async function tab(page: Page, label: RegExp, holdMs: number): Promise<void> {
  await page.getByRole('button', { name: label }).first().click()
  await page.waitForTimeout(holdMs)
}

/** Défilement progressif : plus lisible qu'un saut, et montre le bas de page. */
async function scrollThrough(page: Page, steps: number, perStep = 320): Promise<void> {
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, perStep)
    await page.waitForTimeout(700)
  }
}

test('record the demo storyboard', async ({ page }) => {
  test.setTimeout(600_000)
  t0 = Date.now()

  // 0:00–0:12 — Dashboard : la carte de reprise affiche déjà le verdict cutané
  beat('Dashboard — resume card with the skin verdict')
  await page.goto('/dashboard', { waitUntil: 'networkidle' })
  await page.waitForTimeout(6000)
  await scrollThrough(page, 4)
  await page.waitForTimeout(2000)

  // 0:12–0:26 — Le projet : 6 comparaisons, 69 datasets, 3 analyses
  beat('Project DEMO — 6 comparisons, 69 datasets, 3 analyses')
  await page.goto(`/projects/${P}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(8000)
  await scrollThrough(page, 3)

  // 0:26–0:38 — Les analyses, importées depuis Excel et depuis GEO
  beat('Analyses — imported from Excel and from GEO')
  await page.goto(`/projects/${P}/analyses`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(9000)

  // 0:38–1:00 — Volcano + interprétation IA côte à côte
  beat('Volcano plot + AI biological interpretation')
  await page.goto(COMPARISON_URL, { waitUntil: 'networkidle' })
  await page.waitForTimeout(8000)
  // Survol de quelques points du volcano : fait apparaître les infobulles Plotly
  for (const [x, y] of [
    [1700, 1400],
    [1850, 1250],
    [2050, 1180],
  ] as const) {
    await page.mouse.move(x, y)
    await page.waitForTimeout(1800)
  }
  await scrollThrough(page, 3)

  // 1:00–1:14 — La table des DEG
  beat('DEG table')
  await tab(page, /^DEG Table$/i, 9000)
  await scrollThrough(page, 2)

  // 1:14–1:30 — L'enrichissement fonctionnel
  beat('Functional enrichment')
  await tab(page, /^Enrichment$/i, 11000)
  await scrollThrough(page, 2)

  // 1:30–1:52 — Skin effect : le moment qui vend
  beat('Skin effect — claims and compartments')
  await tab(page, /^Skin effect$/i, 12000)
  await scrollThrough(page, 4)

  // 1:52–2:06 — Le rapport brandé
  beat('Branded report')
  await tab(page, /^Report$/i, 10000)
  await scrollThrough(page, 2)

  // 2:06–2:18 — Multi-comparaison : Venn et UpSet
  beat('Multi-comparison — Venn and UpSet')
  await page.goto(`/projects/${P}/multi-comparison`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(9000)
  await scrollThrough(page, 2)
  await page.waitForTimeout(2000)

  fs.writeFileSync(
    path.join(MARKETING, 'demo-beats.json'),
    JSON.stringify({ totalMs: Date.now() - t0, beats }, null, 2)
  )
  console.log(`Durée totale du corps de test : ${mmss(Date.now() - t0)}`)
})
