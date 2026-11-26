/**
 * Les seuils d'étude : un réglage par projet, gardé dans le navigateur.
 *
 * Ce que le hook promet : l'état d'origine est `DEFAULT_THRESHOLDS`, tout ce qui passe (lecture ou
 * écriture) passe par `clampThresholds`, un stockage illisible ou bloqué ne lève jamais, et le
 * premier rendu client est celui du serveur — le vrai réglage arrive juste après l'hydratation.
 */
import { act, render, renderHook, screen } from '@testing-library/react';
import { createElement } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { useStudyThresholds } from '@/hooks/useStudyThresholds';
import { clampThresholds, DEFAULT_THRESHOLDS, type VolcanoThresholds } from '@/utils/volcano';

const keyOf = (projectId: string) => `gl-thresholds:${projectId}`;

const readStudy = (projectId: string): VolcanoThresholds =>
  renderHook(() => useStudyThresholds(projectId)).result.current[0];

const setStudy = (projectId: string, thresholds: VolcanoThresholds) => {
  const { result } = renderHook(() => useStudyThresholds(projectId));
  act(() => result.current[1](thresholds));
};

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('useStudyThresholds', () => {
  it('starts at the ingestion defaults when nothing is stored', () => {
    expect(readStudy('p1')).toEqual(DEFAULT_THRESHOLDS);
  });

  it('keeps what was set, through the clamp, under the study key', () => {
    setStudy('p1', { padj: 0.5, logfc: 0.1 });

    expect(readStudy('p1')).toEqual(clampThresholds({ padj: 0.5, logfc: 0.1 }));
    setStudy('p1', { padj: 0.001, logfc: 2 });
    expect(readStudy('p1')).toEqual({ padj: 0.001, logfc: 2 });
    expect(JSON.parse(window.localStorage.getItem(keyOf('p1')) ?? 'null')).toEqual({
      padj: 0.001,
      logfc: 2,
    });
  });

  it('does not let one study write on another', () => {
    setStudy('p1', { padj: 0.01, logfc: 1 });

    expect(readStudy('p2')).toEqual(DEFAULT_THRESHOLDS);
    expect(window.localStorage.getItem(keyOf('p2'))).toBeNull();
  });

  it('clamps a stored value looser than ingestion, like a hand-edited store', () => {
    window.localStorage.setItem(keyOf('p1'), JSON.stringify({ padj: 0.5, logfc: 0.1 }));

    expect(readStudy('p1')).toEqual(clampThresholds({ padj: 0.5, logfc: 0.1 }));
    expect(readStudy('p1')).toEqual(DEFAULT_THRESHOLDS);
  });

  it.each([
    ['unreadable JSON', '{not json'],
    ['a bare number', '7'],
    ['null', 'null'],
    ['an array', '[0.01, 1]'],
    ['text thresholds', JSON.stringify({ padj: '0.01', logfc: '1' })],
    ['an empty object', '{}'],
  ])('falls back to the defaults for %s', (_label, raw) => {
    window.localStorage.setItem(keyOf('p1'), raw);

    expect(readStudy('p1')).toEqual(DEFAULT_THRESHOLDS);
  });

  it('falls back to the defaults, and does not throw, when reading the storage is blocked', () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });

    expect(readStudy('p1')).toEqual(DEFAULT_THRESHOLDS);
  });

  it('does not throw when writing the storage is blocked, and keeps the defaults', () => {
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    const { result } = renderHook(() => useStudyThresholds('p1'));

    expect(() => act(() => result.current[1]({ padj: 0.01, logfc: 1 }))).not.toThrow();
    expect(result.current[0]).toEqual(DEFAULT_THRESHOLDS);
  });

  it('hands out the same object while the stored value does not change', () => {
    window.localStorage.setItem(keyOf('p1'), JSON.stringify({ padj: 0.01, logfc: 1 }));
    const { result, rerender } = renderHook(() => useStudyThresholds('p1'));
    const first = result.current[0];

    rerender();
    expect(result.current[0]).toBe(first);

    // The same value written again is no change, and must not look like one.
    act(() => result.current[1]({ padj: 0.01, logfc: 1 }));
    expect(result.current[0]).toBe(first);
  });

  it('keeps the setter stable for one study', () => {
    const { result, rerender } = renderHook(() => useStudyThresholds('p1'));
    const setter = result.current[1];

    rerender();
    act(() => setter({ padj: 0.01, logfc: 1 }));
    expect(result.current[1]).toBe(setter);
  });

  it('tells every reader of the study in the same tab when the setter writes', () => {
    const a = renderHook(() => useStudyThresholds('p1'));
    const b = renderHook(() => useStudyThresholds('p1'));
    const other = renderHook(() => useStudyThresholds('p2'));

    act(() => a.result.current[1]({ padj: 0.005, logfc: 1.5 }));

    expect(b.result.current[0]).toEqual({ padj: 0.005, logfc: 1.5 });
    expect(other.result.current[0]).toEqual(DEFAULT_THRESHOLDS);
  });

  it('follows another tab that wrote the same study', () => {
    const { result } = renderHook(() => useStudyThresholds('p1'));

    act(() => {
      window.localStorage.setItem(keyOf('p1'), JSON.stringify({ padj: 0.001, logfc: 3 }));
      window.dispatchEvent(new StorageEvent('storage', { key: keyOf('p1') }));
    });

    expect(result.current[0]).toEqual({ padj: 0.001, logfc: 3 });
  });

  it('switches to the setting of the new study when the project changes', () => {
    window.localStorage.setItem(keyOf('p2'), JSON.stringify({ padj: 0.01, logfc: 2 }));
    const { result, rerender } = renderHook(({ id }) => useStudyThresholds(id), {
      initialProps: { id: 'p1' },
    });
    expect(result.current[0]).toEqual(DEFAULT_THRESHOLDS);

    rerender({ id: 'p2' });
    expect(result.current[0]).toEqual({ padj: 0.01, logfc: 2 });
  });
});

describe('useStudyThresholds, hydration', () => {
  function Probe() {
    const [{ padj, logfc }] = useStudyThresholds('p1');
    return createElement('p', { 'data-testid': 'probe' }, `padj < ${padj}, |log2FC| > ${logfc}`);
  }

  const STORED = { padj: 0.001, logfc: 2 };
  const AT_DEFAULTS = `padj < ${DEFAULT_THRESHOLDS.padj}, |log2FC| > ${DEFAULT_THRESHOLDS.logfc}`;
  const AT_STORED = `padj < ${STORED.padj}, |log2FC| > ${STORED.logfc}`;

  beforeEach(() => {
    window.localStorage.setItem(keyOf('p1'), JSON.stringify(STORED));
  });

  /** Le texte du balisage serveur, sans l'échappement HTML de `<` et `>`. */
  const serverText = () => {
    const holder = document.createElement('div');
    holder.innerHTML = renderToString(createElement(Probe));
    return holder.textContent;
  };

  it('renders the defaults on the server, whatever the browser would hold', () => {
    expect(serverText()).toBe(AT_DEFAULTS);
  });

  it('hydrates onto the server markup without a mismatch, then shows the stored setting', async () => {
    const html = renderToString(createElement(Probe));
    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container);
    const errors = jest.spyOn(console, 'error').mockImplementation(() => {});

    let root: ReturnType<typeof hydrateRoot> | undefined;
    await act(async () => {
      root = hydrateRoot(container, createElement(Probe));
    });

    expect(errors).not.toHaveBeenCalled();
    expect(container.textContent).toBe(AT_STORED);
    act(() => root?.unmount());
    container.remove();
  });

  it('shows the stored setting straight away on a client render', () => {
    render(createElement(Probe));
    expect(screen.getByTestId('probe').textContent).toBe(AT_STORED);
  });
});
