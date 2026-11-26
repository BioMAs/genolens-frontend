/**
 * ⌘K au-dessus d'une fiche modale.
 *
 * La fiche passe à `z-[10001]` (voile) et `z-[10002]` (panneau) quand une vue agrandie est ouverte ;
 * la palette de commandes, à `z-[10000]`, s'ouvrait sous ce voile : son champ pouvait tenir le focus
 * sans qu'on le voie, Tab revenait dans la fiche et Échap fermait la fiche au lieu de la palette.
 * On monte les deux pour vérifier l'étage ET les touches.
 */
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import CommandPalette from '@/components/command/CommandPalette';
import { closeCommandPalette, openCommandPalette } from '@/components/command/commandPaletteStore';
import InspectorSheet from '@/components/reading/InspectorSheet';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
  usePathname: () => '/projects/p1/comparisons/KO_vs_WT',
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock('@/hooks/useProjects', () => ({ useProjects: () => ({ data: { items: [] } }) }));
jest.mock('@/hooks/useAllComparisons', () => ({
  useAllComparisons: () => ({ data: { comparisons: [] } }),
}));
jest.mock('@/hooks/useGeneSearch', () => ({
  useGeneSearch: () => ({ data: undefined, isError: false }),
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

const onClose = jest.fn();

/** Une fiche modale ouverte, avec la palette montée à côté, comme dans le gabarit de l'application. */
function Stack() {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <CommandPalette />
      <InspectorSheet
        title="IL6"
        open={open}
        modal
        onClose={() => {
          onClose();
          setOpen(false);
        }}
      >
        <button type="button">First action</button>
      </InspectorSheet>
    </div>
  );
}

/** L'étage d'un élément : le `z-[N]` de sa classe. */
const layerOf = (element: HTMLElement): number => {
  const match = /z-\[(\d+)\]/.exec(element.className);
  if (!match) throw new Error(`no z-[N] layer on ${element.className}`);
  return Number(match[1]);
};

const openPalette = () => act(() => openCommandPalette());

beforeEach(() => {
  onClose.mockClear();
});

afterEach(() => {
  act(() => closeCommandPalette());
});

describe('the command palette above a modal sheet', () => {
  it('sits on a higher layer than the sheet and its veil', () => {
    render(<Stack />);
    openPalette();
    const palette = screen.getByRole('dialog', { name: 'Command palette' }).parentElement as HTMLElement;
    const sheet = screen.getByRole('dialog', { name: 'IL6' });
    expect(layerOf(palette)).toBeGreaterThan(layerOf(sheet));
    expect(layerOf(palette)).toBeGreaterThan(layerOf(screen.getByTestId('sheet-backdrop')));
  });

  it('closes on Escape without closing the sheet under it', async () => {
    render(<Stack />);
    openPalette();
    expect(screen.getByRole('textbox', { name: 'Search commands' })).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Command palette' })).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'IL6' })).toBeInTheDocument();
  });

  it('keeps Tab inside the palette instead of pulling the focus back into the sheet', async () => {
    render(<Stack />);
    openPalette();
    await userEvent.tab();
    const palette = screen.getByRole('dialog', { name: 'Command palette' });
    expect(palette).toContainElement(document.activeElement as HTMLElement);
    await userEvent.tab({ shift: true });
    expect(palette).toContainElement(document.activeElement as HTMLElement);
  });

  it('leaves the sheet with its own Escape once the palette is closed', async () => {
    render(<Stack />);
    openPalette();
    await userEvent.keyboard('{Escape}');
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog', { name: 'IL6' })).not.toBeInTheDocument();
  });
});
