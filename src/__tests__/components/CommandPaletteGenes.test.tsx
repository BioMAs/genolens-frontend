/**
 * Le groupe « Genes » de la palette de commandes.
 *
 * Il affichait, pour n'importe quel texte de deux lettres, ce texte en majuscules
 * comme s'il s'agissait d'un gene trouve — le backend comparait la saisie aux noms
 * de datasets — et le lien ouvrait une page qui ignorait `?gene`. Ces tests fixent
 * le contrat inverse : une ligne par gene REEL, qui dit ou il a ete trouve et dans
 * quel sens il varie, un lien qui ouvre sa fiche, et un « aucun gene » honnete.
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import CommandPalette from '@/components/command/CommandPalette';
import { closeCommandPalette, openCommandPalette } from '@/components/command/commandPaletteStore';
import type { GeneSearchResult } from '@/types/gene-search';

const push = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: jest.fn(), prefetch: jest.fn() }),
  usePathname: () => '/dashboard',
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock('@/hooks/useProjects', () => ({
  useProjects: () => ({ data: { items: [] } }),
}));
jest.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light', toggleTheme: jest.fn() }),
}));
jest.mock('@/contexts/chartPrefs', () => ({
  useChartPrefs: () => ({ colorblind: false }),
  toggleColorblind: jest.fn(),
}));
jest.mock('@/contexts/TourContext', () => ({
  useTour: () => ({ restartCurrentTour: jest.fn(), currentTourId: null }),
}));

const TP53_IN_ANALYSIS: GeneSearchResult = {
  gene_id: 'ENSG00000141510',
  gene_symbol: 'TP53',
  project_id: 'p-skin',
  project_name: 'Skin atlas',
  dataset_id: 'd-1',
  analysis_id: 'a-1',
  analysis_name: 'DESeq2 run',
  comparison_name: 'KO vs WT',
  log_fc: 2.5,
  padj: 0.000001,
  regulation: 'UP',
  exact: true,
};

const TP53_UPLOADED: GeneSearchResult = {
  ...TP53_IN_ANALYSIS,
  project_id: 'p-liver',
  project_name: 'Liver (shared)',
  dataset_id: 'd-2',
  analysis_id: null,
  analysis_name: null,
  comparison_name: 'Drug_vs_Vehicle',
  log_fc: -1.25,
  padj: 0.02,
  regulation: 'DOWN',
};

/** Ce que renverrait le backend, par requete. */
let backend: Record<string, GeneSearchResult[]> = {};
let backendFails = false;
const useGeneSearch = jest.fn();

jest.mock('@/hooks/useGeneSearch', () => ({
  useGeneSearch: (params: { query: string; enabled?: boolean; limit?: number }) =>
    useGeneSearch(params),
}));

function fakeGeneSearch({ query, enabled }: { query: string; enabled?: boolean }) {
  if (!enabled) return { data: undefined, isError: false };
  if (backendFails) return { data: undefined, isError: true };
  if (!(query in backend)) return { data: undefined, isError: false }; // en vol
  return { data: { query, results: backend[query], total: backend[query].length }, isError: false };
}

beforeEach(() => {
  jest.useFakeTimers();
  push.mockClear();
  useGeneSearch.mockReset();
  useGeneSearch.mockImplementation(fakeGeneSearch);
  backend = {};
  backendFails = false;
  act(() => openCommandPalette());
});

afterEach(() => {
  act(() => closeCommandPalette());
  jest.useRealTimers();
});

function type(text: string, { settle = true } = {}) {
  fireEvent.change(screen.getByRole('textbox', { name: /search commands/i }), {
    target: { value: text },
  });
  if (settle) act(() => jest.advanceTimersByTime(250));
}

function geneOptions() {
  return screen
    .queryAllByRole('option')
    .filter((o) => o.textContent?.includes(' · '));
}

describe('resultats', () => {
  it('affiche chaque gene sous la forme « GENE · comparaison · projet »', () => {
    backend = { TP53: [TP53_IN_ANALYSIS, TP53_UPLOADED] };
    render(<CommandPalette />);
    type('TP53');

    const options = geneOptions();
    expect(options).toHaveLength(2);
    expect(options[0]).toHaveTextContent('TP53 · KO vs WT · Skin atlas');
    expect(options[1]).toHaveTextContent('TP53 · Drug_vs_Vehicle · Liver (shared)');
  });

  it('dit le sens de variation en mot, pas seulement en couleur', () => {
    backend = {
      TP53: [TP53_IN_ANALYSIS, TP53_UPLOADED, { ...TP53_UPLOADED, dataset_id: 'd-3', regulation: 'NS' }],
    };
    render(<CommandPalette />);
    type('TP53');

    const [up, down, ns] = geneOptions();
    expect(up.querySelector('[data-direction="up"]')).toHaveTextContent('Up');
    expect(down.querySelector('[data-direction="down"]')).toHaveTextContent('Down');
    expect(ns.querySelector('[data-direction="ns"]')).toHaveTextContent('NS');
    expect(up).toHaveTextContent('log2FC +2.50');
    expect(down).toHaveTextContent('log2FC -1.25');
  });

  it('place les genes en tete de liste', () => {
    backend = { TP53: [TP53_IN_ANALYSIS] };
    render(<CommandPalette />);
    type('TP53');
    expect(screen.getAllByRole('option')[0]).toHaveTextContent('TP53 · KO vs WT');
  });

  it('demande au plus six resultats', () => {
    render(<CommandPalette />);
    type('TP53');
    expect(useGeneSearch).toHaveBeenLastCalledWith(
      expect.objectContaining({ query: 'TP53', limit: 6, enabled: true }),
    );
  });
});

describe('liens', () => {
  it('ouvre la comparaison de l’analyse, fiche du gene ouverte', () => {
    backend = { TP53: [TP53_IN_ANALYSIS] };
    render(<CommandPalette />);
    type('TP53');

    fireEvent.click(geneOptions()[0]);
    expect(push).toHaveBeenCalledWith(
      '/projects/p-skin/analyses/a-1/comparisons/KO%20vs%20WT?gene=ENSG00000141510',
    );
  });

  it('passe par la route de projet quand le DEG n’a pas d’analyse', () => {
    backend = { TP53: [TP53_UPLOADED] };
    render(<CommandPalette />);
    type('TP53');

    fireEvent.click(geneOptions()[0]);
    expect(push).toHaveBeenCalledWith(
      '/projects/p-liver/comparisons/Drug_vs_Vehicle?gene=ENSG00000141510',
    );
  });

  it('ne pointe plus jamais vers la page dataset, qui ignore ?gene', () => {
    backend = { TP53: [TP53_IN_ANALYSIS, TP53_UPLOADED] };
    render(<CommandPalette />);
    type('TP53');
    const [first] = geneOptions();
    fireEvent.click(first);
    for (const [href] of push.mock.calls) expect(href).not.toMatch(/\/datasets\//);
  });

  it('Entree ouvre le premier gene', () => {
    backend = { TP53: [TP53_IN_ANALYSIS] };
    render(<CommandPalette />);
    type('TP53');
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Enter' });
    expect(push).toHaveBeenCalledWith(expect.stringContaining('?gene=ENSG00000141510'));
  });
});

describe('etats honnetes', () => {
  it('dit « No gene matches » quand la base n’a rien, sans inventer de gene', () => {
    backend = { NOTAGENE: [] };
    render(<CommandPalette />);
    type('NOTAGENE');

    expect(screen.getByRole('status')).toHaveTextContent('No gene matches “NOTAGENE”.');
    expect(geneOptions()).toHaveLength(0);
    // L'ancienne version renvoyait la saisie en majuscules comme resultat.
    expect(screen.queryByRole('option', { name: /NOTAGENE/ })).toBeNull();
  });

  it('annonce la recherche en cours plutot qu’un faux « aucun resultat »', () => {
    render(<CommandPalette />);
    type('TP53');
    expect(screen.getByRole('status')).toHaveTextContent('Searching genes…');
  });

  it('n’affiche pas les genes d’une requete precedente sous la nouvelle', () => {
    backend = { TP5: [TP53_IN_ANALYSIS] };
    render(<CommandPalette />);
    type('TP5');
    expect(geneOptions()).toHaveLength(1);

    type('TP5X', { settle: false });
    expect(geneOptions()).toHaveLength(0);
    expect(screen.getByRole('status')).toHaveTextContent('Searching genes…');
  });

  it('signale une panne au lieu de pretendre qu’aucun gene ne correspond', () => {
    backendFails = true;
    render(<CommandPalette />);
    type('TP53');
    expect(screen.getByRole('status')).toHaveTextContent('Gene search is unavailable right now.');
  });

  it('ne cherche pas de gene sous deux caracteres', () => {
    render(<CommandPalette />);
    type('T');
    expect(useGeneSearch).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: false }));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('attend une pause de frappe avant d’interroger le backend', () => {
    render(<CommandPalette />);
    type('TP53', { settle: false });
    expect(useGeneSearch).not.toHaveBeenCalledWith(
      expect.objectContaining({ query: 'TP53', enabled: true }),
    );
    act(() => jest.advanceTimersByTime(250));
    expect(useGeneSearch).toHaveBeenLastCalledWith(
      expect.objectContaining({ query: 'TP53', enabled: true }),
    );
  });
});
