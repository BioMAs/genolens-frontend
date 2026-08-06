import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';

import DrugDiscovery from '@/components/tools/DrugDiscovery';

jest.mock('@/utils/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));

/**
 * Mock avec état pour les tests d'aller-retour URL : `router.replace` réécrit
 * `mockSearchParams`, et un `rerender()` explicite après l'action ré-exécute le composant avec
 * les nouveaux paramètres — exactement ce que fait Next.js en conditions réelles, mais qu'un
 * mock statique ne peut pas simuler.
 */
let mockSearchParams = new URLSearchParams();
const mockReplace = jest.fn((url: string) => {
  const queryIndex = url.indexOf('?');
  mockSearchParams = new URLSearchParams(queryIndex >= 0 ? url.slice(queryIndex + 1) : '');
});

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => mockSearchParams,
  usePathname: () => '/tools/drug-discovery',
}));

// Stubs des sélecteurs : ce fichier teste l'orchestration du composant racine (dérivation des
// paramètres, aller-retour URL), pas le rendu de ces composants — déjà couvert par leurs propres
// suites (IndicationPicker.test.tsx, etc.). Un stub minimal évite de coupler ce test à leur
// markup interne.
jest.mock('@/components/tools/dd/ProfileSelector', () => ({
  __esModule: true,
  default: ({ value, onChange }: { value: string; onChange: (next: string) => void }) => (
    <button type="button" onClick={() => onChange('custom_profile')}>
      profil actuel : {value}
    </button>
  ),
}));
jest.mock('@/components/tools/dd/IndicationPicker', () => ({
  __esModule: true,
  default: ({
    value,
    onSelect,
  }: {
    value: string | null;
    onSelect: (tcgaProject: string) => void;
  }) => (
    <button type="button" onClick={() => onSelect('TCGA-BRCA')}>
      indication actuelle : {value ?? 'aucune'}
    </button>
  ),
}));

import api from '@/utils/api';

const mockedApi = api as jest.Mocked<typeof api>;

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const TEAM_PROFILE = {
  data: { id: 'u1', email: 'a@b.c', role: 'USER', subscription_plan: 'TEAM' },
};

const CATALOGUE = {
  data: {
    indications: [
      { tcga_project: 'TCGA-BRCA', disease_name: 'Sein', excluded: false, rationale: null },
    ],
    profiles: ['default_oncology', 'custom_profile'],
  },
};

const RUN_DETAIL_WITH_WARNING = {
  data: {
    run_id: 'r1',
    profile: 'default_oncology',
    weights: {},
    weights_hash: 'h',
    min_axes: 1,
    warnings: ['Classement sans axe maladie : indication exclue, run forcé.'],
    required_axes: [],
    safety_floor: null,
    axis_versions: {},
    source_releases: {},
    n_genes_in_universe: 0,
    indication: 'TCGA-BRCA',
    include_chembl_derived: false,
    attributions: [],
  },
};

const EMPTY_TARGETS = {
  data: {
    run_id: 'r1',
    n_ranked: 0,
    n_excluded_insufficient_evidence: 0,
    n_disqualified_common_essential: 0,
    n_disqualified_safety_floor: 0,
    n_excluded_missing_required_axis: 0,
    missing_required_by_axis: {},
    targets: [],
  },
};

const EMPTY_REPORT = {
  data: {
    run_id: 'r1',
    indication: 'TCGA-BRCA',
    profile: 'default_oncology',
    weights_hash: 'h',
    source_releases: {},
    attributions: [],
    n_targets_without_evidence: 0,
    sections: [],
    bibliography: [],
    appendix: [],
  },
};

/** Sert `/users/me`, le statut et le catalogue ; une indication choisie sert aussi le run. */
function mockAllowedAccount() {
  mockedApi.get.mockImplementation((url: string) => {
    if (url === '/users/me') return Promise.resolve(TEAM_PROFILE);
    if (url === '/drug-discovery/status') {
      return Promise.resolve({ data: { configured: true, reachable: true, ready: true } });
    }
    if (url === '/drug-discovery/indications') return Promise.resolve(CATALOGUE);
    if (/^\/drug-discovery\/runs\/[^/]+$/.test(url)) return Promise.resolve(RUN_DETAIL_WITH_WARNING);
    if (/\/targets$/.test(url)) return Promise.resolve(EMPTY_TARGETS);
    if (/\/report$/.test(url)) return Promise.resolve(EMPTY_REPORT);
    throw new Error(`appel inattendu : ${url}`);
  });
  mockedApi.post.mockImplementation((url: string) => {
    if (url === '/drug-discovery/runs') return Promise.resolve({ data: { run_id: 'r1' } });
    throw new Error(`appel inattendu : ${url}`);
  });
}

describe('DrugDiscovery — garde de plan', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams = new URLSearchParams();
  });

  it('montre l\'écran d\'upgrade à un STARTER et n\'appelle pas le module', async () => {
    mockedApi.get.mockImplementation((url: string) => {
      if (url === '/users/me') {
        return Promise.resolve({
          data: { id: 'u1', email: 'a@b.c', role: 'USER', subscription_plan: 'STARTER' },
        });
      }
      throw new Error(`appel inattendu : ${url}`);
    });

    render(<DrugDiscovery />, { wrapper });

    await waitFor(() => expect(screen.getByText(/plan TEAM/i)).toBeInTheDocument());
    // La garde évite tout aller-retour au module pour un compte non autorisé ; le backend reste
    // l'autorité. Vérifier l'absence de TOUT appel au préfixe `/drug-discovery` — pas seulement
    // `/indications` — pour qu'une régression retirant le flag `enabled` de `useDdStatus` fasse
    // échouer ce test plutôt que de passer silencieusement.
    const calledUrls = mockedApi.get.mock.calls.map(([url]) => url as string);
    expect(calledUrls.some((url) => url.startsWith('/drug-discovery'))).toBe(false);
    expect(mockedApi.post).not.toHaveBeenCalled();
  });
});

describe('DrugDiscovery — aller-retour URL', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams = new URLSearchParams();
    mockAllowedAccount();
  });

  it('conserve un profil choisi avant toute indication, une fois l\'indication choisie', async () => {
    const { rerender } = render(<DrugDiscovery />, { wrapper });

    await waitFor(() =>
      expect(screen.getByText(/profil actuel : default_oncology/)).toBeInTheDocument(),
    );

    // Étape 1 : profil changé AVANT toute indication choisie.
    fireEvent.click(screen.getByText(/profil actuel :/));

    expect(mockReplace).toHaveBeenLastCalledWith(
      expect.stringContaining('profile=custom_profile'),
    );
    expect(mockReplace.mock.calls.at(-1)?.[0]).not.toEqual(expect.stringContaining('indication='));

    rerender(<DrugDiscovery />);
    await waitFor(() =>
      expect(screen.getByText(/profil actuel : custom_profile/)).toBeInTheDocument(),
    );

    // Étape 2 : une indication est choisie ensuite — le profil déjà choisi ne doit pas se perdre.
    fireEvent.click(screen.getByText(/indication actuelle :/));

    const lastUrl = mockReplace.mock.calls.at(-1)?.[0] as string;
    expect(lastUrl).toEqual(expect.stringContaining('profile=custom_profile'));
    expect(lastUrl).toEqual(expect.stringContaining('indication=TCGA-BRCA'));
  });
});

describe('DrugDiscovery — bandeau de run forcé', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams = new URLSearchParams('indication=TCGA-BRCA&profile=default_oncology');
    mockAllowedAccount();
  });

  it('affiche les warnings du run en bandeau permanent, sans moyen de le masquer', async () => {
    render(<DrugDiscovery />, { wrapper });

    const warningText = 'Classement sans axe maladie : indication exclue, run forcé.';
    await waitFor(() => expect(screen.getByText(warningText)).toBeInTheDocument());

    const warningEl = screen.getByText(warningText);
    // Le bandeau est un simple paragraphe : aucun bouton de fermeture, aucun état pour le
    // masquer. C'est la seule chose qui distingue un classement sans axe maladie d'un
    // classement spécifique — il ne doit pas pouvoir disparaître de l'écran.
    expect(warningEl.tagName).toBe('P');
    expect(warningEl.querySelector('button')).toBeNull();
    expect(
      screen.queryByRole('button', { name: /fermer|masquer|close|dismiss|×/i }),
    ).not.toBeInTheDocument();
  });
});
