# Tests - GenoLens Frontend

## Vue d'ensemble

Le frontend utilise deux frameworks de tests :
- **Jest + React Testing Library** pour les tests unitaires et d'intégration
- **Playwright** pour les tests end-to-end (E2E)

---

## Scripts npm

```bash
# Unit tests (Jest)
npm test

# Tests en mode watch
npm run test:watch

# Rapport de couverture
npm run test:coverage

# E2E tests (Playwright)
npm run e2e

# E2E with headed browser
npm run e2e:headed

# Voir le rapport E2E
npm run e2e:report
```

---

## Tests Unitaires (Jest + React Testing Library)

### Configuration

Fichiers de config :
- `jest.config.js` ou configuration inline dans `package.json`
- `ts-jest` pour le support TypeScript
- `jest-environment-jsdom` pour l'environnement DOM

### Structure des tests

```
frontend/
├── src/
│   ├── hooks/__tests__/          # Tests des hooks
│   │   ├── useProjects.test.tsx
│   │   ├── useDatasets.test.tsx
│   │   └── ...
│   ├── components/__tests__/     # Tests des composants
│   │   ├── VolcanoPlot.test.tsx
│   │   ├── DEGTable.test.tsx
│   │   └── ...
│   ├── utils/__mocks__/          # Mocks pour les tests
│   │   └── api.ts              # Mock du client API
│   ├── test-utils/               # Doublures partagées (ce ne sont pas des tests)
│   │   ├── authResults.ts      # authOk / authRefused : résultats des appels d'auth
│   │   ├── fetchDoubles.ts     # fetch global simulé (flux SSE, renouvellement)
│   │   └── downloads.ts        # Fichiers remis au navigateur
│   └── __tests__/                # Tests généraux (app, middleware, utils/auth...)
```

Les doublures de `src/test-utils/` ne s'appellent pas `use*` et vivent hors de `__tests__` : Jest ne doit pas les prendre pour des tests, et la règle de lint des hooks ne doit pas les prendre pour des hooks.

### Pattern de test pour les hooks

```tsx
// hooks/__tests__/useProjects.test.tsx
import { renderHook, waitFor } from '@testing-library/react';
import { useProjects } from '../useProjects';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';

describe('useProjects', () => {
  const wrapper = ({ children }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );

  it('returns projects when API succeeds', async () => {
    const { result } = renderHook(() => useProjects(), { wrapper });
    
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    
    expect(result.current.data).toHaveLength(3);
    expect(result.current.data[0].name).toBeDefined();
  });

  it('handles error state', async () => {
    // Mock API error...
  });
});
```

### Pattern de test pour les composants

```tsx
// components/__tests__/DEGTable.test.tsx
import { render, screen } from '@testing-library/react';
import DEGTable from '../DEGTable';

describe('DEGTable', () => {
  const mockData = [
    { gene: 'TP53', log2fc: 2.5, pvalue: 0.001 },
    { gene: 'BRCA1', log2fc: -1.8, pvalue: 0.05 },
  ];

  it('renders the table with data', () => {
    render(<DEGTable data={mockData} />);
    
    expect(screen.getByText('TP53')).toBeInTheDocument();
    expect(screen.getByText('+2.5')).toBeInTheDocument();
  });

  it('shows loading skeleton when isLoading is true', () => {
    render(<DEGTable data={[]} isLoading />);
    
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });
});
```

### Mock de l'API

```typescript
// utils/__mocks__/api.ts
export default {
  get: jest.fn().mockResolvedValue({ data: [] }),
  post: jest.fn().mockResolvedValue({ data: {} }),
  patch: jest.fn().mockResolvedValue({ data: {} }),
  delete: jest.fn().mockResolvedValue({ data: {} }),
};

// Utilisation dans les tests
import api from '@/utils/__mocks__/api';

(api.get as jest.Mock).mockResolvedValueOnce({
  data: { items: [{ id: '1', name: 'Test Project' }] },
});
```

### Tests de l'authentification

L'authentification n'a pas de client tiers à simuler : la session est portée par des cookies que l'API pose, et le code passe par trois points d'entrée que les tests remplacent.

**1. Les appels d'avant session** (`login`, `verifyMfa`, `signup`, `forgotPassword`...) viennent de `@/utils/auth/client` et retournent un `AuthResult` : un refus est une valeur, pas une exception. Un test de page mocke le module et scénarise les réponses avec `authOk` et `authRefused` de `@/test-utils/authResults` :

```tsx
import { login } from '@/utils/auth/client';
import { authOk, authRefused } from '@/test-utils/authResults';

jest.mock('@/utils/auth/client', () => ({ login: jest.fn(), verifyMfa: jest.fn() }));

const loginMock = login as jest.MockedFunction<typeof login>;

loginMock.mockResolvedValueOnce(authOk({ next: 'mfa' }));
// Un refus de l'API, avec ce que son corps porte en plus du code :
loginMock.mockResolvedValueOnce(authRefused(401, 'invalid_credentials'));
// Un code refusé : `attempts_left` rejoint le corps
verifyMfaMock.mockResolvedValueOnce(authRefused(401, 'invalid_code', { attempts_left: 2 }));
// API injoignable : statut 0 et `detail` nul
loginMock.mockResolvedValueOnce(authRefused(0, null));
```

**2. La navigation complète** passe par `@/utils/auth/navigation` (`navigate`, `replaceLocation`). jsdom 26 ne sait ni observer ni suivre `window.location.assign`, et `window.location` ne peut pas y être remplacé : les tests mockent donc ce module et vérifient ses appels, jamais `window.location` :

```tsx
import { navigate } from '@/utils/auth/navigation';

jest.mock('@/utils/auth/navigation', () => ({ navigate: jest.fn() }));

expect(navigate).toHaveBeenCalledWith('/dashboard');
```

**3. Le transport** a deux doublures. L'instance axios (`src/utils/api.ts`) se teste avec un adaptateur `jest.fn` à la place du réseau, `refreshSession` et `navigate` remplacés (voir `src/__tests__/utils/api.test.ts`). Pour le code qui appelle `fetch` (les flux SSE du chat IA passent par `authedFetch`), `installFakeFetch` de `@/test-utils/fetchDoubles` remplace le `fetch` global le temps de chaque test et fournit les réponses (`refusal`, `refreshed`, `sseResponse`) : le vrai `authedFetch` s'exécute dessus, ce qui prouve qu'une session est renouvelée et l'appel rejoué.

**Le middleware et la vérification du jeton** tournent hors DOM (`/** @jest-environment node */` en tête de fichier) :
- `src/__tests__/middleware.test.ts` simule `verifyAccessToken` : ce qui est testé, c'est la décision et son ordre (session, renouvellement, connexion, `reauth=1`, `safeNext`).
- `src/__tests__/utils/auth/jwt.test.ts` signe de vrais jetons ES256 avec `jose` (`generateKeyPair`, `createLocalJWKSet`) et vérifie signature, `iss`, `aud`, expiration et `amr`.

Les valeurs de test restent fictives : adresses en `@example.test`, origines `https://…example.test`, jamais de vrai compte ni de secret.

---

## Tests E2E (Playwright)

### Configuration

Fichier : `playwright.config.ts`

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  
  use: {
    baseURL: 'http://localhost:3000',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
```

### Structure des tests E2E

```
frontend/
├── e2e/
│   ├── auth.spec.ts          # Tests d'authentification
│   ├── projects.spec.ts      # Tests de gestion de projets
│   ├── analyses.spec.ts      # Tests d'analyses bioinformatiques
│   └── ...
```

### Se connecter dans un test E2E

La connexion se fait en deux étapes : e-mail et mot de passe, puis un code à 6 chiffres de l'application d'authentification (la double authentification est obligatoire). Un test E2E calcule ce code à partir du secret TOTP du compte de test, avec `otplib` (v12, en dépendance de développement) :

```typescript
// e2e/helpers.ts
import { expect, type Page } from '@playwright/test';
import { authenticator } from 'otplib';

export async function signIn(page: Page) {
  const secret = process.env.TEST_USER_TOTP_SECRET;
  if (!secret) throw new Error('TEST_USER_TOTP_SECRET absent de .env.test.local');

  await page.goto('/');
  await page.getByTestId('auth-email').fill(process.env.TEST_USER_EMAIL!);
  await page.getByTestId('auth-password').fill(process.env.TEST_USER_PASSWORD!);
  await page.getByTestId('auth-submit').click(); // étape du mot de passe

  await page.getByTestId('auth-code').fill(authenticator.generate(secret));
  await page.getByTestId('auth-mfa-submit').click(); // étape du code

  await expect(page).toHaveURL(/\/dashboard/);
}
```

Les identifiants de test (`TEST_USER_EMAIL`, `TEST_USER_PASSWORD`, `TEST_USER_TOTP_SECRET`) sont lus dans `.env.test.local` (modèle : `.env.test.local.example`), jamais versionnés ni journalisés. `e2e-capture/auth.capture.setup.ts` fait exactement cela pour les captures commerciales et échoue d'emblée, avec un message clair, si le secret TOTP est absent ; le compte doit déjà avoir enrôlé sa double authentification (sinon la connexion mène à `/auth/2fa/setup` et l'étape du code n'apparaît pas).

Le secret TOTP est la clé en base32 affichée à l'enrôlement.

### Exemple de test E2E

```typescript
// e2e/auth.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('should display login page', async ({ page }) => {
    await page.goto('/');
    
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    await expect(page.getByLabel('Email address')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
  });

  test('should login successfully', async ({ page }) => {
    await signIn(page); // voir « Se connecter dans un test E2E »

    await expect(page).toHaveURL(/\/dashboard/);
  });
});

// e2e/projects.spec.ts
test.describe('Projects', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await signIn(page);
  });

  test('should create a new project', async ({ page }) => {
    await page.goto('/projects');
    
    await page.getByRole('button', { name: 'Create Project' }).click();
    await page.getByLabel('Project Name').fill('Test Project');
    await page.getByRole('button', { name: 'Create' }).click();
    
    await expect(page.getByText('Test Project')).toBeVisible();
  });

  test('should upload a dataset', async ({ page }) => {
    await page.goto('/projects/test-project-id/datasets');
    
    const fileChooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Upload' }).click();
    await fileChooser.setFiles('tests/fixtures/sample.csv');
    
    await expect(page.getByText('Processing')).toBeVisible();
  });
});
```

### Fixtures pour les tests

```typescript
// e2e/fixtures.ts
import { test as base } from '@playwright/test';

export const test = base.extend({
  // Préparer un utilisateur de test
  user: async ({ page }, use) => {
    await signIn(page);
    await use(null); // No return value needed
  },

  // Nettoyer après les tests
  cleanup: async ({}, use) => {
    yield;
    // Cleanup logic (delete test data, etc.)
  },
});
```

---

## Stratégie de couverture

### Objectifs de couverture

| Zone | Cible | Priorité |
|---|---|---|
| Hooks (data fetching) | 80%+ | Haute |
| Composants UI critiques | 70%+ | Haute |
| Utils/Helpers | 90%+ | Moyenne |
| Visualisations complexes | 50%+ | Basse |

### Commande de couverture

```bash
# Générer le rapport HTML
npm run test:coverage

# Le rapport est disponible dans coverage/lcov-report/index.html
```

---

## Tests des visualisations scientifiques

Les plots (Volcano, PCA, UMAP, Heatmap) sont difficiles à tester unitairement. Stratégie :

### 1. Tester les données transformées

```tsx
// hooks/__tests__/useDegData.test.tsx
it('transforms DEG data correctly for volcano plot', () => {
  const mockDeg = [
    { gene: 'TP53', log2fc: 2.5, pvalue: 0.001 },
    { gene: 'BRCA1', log2fc: -1.8, pvalue: 0.05 },
  ];
  
  const transformed = transformForVolcanoPlot(mockDeg);
  
  expect(transformed).toEqual([
    { x: 2.5, y: 3.0, gene: 'TP53', significant: true },
    { x: -1.8, y: 1.3, gene: 'BRCA1', significant: false },
  ]);
});
```

### 2. Tests E2E sur les plots

```typescript
// e2e/visualizations.spec.ts
test('volcano plot renders correctly', async ({ page }) => {
  await page.goto('/projects/test-id/analyses');
  
  // Vérifier que le plot est rendu (canvas ou SVG)
  const volcanoPlot = page.locator('[data-testid="volcano-plot"]');
  await expect(volcanoPlot).toBeVisible();
  
  // Vérifier les points de données
  const dataPoints = volcanoPlot.locator('.point');
  await expect(dataPoints.first()).toBeVisible();
});
```

### 3. Snapshot testing (optionnel)

```tsx
import { render } from '@testing-library/react';
import VolcanoPlot from '../VolcanoPlot';

it('matches snapshot', () => {
  const { container } = render(<VolcanoPlot data={mockData} />);
  expect(container.firstChild).toMatchSnapshot();
});
```

---

## CI/CD Integration

### GitHub Actions pour les tests

```yaml
# .github/workflows/frontend-ci.yml
name: Frontend CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run unit tests
        run: npm test -- --coverage
      
      - name: Upload coverage
        uses: codecov/codecov-action@v4

  e2e:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Install Playwright browsers
        run: npx playwright install --with-deps
      
      - name: Start dev server
        run: npm run dev &
        
      - name: Run E2E tests
        run: npm run e2e
```

---

## Bonnes pratiques

### 1. Tester les états de chargement et d'erreur

```tsx
it('shows error message when API fails', async () => {
  (api.get as jest.Mock).mockRejectedValueOnce(new Error('API Error'));
  
  const { result, waitFor } = renderHook(() => useProjects(), { wrapper });
  
  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(result.current.error?.message).toBe('API Error');
});
```

### 2. Tester les mutations avec onMutate/onSuccess/onError

```tsx
it('invalidates queries on successful mutation', async () => {
  const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
  
  await mutation.mutateAsync(data);
  
  expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['projects'] });
});
```

### 3. Utiliser `waitFor` pour les asynchrones

```tsx
const { result } = renderHook(() => useProjects(), { wrapper });

// Attendre que le loading soit terminé
await waitFor(() => expect(result.current.isLoading).toBe(false));

expect(result.current.data).toBeDefined();
```

### 4. Mock uniquement ce qui est nécessaire

```tsx
// Ne pas remplacer tout le module d'auth : garder le vrai code, ne simuler que l'appel réseau
jest.mock('@/utils/auth/client', () => ({
  ...jest.requireActual('@/utils/auth/client'),
  refreshSession: jest.fn(),
}));
```

---

## Debugging des tests

### Logs de test

```bash
# Voir les logs détaillés
npm test -- --verbose

# Reporter en mode TAP
npm test -- --reporter tap
```

### Playwright debug

```bash
# Ouvrir le UI de debug
npx playwright test --debug

# Exécuter un seul test dans le browser
npx playwright test auth.spec.ts --headed

# Voir les traces d'échec
npx playwright show-trace
```

### Common issues

| Problème | Solution |
|---|---|
| `Timeout - async callback not invoked` | Utiliser `waitFor` au lieu de `expect` direct |
| `Element not found` | Vérifier le selector, utiliser `getByRole`, `getByText` |
| `Network error in tests` | Mock correctement l'API ou utiliser un serveur mock |
| `Hydration mismatch` | Vérifier Server/Client components |
