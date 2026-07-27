/**
 * auth.capture.setup.ts
 * Authentification pour les captures commerciales.
 *
 * Volontairement séparé de e2e/auth.setup.ts : ce dernier est utilisé par la
 * suite CI et cible un ancien libellé de la page de login ("Sign in to
 * GenoLens"). On ne le modifie pas ici pour ne rien casser côté CI.
 *
 * Les identifiants viennent de .env.test.local et ne sont JAMAIS journalisés.
 */
import { test as setup, expect } from '@playwright/test'
import * as path from 'path'

const SESSION_FILE = path.resolve(__dirname, '../playwright/.auth/user.json')

setup('authenticate for capture', async ({ page }) => {
  const email = process.env.TEST_USER_EMAIL
  const password = process.env.TEST_USER_PASSWORD

  if (!email || !password) {
    throw new Error(
      'TEST_USER_EMAIL / TEST_USER_PASSWORD absents de .env.test.local — ' +
        'impossible de capturer sans le compte démo.'
    )
  }

  // Garde-fou : on refuse de capturer avec un compte autre que le compte démo,
  // pour ne pas photographier des projets clients.
  if (!/^demo/i.test(email)) {
    throw new Error(
      `Compte de capture inattendu: "${email}". ` +
        'Les captures commerciales doivent utiliser le compte démo.'
    )
  }

  // La page de login est la page d'accueil.
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible({
    timeout: 20_000,
  })

  await page.locator('#email').fill(email)
  await page.locator('#password').fill(password)
  await page.getByRole('button', { name: /^sign in$/i }).click()

  // Succès = redirection vers le dashboard. En cas d'échec Supabase, le
  // formulaire affiche une erreur et l'URL ne change pas : on veut échouer vite.
  await page.waitForURL(/\/dashboard/, { timeout: 45_000 })

  // ── Neutralisation des visites guidées driver.js ────────────────────────
  // Elles s'auto-lancent à la première visite et posent un calque par-dessus
  // l'écran : inexploitable en capture. Les ids viennent de
  // src/lib/tours/registry.ts, le format de clé de src/lib/tours/storage.ts.
  // On balaie plusieurs versions pour qu'un bump de version ne réintroduise
  // pas silencieusement le calque.
  const TOUR_IDS = ['dashboard', 'project-overview', 'analyses']
  await page.evaluate((ids) => {
    for (const id of ids) {
      for (let v = 1; v <= 5; v++) {
        try {
          window.localStorage.setItem(`genolens.tour.${id}.v${v}`, '1')
        } catch {
          /* mode privé : on ignore */
        }
      }
    }
  }, TOUR_IDS)

  await page.context().storageState({ path: SESSION_FILE })
  console.log(`Session sauvegardée pour ${email} (visites guidées neutralisées)`)
})
