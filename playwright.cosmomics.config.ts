import { defineConfig, devices } from '@playwright/test';

/**
 * Local visual checks of the CosmOmics nova, on the dev-only bench page
 * (/cosmomics-check) — no backend, no sign-in.
 *
 *   npx playwright test -c playwright.cosmomics.config.ts
 *   COSMOMICS_REAL_JSON=/path/to/nova.json npx playwright test -c playwright.cosmomics.config.ts
 *
 * Captures land in test-results/cosmomics/ (or $COSMOMICS_CAPTURE_DIR).
 */
export default defineConfig({
  testDir: './e2e-local',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000/cosmomics-check',
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
