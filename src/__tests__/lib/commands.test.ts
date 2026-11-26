import {
  buildCommands,
  buildGeneCommands,
  comparisonCommands,
  filterCommands,
  flattenCommands,
  geneDirection,
  geneHref,
  scoreCommand,
  type CommandActions,
} from '@/lib/commands';
import { DESTINATIONS } from '@/lib/navigation/destinations';
import type { GeneSearchResult } from '@/types/gene-search';

/**
 * Le catalogue de la palette.
 *
 * Une palette se trompe a trois endroits : un element absent, un element
 * propose hors contexte, et un classement qui enterre ce qu'on cherche. Le
 * troisieme est le plus couteux parce qu'il est silencieux — l'utilisateur
 * croit que la fonction n'existe pas.
 */
const ACTIONS: CommandActions = {
  toggleTheme: () => {},
  theme: 'light',
  toggleColorblind: () => {},
  colorblind: false,
  restartTour: () => {},
};

const build = (over: Partial<Parameters<typeof buildCommands>[0]> = {}) =>
  buildCommands({ projects: [], actions: ACTIONS, ...over });

describe('catalogue', () => {
  it('propose les routes meme sans projet', () => {
    const groups = build();
    expect(groups.find((g) => g.heading === 'Go to')!.items).toHaveLength(4);
  });

  it('omet le groupe des projets quand il n’y en a aucun', () => {
    // Un groupe vide occupe une ligne et n'apprend rien.
    expect(build().some((g) => g.heading === 'Projects')).toBe(false);
  });

  it('omet la reprise de visite quand l’ecran n’en a pas', () => {
    const groups = build({ actions: { ...ACTIONS, restartTour: undefined } });
    const ids = flattenCommands(groups).map((c) => c.id);
    expect(ids).not.toContain('action:tour');
  });

  it('libelle les bascules par leur EFFET, pas par leur etat', () => {
    // « Dark theme » ne dit pas si on l'active ou si on y est deja.
    const light = flattenCommands(build()).find((c) => c.id === 'action:theme')!;
    const dark = flattenCommands(
      build({ actions: { ...ACTIONS, theme: 'dark' } }),
    ).find((c) => c.id === 'action:theme')!;
    expect(light.label).toMatch(/switch to dark/i);
    expect(dark.label).toMatch(/switch to light/i);
  });

  it('donne a chaque commande un identifiant unique', () => {
    const ids = flattenCommands(
      build({ projects: [{ id: 'p1', name: 'Skin' }, { id: 'p2', name: 'Liver' }] }),
    ).map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('classement', () => {
  /**
   * Le defaut que le score existe pour eviter : « pro » proposerait « Profile »
   * avant « Projects » une fois sur deux, selon l'ordre de declaration. Une
   * palette dont le premier resultat change d'un jour a l'autre ne s'apprend
   * pas.
   */
  it('fait passer un prefixe avant une sous-chaine', () => {
    const prefix = { id: 'a', label: 'Projects', kind: 'navigate' as const };
    const middle = { id: 'b', label: 'My projects archive', kind: 'navigate' as const };
    expect(scoreCommand(prefix, 'pro')!).toBeGreaterThan(scoreCommand(middle, 'pro')!);
  });

  it('fait passer une sous-chaine avant un mot-cle', () => {
    const sub = { id: 'a', label: 'Comparisons', kind: 'navigate' as const };
    const kw = { id: 'b', label: 'Dashboard', kind: 'navigate' as const, keywords: ['compare'] };
    expect(scoreCommand(sub, 'compar')!).toBeGreaterThan(scoreCommand(kw, 'compar')!);
  });

  it('distingue « ne correspond pas » de « score nul »', () => {
    // Les deux se confondraient a la comparaison si l'absence valait 0.
    expect(scoreCommand({ id: 'a', label: 'Tools', kind: 'navigate' }, 'zzz')).toBeNull();
    expect(scoreCommand({ id: 'a', label: 'Tools', kind: 'navigate' }, '')).toBe(0);
  });

  it('trouve par mot-cle ce que le libelle ne dit pas', () => {
    // « daltonisme » n'apparait nulle part dans les libelles anglais.
    const hits = flattenCommands(filterCommands(build(), 'daltonisme'));
    expect(hits.map((c) => c.id)).toContain('action:colorblind');
  });
});

describe('filtrage', () => {
  const groups = () => build({ projects: [{ id: 'p1', name: 'Skin ageing' }] });

  it('rend tout quand la requete est vide', () => {
    expect(filterCommands(groups(), '   ')).toEqual(groups());
  });

  it('jette les groupes qui se vident', () => {
    const out = filterCommands(groups(), 'skin');
    expect(out.map((g) => g.heading)).toEqual(['Projects']);
  });

  it('conserve l’ordre de declaration a score egal', () => {
    // C'est cet ordre qui porte la hierarchie du produit : le tri ne doit pas
    // le redistribuer au hasard.
    const out = filterCommands(build(), 's');
    const nav = out.find((g) => g.heading === 'Go to');
    if (nav && nav.items.length > 1) {
      const scores = nav.items.map((i) => scoreCommand(i, 's'));
      expect([...scores].sort((a, b) => (b as number) - (a as number))).toEqual(scores);
    }
  });

  it('ne rend rien plutot qu’un groupe vide', () => {
    expect(filterCommands(groups(), 'zzzzz')).toEqual([]);
  });
});

describe('genes', () => {
  const hit: GeneSearchResult = {
    gene_id: 'ENSG00000141510',
    gene_symbol: 'TP53',
    project_id: 'p1',
    project_name: 'Skin',
    dataset_id: 'd1',
    analysis_id: 'a1',
    analysis_name: 'Run',
    comparison_name: 'KO/WT #2',
    log_fc: -0.5,
    padj: 0.0123,
    regulation: 'DOWN',
    exact: true,
  };

  it('lie la comparaison de l’analyse, nom encode, fiche ouverte par identifiant', () => {
    expect(geneHref(hit)).toBe(
      '/projects/p1/analyses/a1/comparisons/KO%2FWT%20%232?gene=ENSG00000141510',
    );
  });

  it('lie la route de projet sans analyse', () => {
    expect(geneHref({ ...hit, analysis_id: null })).toBe(
      '/projects/p1/comparisons/KO%2FWT%20%232?gene=ENSG00000141510',
    );
  });

  // La lecture ouvre la fiche du gène sur `?gene=` : le lien n'emporte plus les anciens écrans.
  it('ouvre la fiche dans la lecture, sans ancien écran ni module', () => {
    const href = geneHref({ ...hit, comparison_name: 'UVB 24 h + active' });
    expect(href).toContain('/comparisons/UVB%2024%20h%20%2B%20active?');
    expect(href).toContain('gene=ENSG00000141510');
    expect(href).not.toMatch(/[?&](view|panel|tab)=/);
  });

  it('classe le sens de variation, et tout ce qui n’est ni UP ni DOWN en NS', () => {
    expect(geneDirection('UP')).toBe('up');
    expect(geneDirection('down')).toBe('down');
    expect(geneDirection('NS')).toBe('ns');
    expect(geneDirection(null)).toBe('ns');
  });

  it('libelle « GENE · comparaison · projet » et met les chiffres en precision', () => {
    const [command] = buildGeneCommands([hit]);
    expect(command.label).toBe('TP53 · KO/WT #2 · Skin');
    expect(command.hint).toBe('log2FC -0.50 · padj 0.012');
    expect(command.direction).toBe('down');
    expect(command.kind).toBe('gene');
  });

  it('omet les chiffres absents plutot que d’afficher « null »', () => {
    const [command] = buildGeneCommands([{ ...hit, log_fc: null, padj: null }]);
    expect(command.hint).toBeUndefined();
  });

  it('distingue le meme gene dans deux comparaisons', () => {
    const ids = buildGeneCommands([hit, { ...hit, comparison_name: 'Other' }]).map((c) => c.id);
    expect(new Set(ids).size).toBe(2);
  });
});

/**
 * « Go to » est le DOUBLE de la barre du haut : un lieu present dans l'un et
 * absent de l'autre est un bug, dans un sens (une route que la palette ne sait
 * pas atteindre) comme dans l'autre (une route que la navigation a retiree et
 * que la palette propose encore).
 */
describe('« Go to » suit la navigation', () => {
  const goTo = () => build().find((g) => g.heading === 'Go to')!.items;

  it('propose Home, Projects, Tools puis le profil — et rien d’autre', () => {
    expect(goTo().map((c) => [c.label, c.href])).toEqual([
      ['Home', '/dashboard'],
      ['Projects', '/projects'],
      ['Tools', '/tools'],
      ['Profile & plan', '/profile'],
    ]);
  });

  it('reprend les destinations de la barre du haut telles quelles', () => {
    expect(goTo().slice(0, DESTINATIONS.length).map((c) => [c.label, c.href])).toEqual(
      DESTINATIONS.map((d) => [d.label, d.href]),
    );
  });

  it('ne propose plus ni Comparisons ni Documentation', () => {
    // La liste globale a quitte la navigation, et la documentation vit dans le
    // menu d'aide : les garder ici les ferait reapparaitre par la fenetre.
    const hrefs = goTo().map((c) => c.href);
    expect(hrefs).not.toContain('/comparisons');
    expect(hrefs).not.toContain('/docs');
    const labels = goTo().map((c) => c.label);
    expect(labels).not.toContain('Comparisons');
    expect(labels).not.toContain('Documentation');
    expect(labels).not.toContain('Dashboard');
  });

  it('trouve toujours Home par « dashboard » et par « accueil »', () => {
    for (const q of ['dashboard', 'accueil']) {
      const hits = flattenCommands(filterCommands(build(), q));
      expect(hits.map((c) => c.href)).toContain('/dashboard');
    }
  });
});

describe('comparaisons', () => {
  const comparison = (name: string, over: Partial<Parameters<typeof comparisonCommands>[0][number]> = {}) => ({
    name,
    project_id: 'p1',
    project_name: 'Skin atlas',
    dataset_id: `d-${name}`,
    ...over,
  });
  const LESIONAL = comparison('Lesional_vs_NonLesional');
  const RETINOL = comparison('Retinol_vs_Vehicle');

  it('trouve « lesional » parmi deux comparaisons, et seulement elle', () => {
    const hits = comparisonCommands([RETINOL, LESIONAL], 'lesional');
    expect(hits).toHaveLength(1);
    expect(hits[0].label).toBe('Lesional_vs_NonLesional');
    expect(hits[0].kind).toBe('comparison');
  });

  it('mene a la meme page que « Latest results » du tableau de bord', () => {
    // L'adresse que `LatestResults` donne a Retinol_vs_Vehicle (voir
    // DashboardRows.test) : une palette qui ouvre une AUTRE page pour la meme
    // comparaison est un bug que personne ne signalerait.
    const [hit] = comparisonCommands([RETINOL], 'retinol');
    expect(hit.href).toBe('/projects/p1/comparisons/Retinol_vs_Vehicle');
  });

  it('encode le nom de la comparaison', () => {
    const [hit] = comparisonCommands([comparison('KO/WT #2')], 'ko');
    expect(hit.href).toBe('/projects/p1/comparisons/KO%2FWT%20%232');
  });

  it('nomme le projet en precision, pour distinguer deux comparaisons homonymes', () => {
    const [hit] = comparisonCommands([LESIONAL], 'lesional');
    expect(hit.hint).toBe('Skin atlas');
    const twins = comparisonCommands(
      [LESIONAL, comparison('Lesional_vs_NonLesional', { project_id: 'p2', project_name: 'Liver', dataset_id: 'd2' })],
      'lesional',
    );
    expect(twins.map((c) => c.hint)).toEqual(['Skin atlas', 'Liver']);
    expect(new Set(twins.map((c) => c.id)).size).toBe(2);
  });

  /** Les lignes de comparaison, sans le lien vers la liste complete. */
  const onlyComparisons = (commands: ReturnType<typeof comparisonCommands>) =>
    commands.filter((c) => c.kind === 'comparison');

  it('en rend six au plus', () => {
    const many = Array.from({ length: 20 }, (_, i) => comparison(`Contrast_${i}_vs_Ctrl`));
    expect(onlyComparisons(comparisonCommands(many, 'contrast'))).toHaveLength(6);
    expect(onlyComparisons(comparisonCommands(many, ''))).toHaveLength(6);
  });

  it('garde l’ordre recu quand la requete est vide, comme pour les projets', () => {
    // Le hook les donne de la plus recente a la plus ancienne : c'est ce que la
    // palette montre avant toute frappe.
    const names = ['C_vs_D', 'A_vs_B', 'E_vs_F'];
    expect(
      onlyComparisons(comparisonCommands(names.map((n) => comparison(n)), '  ')).map((c) => c.label),
    ).toEqual(names);
  });

  it('ferme le groupe sur la liste complete, avant toute frappe', () => {
    // La palette ne cherche que dans les 100 plus recentes : au-dela, c'est la
    // liste complete qui retrouve une comparaison. Elle a quitte la barre du
    // haut, la palette doit donc y mener.
    const commands = comparisonCommands([LESIONAL, RETINOL], '');
    expect(commands.at(-1)).toMatchObject({ label: 'All comparisons', href: '/comparisons' });
  });

  it('trouve la liste complete par son nom, meme quand aucune comparaison ne correspond', () => {
    for (const q of ['all comp', 'comparaisons', 'deg']) {
      expect(comparisonCommands([LESIONAL], q).map((c) => c.href)).toContain('/comparisons');
    }
    expect(comparisonCommands([LESIONAL], 'lesional').map((c) => c.href)).not.toContain('/comparisons');
  });

  it('ne mene pas a une liste vide', () => {
    expect(comparisonCommands([], '')).toEqual([]);
    expect(comparisonCommands([], 'all comparisons')).toEqual([]);
  });

  it('classe un prefixe avant une sous-chaine, comme les projets', () => {
    // « vs » est PARTOUT dans les noms de comparaison : sans le palier, le
    // premier resultat dependrait de l'ordre de reception.
    const hits = comparisonCommands(
      [comparison('Control_vs_Treated'), comparison('Vehicle_vs_Retinol'), comparison('Retinol_vs_Vehicle')],
      'retinol',
    );
    expect(hits.map((c) => c.label)).toEqual(['Retinol_vs_Vehicle', 'Vehicle_vs_Retinol']);
  });

  it('trouve par projet, par titre lisible et par le mot « comparison »', () => {
    expect(comparisonCommands([LESIONAL, RETINOL], 'skin atlas')).toHaveLength(2);
    expect(comparisonCommands([LESIONAL], 'lesional vs non')).toHaveLength(1);
    expect(onlyComparisons(comparisonCommands([LESIONAL, RETINOL], 'comparison'))).toHaveLength(2);
    expect(comparisonCommands([LESIONAL, RETINOL], 'zzzz')).toEqual([]);
  });

  it('range le groupe « Comparisons » entre les projets et les actions', () => {
    const items = comparisonCommands([LESIONAL], '');
    const headings = build({ projects: [{ id: 'p1', name: 'Skin' }], comparisons: items }).map(
      (g) => g.heading,
    );
    expect(headings).toEqual(['Go to', 'Projects', 'Comparisons', 'Actions']);
  });

  it('omet le groupe quand il n’y a aucune comparaison', () => {
    expect(build().some((g) => g.heading === 'Comparisons')).toBe(false);
    expect(build({ comparisons: [] }).some((g) => g.heading === 'Comparisons')).toBe(false);
  });

  it('survit au filtrage de la palette sans changer d’ordre', () => {
    const items = comparisonCommands([LESIONAL, RETINOL], 'vs');
    const groups = filterCommands(build({ comparisons: items }), 'vs');
    expect(groups.find((g) => g.heading === 'Comparisons')!.items.map((c) => c.id)).toEqual(
      items.map((c) => c.id),
    );
  });
});
