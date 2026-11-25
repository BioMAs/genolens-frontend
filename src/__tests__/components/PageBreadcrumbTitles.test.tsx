/**
 * Le fil d'Ariane, en tête du contenu de la page.
 *
 * Il vivait dans la barre de contexte, qui affichait UN mot dérivé de 19 `if`
 * successifs — sur sept routes la même chaîne que le `<h1>` de la page, sur les
 * autres un nom générique. La barre du haut n'a plus de contexte à porter (elle
 * porte la marque, les destinations, la recherche et le compte) : le fil
 * d'Ariane est la première ligne de `main`, juste au-dessus du titre de page. Il
 * donne la seule information que la page ne donne pas elle-même, à savoir où l'on
 * se situe et comment remonter.
 *
 * La garde de régression du `/docs/<slug>` est conservée : les règles `/docs`
 * avaient été ajoutées APRÈS un bloc de `includes()`, si bien qu'un slug de
 * guide contenant un mot-clé d'analyse était capté par la règle antérieure et
 * la page de documentation s'intitulait « Multi-Comparison ». La table de
 * routes doit rester à l'abri de cette classe d'erreur.
 */
import { render, screen, within } from '@testing-library/react';
import PageBreadcrumb from '@/components/shell/PageBreadcrumb';

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
  render(<PageBreadcrumb />);
  expect(trail()).toEqual(['Documentation']);
});

it('situe un guide sous la documentation, avec son nom', () => {
  // L'ancienne barre affichait « Guide » — un mot qui n'apprenait rien.
  usePathname.mockReturnValue('/docs/gsea');
  render(<PageBreadcrumb />);
  expect(trail()).toEqual(['Documentation', 'Gsea']);
});

it("ne capte pas un slug de guide contenant un mot-clé d'analyse", () => {
  usePathname.mockReturnValue('/docs/multi-comparison');
  render(<PageBreadcrumb />);
  expect(trail()).toEqual(['Documentation', 'Multi comparison']);
});

it("situe la page d'analyse elle-même sous son projet", () => {
  usePathname.mockReturnValue('/projects/p1/multi-comparison');
  render(<PageBreadcrumb />);
  expect(trail()).toEqual(['Projects', 'Project', 'Multi-comparison']);
});

it('ne lie pas la page courante', () => {
  usePathname.mockReturnValue('/docs/gsea');
  render(<PageBreadcrumb />);
  const nav = screen.getByRole('navigation', { name: /breadcrumb/i });
  expect(within(nav).queryByRole('link', { name: 'Gsea' })).not.toBeInTheDocument();
  expect(within(nav).getByRole('link', { name: 'Documentation' })).toHaveAttribute('href', '/docs');
});

it('replie les miettes du milieu au-delà de trois niveaux', () => {
  // Garde la racine et les deux dernières : ce sont elles qui portent
  // l'information. Sans repliement, un nom de comparaison long pousse la barre
  // hors de l'écran.
  usePathname.mockReturnValue('/projects/p1/analyses/a1/comparisons/KO_vs_WT');
  render(<PageBreadcrumb />);
  const labels = trail();
  expect(labels[0]).toBe('Projects');
  expect(labels).toContain('…');
  expect(labels[labels.length - 1]).toBe('KO vs WT');
});

describe('la ligne du fil d’Ariane', () => {
  it('prend la piste que la page déclare, avec le vrai nom de l’objet', () => {
    const { BreadcrumbProvider, useSetBreadcrumb } = jest.requireActual('@/contexts/BreadcrumbContext');
    function Page() {
      useSetBreadcrumb([{ label: 'Projects', href: '/projects' }, { label: 'Skin Study' }]);
      return null;
    }
    usePathname.mockReturnValue('/projects/p1');
    render(
      <BreadcrumbProvider>
        <PageBreadcrumb />
        <Page />
      </BreadcrumbProvider>,
    );
    expect(trail()).toEqual(['Projects', 'Skin Study']);
  });

  it('ne rend rien, pas même une ligne vide, quand la page déclare une piste vide', () => {
    const { BreadcrumbProvider, useSetBreadcrumb } = jest.requireActual('@/contexts/BreadcrumbContext');
    function Page() {
      useSetBreadcrumb([]);
      return null;
    }
    usePathname.mockReturnValue('/projects/p1');
    const { container } = render(
      <BreadcrumbProvider>
        <PageBreadcrumb />
        <Page />
      </BreadcrumbProvider>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('s’aligne sur la page qu’il surplombe : sa mesure et ses gouttières, pas celles de la barre', () => {
    usePathname.mockReturnValue('/docs');
    render(<PageBreadcrumb />);
    const row = screen.getByRole('navigation', { name: /breadcrumb/i }).parentElement as HTMLElement;
    // Les memes jetons que `.page-container` : le bord gauche du fil est celui du titre.
    expect(row).toHaveClass('mx-auto', 'w-full', 'max-w-[var(--measure-default)]', 'px-[var(--page-gutter)]');
    expect(row).not.toHaveClass('max-w-[1360px]');
    expect(row).not.toHaveClass('md:px-10');
  });

  it('ramène le TEXTE de la première miette au bord du titre, pas sa boîte', () => {
    // Chaque miette porte `px-1` (la bague de focus a besoin de respirer) : sans
    // la marge negative de la liste, le texte du fil serait a 4px de celui du titre.
    usePathname.mockReturnValue('/docs');
    render(<PageBreadcrumb />);
    const list = screen.getByRole('navigation', { name: /breadcrumb/i }).querySelector('ol') as HTMLElement;
    expect(list).toHaveClass('-ml-1');
  });
});
