/**
 * probe.spec.ts — sonde de diagnostic rapide (~15 s).
 * Vérifie l'état de provisionnement du compte de capture : plan, add-ons,
 * accès au projet DEMO. À relancer après toute modification côté admin.
 */
import { test } from '@playwright/test'

const P = '3a39cc1a-0689-4806-86ef-3847dfcf560b'

test('probe: capture account provisioning state', async ({ page }) => {
  test.setTimeout(120_000)

  await page.goto('/profile', { waitUntil: 'networkidle' })
  await page.waitForTimeout(3000)
  const profile = (await page.locator('body').innerText()).trim()

  const plan = profile.match(/Current Plan\s*\n\s*(.+)/)?.[1]?.trim() ?? '(introuvable)'
  const ai = profile.match(/AI Interpretations\s*\n\s*(.+)/)?.[1]?.trim() ?? '(introuvable)'
  const skinLocked = /Skin claims[\s\S]{0,200}?Request access/i.test(profile)
  const reportLocked = /Reporting[\s\S]{0,200}?Request access/i.test(profile)

  console.log('\n===== PROVISIONNEMENT =====')
  console.log(`Plan            : ${plan}`)
  console.log(`AI              : ${ai}`)
  console.log(`Skin claims     : ${skinLocked ? 'VERROUILLE' : 'Active'}`)
  console.log(`Reporting       : ${reportLocked ? 'VERROUILLE' : 'Active'}`)

  // L'onglet AI Assistant est le juge de paix : c'est lui qui porte la slide 9.
  await page.goto(`/projects/${P}/comparisons/Time%2040_vs_Time%200`, {
    waitUntil: 'networkidle',
  })
  await page.waitForTimeout(4000)
  await page.getByRole('button', { name: /^AI Assistant$/i }).first().click()
  await page.waitForTimeout(4000)
  const aiPane = (await page.locator('body').innerText()).trim()
  const aiBlocked = /not included in this plan|upgrade|locked|request access/i.test(aiPane)
  console.log(`Onglet AI       : ${aiBlocked ? 'BLOQUE (message de restriction)' : 'accessible'}`)
  console.log('--- extrait du panneau AI (400 car.) ---')
  console.log(aiPane.slice(-400))
})
