/**
 * auth.capture.setup.ts
 * Authentification pour les captures commerciales.
 *
 * Volontairement séparé de e2e/auth.setup.ts : ce dernier est utilisé par la
 * suite CI et cible un ancien libellé de la page de login ("Sign in to
 * GenoLens"). On ne le modifie pas ici pour ne rien casser côté CI.
 *
 * La connexion se fait en deux temps : mot de passe, puis code à 6 chiffres de
 * l'application d'authentification. Le code est calculé ici à partir du secret
 * TOTP du compte démo (TEST_USER_TOTP_SECRET), comme le ferait l'application.
 *
 * Les identifiants et le secret TOTP viennent de .env.test.local et ne sont
 * JAMAIS journalisés.
 */
import { test as setup, expect } from '@playwright/test'
import { authenticator } from 'otplib'
import * as path from 'path'

const SESSION_FILE = path.resolve(__dirname, '../playwright/.auth/user.json')

setup('authenticate for capture', async ({ page }) => {
  const email = process.env.TEST_USER_EMAIL
  const password = process.env.TEST_USER_PASSWORD
  // Le secret est saisi tel qu'affiché à l'enrôlement, souvent groupé par blocs.
  const totpSecret = process.env.TEST_USER_TOTP_SECRET?.replace(/\s+/g, '')

  if (!email || !password) {
    throw new Error(
      'TEST_USER_EMAIL / TEST_USER_PASSWORD absents de .env.test.local — ' +
        'impossible de capturer sans le compte démo.'
    )
  }

  // La double authentification est obligatoire : sans le secret, la connexion
  // s'arrêterait à l'étape du code. On échoue d'emblée, sans rien afficher du secret.
  if (!totpSecret) {
    throw new Error(
      'TEST_USER_TOTP_SECRET absent de .env.test.local — la connexion exige ' +
        "un code d'authentification, impossible de capturer sans le secret TOTP du compte démo."
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

  // Étape du code. Si elle n'apparaît pas, soit le mot de passe est refusé (le
  // formulaire affiche une erreur), soit le compte n'a pas encore de 2FA et
  // l'API envoie vers l'enrôlement : dans les deux cas on veut échouer vite.
  const codeField = page.getByTestId('auth-code')
  await expect(
    codeField,
    "L'étape du code n'est pas apparue : mot de passe refusé, ou compte démo sans 2FA enrôlée."
  ).toBeVisible({ timeout: 30_000 })

  await codeField.fill(authenticator.generate(totpSecret))
  await page.getByTestId('auth-mfa-submit').click()

  // Succès = redirection vers le dashboard. Si le code est refusé, le
  // formulaire affiche une erreur et l'URL ne change pas.
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
