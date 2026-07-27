/** probe.spec.ts — le formulaire de branding envoie-t-il un appel API ? */
import { test } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const r = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../marketing/demo-routes.json'), 'utf-8')
) as { projectId: string; comparisonName: string }

test('probe: report settings persistence network trace', async ({ page }) => {
  test.setTimeout(240_000)

  page.on('request', (req) => {
    if (/report|setting|branding|user/i.test(req.url()) && req.method() !== 'GET') {
      console.log(`>>> ${req.method()} ${req.url()}`)
      const d = req.postData()
      if (d) console.log(`    body: ${d.slice(0, 200)}`)
    }
  })
  page.on('response', async (res) => {
    if (/report|setting|branding/i.test(res.url()) && res.request().method() !== 'GET') {
      console.log(`<<< ${res.status()} ${res.url()}`)
      if (!res.ok()) console.log(`    ${(await res.text().catch(() => '')).slice(0, 250)}`)
    }
  })

  await page.goto(`/projects/${r.projectId}/comparisons/${r.comparisonName}`, {
    waitUntil: 'networkidle',
  })
  await page.waitForTimeout(4000)
  await page.getByRole('button', { name: /^Report$/i }).first().click()
  await page.waitForTimeout(4000)

  const name = page.locator(
    'xpath=(//*[normalize-space(text())="Institute name"])[last()]/following::input[1]'
  )
  console.log('--- remplissage du champ ---')
  await name.fill('Scilicium')
  await name.blur()
  await page.waitForTimeout(8000)
  console.log(`valeur en mémoire: "${await name.inputValue()}"`)
  console.log('--- fin (aucun appel ci-dessus = pas de sauvegarde) ---')
})
