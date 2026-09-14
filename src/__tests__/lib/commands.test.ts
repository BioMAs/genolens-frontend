import {
  buildCommands,
  filterCommands,
  flattenCommands,
  scoreCommand,
  type CommandActions,
} from '@/lib/commands';

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
    expect(groups.find((g) => g.heading === 'Go to')!.items.length).toBeGreaterThan(4);
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
