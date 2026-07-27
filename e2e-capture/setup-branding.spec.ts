/**
 * setup-branding.spec.ts
 * Renseigne le branding de rapport du compte démo (module Report customization).
 *
 * À lancer UNE FOIS avant la capture finale : sans cela l'onglet Report montre
 * un formulaire vide, ce qui en fait l'écran le moins convaincant du deck.
 *
 * Deux particularités du formulaire, constatées à la sonde :
 *   - les libellés ne sont PAS des <label for> : ce sont des div. On cible donc
 *     chaque champ par sa position relative au texte du libellé.
 *   - il n'y a AUCUN bouton d'enregistrement : la sauvegarde est automatique.
 *     D'où la vérification par rechargement en fin de test.
 */
import { test, expect, type Locator, type Page } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const MARKETING = path.resolve(__dirname, '../../marketing')
const LOGO = path.resolve(__dirname, '../public/logo.png')

const routes = JSON.parse(
  fs.readFileSync(path.join(MARKETING, 'demo-routes.json'), 'utf-8')
) as { projectId: string; comparisonName: string }

const COMPARISON_URL = `/projects/${routes.projectId}/comparisons/${routes.comparisonName}`

const MM_TEXT =
  'Differential expression was computed with DESeq2. Functional enrichment was ' +
  'performed against GO, KEGG and Reactome. Gene set enrichment followed ' +
  'Subramanian et al. (2005), with Benjamini-Hochberg FDR control.'

const CONCLUSION_TEXT =
  'Transcriptomic signatures indicate coordinated activation of barrier and lipid ' +
  'metabolism pathways, consistent with an energising and moisturising effect on ' +
  'reconstructed human epidermis.'

/**
 * Champ suivant immédiatement un libellé donné (les labels ne sont pas liés aux
 * inputs). On prend la DERNIÈRE occurrence du libellé : « Institute name »
 * apparaît aussi dans l'aperçu du rapport, en amont du formulaire, et la
 * première occurrence renverrait l'input file du logo.
 */
function fieldAfter(page: Page, label: string, tag: 'input' | 'textarea'): Locator {
  return page.locator(
    `xpath=(//*[normalize-space(text())="${label}"])[last()]/following::${tag}[1]`
  )
}

async function openReportTab(page: Page): Promise<void> {
  await page.getByRole('button', { name: /^Report$/i }).first().click()
  await page.waitForTimeout(4000)
}

test('set up Scilicium report branding on the demo account', async ({ page }) => {
  // NEUTRALISÉ : le formulaire de branding n'émet AUCUN appel API au remplissage
  // (trace réseau à l'appui), donc rien n'est persisté et ce test échouera
  // toujours. À réactiver dès que la sauvegarde des UserReportSettings est
  // rebranchée côté frontend.
  test.skip(true, 'Le branding de rapport ne persiste pas — bug applicatif ouvert')

  test.setTimeout(300_000)
  expect(fs.existsSync(LOGO), `logo introuvable: ${LOGO}`).toBe(true)

  await page.goto(COMPARISON_URL, { waitUntil: 'networkidle' })
  await page.waitForTimeout(4000)
  await openReportTab(page)

  // Nom de l'institut. Pas d'adresse : je n'en connais pas de fiable, et une
  // adresse inventée dans un support commercial est pire qu'un champ vide.
  const name = fieldAfter(page, 'Institute name', 'input')
  await name.fill('Scilicium')
  await name.blur()
  await page.waitForTimeout(1500)

  const mm = fieldAfter(page, 'Default Material & Methods', 'textarea')
  if ((await mm.count()) > 0) {
    await mm.fill(MM_TEXT)
    await mm.blur()
    await page.waitForTimeout(1500)
  }

  const conclusion = fieldAfter(page, 'Default conclusion', 'textarea')
  if ((await conclusion.count()) > 0) {
    await conclusion.fill(CONCLUSION_TEXT)
    await conclusion.blur()
    await page.waitForTimeout(1500)
  }

  await page.locator('input[type="file"]').first().setInputFiles(LOGO)
  await page.waitForTimeout(5000)
  console.log('logo téléversé')

  // Aucun bouton d'enregistrement : on vérifie la persistance par rechargement.
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(5000)
  await openReportTab(page)

  await expect(fieldAfter(page, 'Institute name', 'input')).toHaveValue('Scilicium')
  console.log('✓ nom de l\'institut persisté')

  const savedMm = fieldAfter(page, 'Default Material & Methods', 'textarea')
  if ((await savedMm.count()) > 0) {
    const v = await savedMm.inputValue()
    console.log(v.includes('DESeq2') ? '✓ M&M persistés' : '⚠ M&M NON persistés')
  }
})
