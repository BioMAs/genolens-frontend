import { defineConfig, devices } from '@playwright/test'
import * as dotenv from 'dotenv'

// override:false => une variable déjà présente dans l'environnement gagne
// sur le fichier. C'est ce qui permet de forcer la cible depuis la ligne de
// commande sans toucher au .env.test.local.
dotenv.config({ path: '.env.test.local', override: false })
dotenv.config({ path: '.env.local', override: false })

// Capture commerciale : la prod, jamais localhost.
// La preprod est verrouillée par la protection de déploiement Vercel (302 vers
// vercel.com/sso-api) et sa branche a ~2 mois de retard : la prod sert en fait
// l'interface la plus récente.
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'https://app.genolens.com'

export default defineConfig({
  testDir: './e2e-capture',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: BASE_URL,
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 2,
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
  },
  projects: [
    {
      name: 'setup',
      testMatch: /auth\.capture\.setup\.ts/,
    },
    {
      name: 'capture',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
        deviceScaleFactor: 2,
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],
  globalSetup: require.resolve('./e2e/global.setup.ts'),
})
