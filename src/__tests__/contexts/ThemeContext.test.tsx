/**
 * Le thème, et l'hydratation.
 *
 * `ThemeProvider` initialisait son état en lisant `localStorage` et
 * `prefers-color-scheme` dès le premier rendu. Côté serveur ces deux sources
 * n'existent pas : le serveur rendait donc toujours la branche « light » et le
 * client hydratait en « dark » pour un utilisateur en thème sombre. React
 * signalait l'écart à `Sidebar.tsx:245` — le bouton de thème, icône Lune
 * contre Soleil et le `title` avec — et régénérait le sous-arbre, sur chaque
 * page authentifiée.
 *
 * Le test central de ce fichier fait donc une VRAIE hydratation :
 * `renderToString` puis `hydrateRoot` sur le HTML obtenu, avec un thème sombre
 * en réserve. Un `render()` simple ne prouverait rien — il monte côté client,
 * où `useSyncExternalStore` lit directement l'instantané client et où l'écart
 * ne peut pas se produire.
 *
 * La couleur ne clignote pas malgré ce premier rendu en « light » : un script
 * inline placé en tête du `<body>` par le layout pose la classe `dark` avant
 * le premier paint. Séparation testée ici : l'état React est déterministe, la
 * classe CSS est posée hors de React.
 */
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';

import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';

/** Reproduit la forme du bouton de thème de la sidebar, source de l'écart. */
function ThemedButton() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
      data-testid="probe"
    >
      <span>{theme === 'light' ? 'moon-icon' : 'sun-icon'}</span>
      <span>{theme}</span>
    </button>
  );
}

function mockPrefersDark(dark: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: dark && query.includes('dark'),
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove('dark');
  mockPrefersDark(false);
});

// ── le test central ────────────────────────────────────────────────────────

it('hydrate sans ecart alors que le theme stocke contredit le rendu serveur', async () => {
  localStorage.setItem('theme', 'dark');

  const tree = (
    <ThemeProvider>
      <ThemedButton />
    </ThemeProvider>
  );

  // Ce que le serveur produit : la branche claire, faute d'acces au navigateur.
  const html = renderToString(tree);
  expect(html).toContain('Switch to dark mode');
  expect(html).toContain('moon-icon');

  const container = document.createElement('div');
  container.innerHTML = html;
  document.body.appendChild(container);

  const seen: string[] = [];
  const spy = jest.spyOn(console, 'error').mockImplementation((...args) => {
    seen.push(args.map((a) => (a instanceof Error ? a.message : String(a))).join(' '));
  });

  await act(async () => {
    hydrateRoot(container, tree);
  });

  spy.mockRestore();

  expect(seen.filter((m) => /hydrat|did not match|server rendered/i.test(m))).toEqual([]);
  // Et le thème réel est bien adopté juste apres.
  expect(container.textContent).toContain('sun-icon');

  container.remove();
});

// ── comportement une fois monté ────────────────────────────────────────────

it('adopte le theme stocke', () => {
  localStorage.setItem('theme', 'dark');

  render(
    <ThemeProvider>
      <ThemedButton />
    </ThemeProvider>
  );

  expect(screen.getByTestId('probe')).toHaveTextContent('dark');
});

it('suit la preference systeme quand rien n\'est stocke', () => {
  mockPrefersDark(true);

  render(
    <ThemeProvider>
      <ThemedButton />
    </ThemeProvider>
  );

  expect(screen.getByTestId('probe')).toHaveTextContent('dark');
});

it('reste en clair quand rien n\'est stocke et que le systeme est clair', () => {
  render(
    <ThemeProvider>
      <ThemedButton />
    </ThemeProvider>
  );

  expect(screen.getByTestId('probe')).toHaveTextContent('light');
  expect(document.documentElement.classList.contains('dark')).toBe(false);
});

it('bascule, persiste et pose la classe sans attendre un rendu', async () => {
  const user = userEvent.setup();

  render(
    <ThemeProvider>
      <ThemedButton />
    </ThemeProvider>
  );

  await user.click(screen.getByTestId('probe'));

  expect(screen.getByTestId('probe')).toHaveTextContent('dark');
  expect(localStorage.getItem('theme')).toBe('dark');
  expect(document.documentElement.classList.contains('dark')).toBe(true);
});

it('ne touche pas a la classe lors de la premiere passe', () => {
  // Le script inline a deja pose la classe avant le premier paint. Si le
  // fournisseur la synchronisait des sa premiere passe d'effet, il l'effacerait
  // le temps d'une frame — le flash de theme clair que tout ce dispositif
  // existe pour supprimer.
  localStorage.setItem('theme', 'dark');
  document.documentElement.classList.add('dark');

  render(
    <ThemeProvider>
      <ThemedButton />
    </ThemeProvider>
  );

  expect(document.documentElement.classList.contains('dark')).toBe(true);
});
