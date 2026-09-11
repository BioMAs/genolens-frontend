/**
 * La barre de contexte.
 *
 * Elle affichait UN mot, dérivé de 19 `if` successifs — sur sept routes la même
 * chaîne que le `<h1>` de la page, sur les autres un nom générique. Elle porte
 * désormais un fil d'Ariane : la seule information que la page ne donne pas
 * elle-même, à savoir où l'on se situe et comment remonter.
 *
 * La garde de régression du `/docs/<slug>` est conservée : les règles `/docs`
 * avaient été ajoutées APRÈS un bloc de `includes()`, si bien qu'un slug de
 * guide contenant un mot-clé d'analyse était capté par la règle antérieure et
 * la page de documentation s'intitulait « Multi-Comparison ». La table de
 * routes doit rester à l'abri de cette classe d'erreur.
 */
import { render, screen, within } from '@testing-library/react';
import TopBar from '@/components/TopBar';

jest.mock('@/components/GlobalGeneSearch', () => ({
  __esModule: true,
  default: () => <div data-testid="gene-search" />,
}));

jest.mock('@/components/onboarding/HelpTourButton', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/components/MobileNavToggle', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('next/navigation', () => ({
  usePathname: jest.fn(),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { usePathname } = require('next/navigation');

/** Les libellés du fil d'Ariane, dans l'ordre. */
function trail(): string[] {
  const nav = screen.getByRole('navigation', { name: /breadcrumb/i });
  return within(nav)
    .getAllByRole('listitem')
    .map((li) => li.textContent?.trim() ?? '');
}

it('situe la documentation', () => {
  usePathname.mockReturnValue('/docs');
  render(<TopBar />);
  expect(trail()).toEqual(['Documentation']);
});

it('situe un guide sous la documentation, avec son nom', () => {
  // L'ancienne barre affichait « Guide » — un mot qui n'apprenait rien.
  usePathname.mockReturnValue('/docs/gsea');
  render(<TopBar />);
  expect(trail()).toEqual(['Documentation', 'Gsea']);
});

it("ne capte pas un slug de guide contenant un mot-clé d'analyse", () => {
  usePathname.mockReturnValue('/docs/multi-comparison');
  render(<TopBar />);
  expect(trail()).toEqual(['Documentation', 'Multi comparison']);
});

it("situe la page d'analyse elle-même sous son projet", () => {
  usePathname.mockReturnValue('/projects/p1/multi-comparison');
  render(<TopBar />);
  expect(trail()).toEqual(['Projects', 'Project', 'Multi-comparison']);
});

it('ne lie pas la page courante', () => {
  usePathname.mockReturnValue('/docs/gsea');
  render(<TopBar />);
  const nav = screen.getByRole('navigation', { name: /breadcrumb/i });
  expect(within(nav).queryByRole('link', { name: 'Gsea' })).not.toBeInTheDocument();
  expect(within(nav).getByRole('link', { name: 'Documentation' })).toHaveAttribute('href', '/docs');
});

it('replie les miettes du milieu au-delà de trois niveaux', () => {
  // Garde la racine et les deux dernières : ce sont elles qui portent
  // l'information. Sans repliement, un nom de comparaison long pousse la barre
  // hors de l'écran.
  usePathname.mockReturnValue('/projects/p1/analyses/a1/comparisons/KO_vs_WT');
  render(<TopBar />);
  const labels = trail();
  expect(labels[0]).toBe('Projects');
  expect(labels).toContain('…');
  expect(labels[labels.length - 1]).toBe('KO vs WT');
});
