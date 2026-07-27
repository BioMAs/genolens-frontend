/**
 * capture-ai.spec.ts
 * Capture du chat "AI Assistant" (16-ai-assistant.png).
 *
 * Isolé du reste : l'endpoint LLM tourne sur Modal en scale-to-zero, donc le
 * premier appel après inactivité paie un démarrage à froid qui peut dépasser
 * deux minutes. Ce fichier peut être relancé seul jusqu'à obtenir une réponse.
 *
 * Note : l'interprétation IA "statique" figure déjà sur l'onglet Overview
 * (capture 08). Celle-ci montre en plus la capacité conversationnelle.
 */
import { test, type Page } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const MARKETING = path.resolve(__dirname, '../../marketing')
const SHOTS = path.join(MARKETING, 'screenshots')

const routes = JSON.parse(
  fs.readFileSync(path.join(MARKETING, 'demo-routes.json'), 'utf-8')
) as { projectId: string; comparisonName: string }

const COMPARISON_URL = `/projects/${routes.projectId}/comparisons/${routes.comparisonName}`

/** Attend que l'indicateur "Thinking…" disparaisse : signal fiable de fin de génération. */
async function waitForAnswer(page: Page, timeout: number): Promise<boolean> {
  const started = Date.now()
  try {
    await page.waitForFunction(
      () => !document.body.innerText.includes('Thinking'),
      undefined,
      { timeout, polling: 1000 }
    )
    return true
  } catch (err) {
    // Ne jamais avaler l'erreur : un rejet précoce (contexte détruit, crash de
    // la page) ne doit pas être confondu avec un simple dépassement de délai.
    console.log(`waitForAnswer a rejeté après ${((Date.now() - started) / 1000).toFixed(1)} s`)
    console.log(`  raison: ${String(err).split('\n')[0]}`)
    return false
  }
}

test('capture the AI assistant conversation', async ({ page }) => {
  test.setTimeout(600_000)
  fs.mkdirSync(SHOTS, { recursive: true })

  await page.goto(COMPARISON_URL, { waitUntil: 'networkidle' })
  await page.waitForTimeout(5000)

  await page.getByRole('button', { name: /^AI Assistant$/i }).first().click()
  await page.waitForTimeout(4000)

  // Question portant sur les DEG et non sur l'enrichissement : l'outil
  // get_enrichment_pathways ne retrouve pas les données d'enrichissement du
  // projet DEMO et produit un refus (voir le rapport de capture).
  const askBox = page.getByRole('textbox').last()
  await askBox.fill('How many genes are up-regulated, and what are the top ones?')
  await askBox.press('Enter')
  console.log('Question envoyée — attente de la réponse (jusqu\'à 5 min, cold start Modal)')

  const answered = await waitForAnswer(page, 300_000)
  if (!answered) {
    throw new Error(
      "L'IA n'a pas répondu en 5 minutes : la capture montrerait « Thinking… », " +
        'ce que le critère de recette interdit. Relancer ce fichier — le second ' +
        'appel ne paie plus le démarrage à froid.'
    )
  }

  // La disparition de "Thinking…" précède la fin du streaming : on attend que
  // la longueur du texte cesse de croître, sinon on capture une phrase coupée.
  let previous = -1
  let stable = 0
  for (let i = 0; i < 60 && stable < 3; i++) {
    const len = (await page.locator('body').innerText()).length
    stable = len === previous ? stable + 1 : 0
    previous = len
    await page.waitForTimeout(2000)
  }
  console.log(`Flux stabilisé à ${previous} caractères`)

  // Garde-fou : ne jamais livrer une capture où l'IA se dérobe. Un deck
  // commercial montrant « I do not have any data » est pire que pas de slide.
  const body = await page.locator('body').innerText()
  const evasive = /I do not have|I don't have|no data available|unable to|cannot find/i.test(body)
  if (evasive) {
    throw new Error(
      'Réponse évasive détectée — capture refusée. Extrait :\n' +
        body.slice(body.indexOf('Assistant'), body.indexOf('Assistant') + 500)
    )
  }

  await page.screenshot({ path: path.join(SHOTS, '16-ai-assistant.png'), fullPage: false })
  console.log('  ✓ 16-ai-assistant')
})
