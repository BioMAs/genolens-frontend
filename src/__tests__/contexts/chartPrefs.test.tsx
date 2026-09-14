import { act, renderHook } from '@testing-library/react';
import { useChartPrefs, usePaletteMode, setColorblind, toggleColorblind } from '@/contexts/chartPrefs';

/**
 * La preference de palette sure.
 *
 * Elle remplace QUATRE mecanismes concurrents : un contexte non persiste borne
 * a l'explorateur de comparaison, et trois `useState(false)` prives. Les deux
 * proprietes qui manquaient — elle traverse les ecrans, elle survit a un
 * rechargement — sont exactement ce que ce fichier verifie.
 */
describe('chartPrefs', () => {
  beforeEach(() => {
    localStorage.clear();
    act(() => setColorblind(false));
    localStorage.clear();
  });

  it('part en palette standard', () => {
    const { result } = renderHook(() => usePaletteMode());
    expect(result.current).toBe('standard');
  });

  it('bascule et persiste', () => {
    const { result } = renderHook(() => usePaletteMode());
    act(() => setColorblind(true));
    expect(result.current).toBe('colorblind');
    // La persistance EST la correction : sans elle, un utilisateur qui en a
    // besoin doit re-activer la palette a chaque visite, ecran par ecran.
    expect(localStorage.getItem('chart-colorblind')).toBe('1');
  });

  it('accorde deux consommateurs montes separement', () => {
    // Le defaut d'origine : activer la palette sur le volcan ne l'activait pas
    // sur la PCA d'a cote. Deux `renderHook` distincts reproduisent ce cas.
    const volcano = renderHook(() => useChartPrefs());
    const pca = renderHook(() => useChartPrefs());

    act(() => toggleColorblind());

    expect(volcano.result.current.colorblind).toBe(true);
    expect(pca.result.current.colorblind).toBe(true);
  });

  it('relit une valeur deja stockee au premier rendu', () => {
    localStorage.setItem('chart-colorblind', '1');
    const { result } = renderHook(() => useChartPrefs());
    expect(result.current.colorblind).toBe(true);
  });

  it('ne notifie pas quand la valeur ne bouge pas', () => {
    // Un re-rendu inutile relance une mise en page Plotly complete, ce qui se
    // voit sur le volcan. L'egalite de reference le prouve.
    const { result } = renderHook(() => useChartPrefs());
    const before = result.current;
    act(() => setColorblind(false));
    expect(result.current).toBe(before);
  });

  it('reste effective quand le stockage est indisponible', () => {
    // Navigation privee, quota a zero : la bascule ne persiste plus, mais la
    // desactiver priverait de la palette sure les navigateurs les plus
    // verrouilles — exactement le mauvais public.
    const setItem = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    const getItem = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    try {
      const { result } = renderHook(() => useChartPrefs());
      act(() => setColorblind(true));
      expect(result.current.colorblind).toBe(true);
    } finally {
      setItem.mockRestore();
      getItem.mockRestore();
    }
    act(() => setColorblind(false));
  });
});
