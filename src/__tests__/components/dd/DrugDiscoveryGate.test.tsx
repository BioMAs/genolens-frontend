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

// Drug Discovery is a per-user add-on now: the plan grants nothing, only the flag does.
const ALLOWED_PROFILE = {
  data: {
    id: 'u1',
    email: 'a@b.c',
    role: 'USER',
    subscription_plan: 'TEAM',
    has_drug_discovery_module: true,
  },
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
    if (url === '/users/me') return Promise.resolve(ALLOWED_PROFILE);
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

describe('DrugDiscovery — garde de module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams = new URLSearchParams();
  });

  it('montre l\'écran verrouillé sans le module et n\'appelle pas le module', async () => {
    // Un TEAM sans le flag : depuis que Drug Discovery est un add-on par utilisateur, le plan
    // n'accorde plus rien — c'est le cas de régression qui compte.
    mockedApi.get.mockImplementation((url: string) => {
      if (url === '/users/me') {
        return Promise.resolve({
          data: {
            id: 'u1',
            email: 'a@b.c',
            role: 'USER',
            subscription_plan: 'TEAM',
            has_drug_discovery_module: false,
          },
        });
      }
      throw new Error(`appel inattendu : ${url}`);
    });

    render(<DrugDiscovery />, { wrapper });

    await waitFor(() => expect(screen.getByText(/add-on module/i)).toBeInTheDocument());
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

describe('DrugDiscovery — profil absent du catalogue dans l\'URL', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // `benchmark` : le nom que genolens-dd retire de `/indications` (T1) et refuse désormais
    // même posté directement (constat 2, côté dd). Une URL peut malgré tout le porter — lien
    // partagé, tapé à la main. Le catalogue mocké ici ne le liste pas, exactement comme le
    // vrai service.
    mockSearchParams = new URLSearchParams('indication=TCGA-BRCA&profile=benchmark');
    mockAllowedAccount();
  });

  it('ne poste pas le profil inconnu de l\'URL, retombe sur le profil par défaut', async () => {
    render(<DrugDiscovery />, { wrapper });

    // Le `<select>` réel n'a pas d'option pour un profil hors catalogue (ProfileSelector.tsx) ;
    // le stub ici montre la valeur EFFECTIVE que le composant racine lui a calculée.
    await waitFor(() =>
      expect(screen.getByText(/profil actuel : default_oncology/)).toBeInTheDocument(),
    );

    await waitFor(() => expect(mockedApi.post).toHaveBeenCalled());
    const [, body] = mockedApi.post.mock.calls[0] as [string, { profile: string }];
    expect(body.profile).toBe('default_oncology');
    expect(body.profile).not.toBe('benchmark');
  });
});

describe('DrugDiscovery — socle de référence incomplet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams = new URLSearchParams();
    mockedApi.get.mockImplementation((url: string) => {
      if (url === '/users/me') return Promise.resolve(ALLOWED_PROFILE);
      if (url === '/drug-discovery/status') {
        // Joignable (le service répond), mais son `/readyz` amont dit `ready: false` — le cas
        // que le constat 3 distingue désormais de « injoignable » côté backend.
        return Promise.resolve({
          data: {
            configured: true,
            reachable: true,
            ready: false,
            tables: { contrast_disease_normal: 'missing' },
          },
        });
      }
      throw new Error(`appel inattendu : ${url}`);
    });
  });

  it('affiche un état distinct « socle incomplet », ni injoignable ni non configuré', async () => {
    render(<DrugDiscovery />, { wrapper });

    await waitFor(() =>
      expect(screen.getByText(/reference dataset is incomplete/i)).toBeInTheDocument(),
    );
    expect(screen.getByText(/contrast_disease_normal/)).toBeInTheDocument();

    expect(screen.queryByText(/temporarily unreachable/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/not configured/i)).not.toBeInTheDocument();
  });
});

describe('DrugDiscovery — borne de récupération épuisée', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams = new URLSearchParams('indication=TCGA-BRCA&profile=default_oncology');
  });

  it('affiche un message et un bouton de relance quand la seconde tentative échoue aussi', async () => {
    let postCount = 0;
    mockedApi.get.mockImplementation((url: string) => {
      if (url === '/users/me') return Promise.resolve(ALLOWED_PROFILE);
      if (url === '/drug-discovery/status') {
        return Promise.resolve({ data: { configured: true, reachable: true, ready: true } });
      }
      if (url === '/drug-discovery/indications') return Promise.resolve(CATALOGUE);
      // Chaque run — même frais — rend 404 : dd est durablement cassé pour ces paramètres, ou
      // tourne avec plusieurs réplicas et le POST/GET n'atteignent jamais la même instance.
      if (/\/targets$/.test(url)) {
        return Promise.reject(Object.assign(new Error('not found'), { response: { status: 404 } }));
      }
      throw new Error(`appel inattendu : ${url}`);
    });
    mockedApi.post.mockImplementation((url: string) => {
      if (url === '/drug-discovery/runs') return Promise.resolve({ data: { run_id: `run-${++postCount}` } });
      throw new Error(`appel inattendu : ${url}`);
    });

    render(<DrugDiscovery />, { wrapper });

    await waitFor(() => expect(screen.getByText(/calculation expired/i)).toBeInTheDocument());
    expect(screen.queryByText(/Calculating/)).not.toBeInTheDocument();
    expect(postCount).toBe(2);

    fireEvent.click(screen.getByRole('button', { name: /restart the calculation/i }));

    await waitFor(() => expect(postCount).toBe(3));
  });
});

describe('DrugDiscovery — panne isolée du rapport', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams = new URLSearchParams('indication=TCGA-BRCA&profile=default_oncology');
    mockedApi.get.mockImplementation((url: string) => {
      if (url === '/users/me') return Promise.resolve(ALLOWED_PROFILE);
      if (url === '/drug-discovery/status') {
        return Promise.resolve({ data: { configured: true, reachable: true, ready: true } });
      }
      if (url === '/drug-discovery/indications') return Promise.resolve(CATALOGUE);
      if (/^\/drug-discovery\/runs\/[^/]+$/.test(url)) return Promise.resolve(RUN_DETAIL_WITH_WARNING);
      if (/\/targets$/.test(url)) return Promise.resolve(EMPTY_TARGETS);
      // Le rapport est l'appel le plus cher en amont ; c'est lui qui expire ici, pas les cibles.
      if (/\/report$/.test(url)) {
        return Promise.reject(Object.assign(new Error('gateway timeout'), { response: { status: 504 } }));
      }
      throw new Error(`appel inattendu : ${url}`);
    });
    mockedApi.post.mockImplementation((url: string) => {
      if (url === '/drug-discovery/runs') return Promise.resolve({ data: { run_id: 'r1' } });
      throw new Error(`appel inattendu : ${url}`);
    });
  });

  it('ne déclenche /report que sur l\'onglet Rapport, et son échec ne masque pas les cibles', async () => {
    render(<DrugDiscovery />, { wrapper });

    await waitFor(() => expect(screen.getByText(/indication actuelle : TCGA-BRCA/)).toBeInTheDocument());

    // Onglet Cibles actif par défaut : la table doit se rendre SANS bandeau de panne, alors que
    // `/report` n'a même pas encore été appelé.
    await waitFor(() => expect(mockedApi.get).toHaveBeenCalledWith(
      expect.stringMatching(/\/targets$/),
      expect.anything(),
    ));
    expect(mockedApi.get.mock.calls.some(([url]) => /\/report$/.test(url as string))).toBe(false);
    expect(screen.queryByText(/exceeded the allowed time/i)).not.toBeInTheDocument();

    // Bascule sur Rapport : la requête part maintenant, échoue, et son message reste local à
    // l'onglet — il ne doit pas remplacer la table de cibles ni le bandeau générique du haut.
    fireEvent.click(screen.getByText('Report'));

    await waitFor(() =>
      expect(screen.getByText(/report calculation exceeded the allowed time/i)).toBeInTheDocument(),
    );

    // Retour sur Cibles : la table est toujours là, intacte, sans trace de la panne du rapport.
    fireEvent.click(screen.getByText('Targets'));
    expect(screen.queryByText(/report calculation exceeded the allowed time/i)).not.toBeInTheDocument();
  });
});
