/**
 * Le cadre de la fiche : un panneau à droite, non modal sur la page, modal au-dessus d'une vue
 * agrandie. Ce qu'on vérifie est son contrat d'accessibilité (nom, Échap, focus), pas son contenu.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import InspectorSheet from '@/components/reading/InspectorSheet';

/** Une page avec un bouton qui ouvre la fiche, comme un gène du chapitre 2. */
function Page({
  modal = false,
  initiallyOpen = false,
  onClose,
}: {
  modal?: boolean;
  initiallyOpen?: boolean;
  onClose?: () => void;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Open IL6
      </button>
      <button type="button">Elsewhere</button>
      <InspectorSheet
        title="IL6"
        open={open}
        modal={modal}
        onClose={() => {
          onClose?.();
          setOpen(false);
        }}
      >
        <button type="button">First action</button>
        <a href="https://example.org/il6">Last link</a>
      </InspectorSheet>
    </div>
  );
}

describe('InspectorSheet — the frame', () => {
  it('renders nothing while closed', () => {
    render(<Page />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('is a dialog named by its title, with the content inside', async () => {
    render(<Page />);
    await userEvent.click(screen.getByRole('button', { name: 'Open IL6' }));
    const dialog = screen.getByRole('dialog', { name: 'IL6' });
    expect(screen.getByRole('heading', { level: 2, name: 'IL6' })).toBeInTheDocument();
    expect(dialog).toContainElement(screen.getByRole('button', { name: 'First action' }));
  });

  it('does not make the page modal: no aria-modal, no veil, the page stays reachable', async () => {
    render(<Page />);
    await userEvent.click(screen.getByRole('button', { name: 'Open IL6' }));
    expect(screen.getByRole('dialog', { name: 'IL6' })).not.toHaveAttribute('aria-modal', 'true');
    expect(screen.queryByTestId('sheet-backdrop')).not.toBeInTheDocument();
  });

  it('moves the focus into the sheet when it opens', async () => {
    render(<Page />);
    await userEvent.click(screen.getByRole('button', { name: 'Open IL6' }));
    expect(screen.getByRole('dialog', { name: 'IL6' })).toHaveFocus();
  });

  it('closes on Escape and gives the focus back to the element that opened it', async () => {
    const onClose = jest.fn();
    render(<Page onClose={onClose} />);
    const opener = screen.getByRole('button', { name: 'Open IL6' });
    await userEvent.click(opener);
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it('does not take the focus back from an element that already has it when the sheet closes', async () => {
    function Page() {
      const [open, setOpen] = useState(false);
      return (
        <div>
          <button type="button" onClick={() => setOpen(true)}>
            Open IL6
          </button>
          <button type="button" onClick={() => setOpen(false)}>
            Elsewhere
          </button>
          <InspectorSheet title="IL6" open={open} onClose={() => setOpen(false)}>
            <p>Body</p>
          </InspectorSheet>
        </div>
      );
    }
    render(<Page />);
    await userEvent.click(screen.getByRole('button', { name: 'Open IL6' }));
    const elsewhere = screen.getByRole('button', { name: 'Elsewhere' });
    await userEvent.click(elsewhere);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(elsewhere).toHaveFocus();
  });

  it('closes with its close button, and gives the focus back too', async () => {
    render(<Page />);
    const opener = screen.getByRole('button', { name: 'Open IL6' });
    await userEvent.click(opener);
    await userEvent.click(screen.getByRole('button', { name: 'Close panel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it('closes on Escape when the focus is on the page body, e.g. after a click on plain text', async () => {
    const onClose = jest.fn();
    render(<Page onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: 'Open IL6' }));
    (document.activeElement as HTMLElement).blur();
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('leaves Escape to a page control that has the focus: a menu or a field there is not ours', async () => {
    const onClose = jest.fn();
    render(<Page onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: 'Open IL6' }));
    screen.getByRole('button', { name: 'Elsewhere' }).focus();
    await userEvent.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'IL6' })).toBeInTheDocument();
  });

  it('does not trap Tab while it is not modal', async () => {
    render(<Page />);
    await userEvent.click(screen.getByRole('button', { name: 'Open IL6' }));
    screen.getByRole('link', { name: 'Last link' }).focus();
    await userEvent.tab();
    // Le lien est le dernier élément de la fiche : un piège ramènerait au premier.
    expect(screen.getByRole('button', { name: 'First action' })).not.toHaveFocus();
  });

  it('puts the focus back in the sheet when the content changes under the reader', async () => {
    function Swap() {
      const [which, setWhich] = useState<'a' | 'b'>('a');
      return (
        <InspectorSheet title={which === 'a' ? 'Process' : 'Gene'} open onClose={() => {}}>
          {which === 'a' ? (
            <button type="button" onClick={() => setWhich('b')}>
              KRT1
            </button>
          ) : (
            <p>Gene body</p>
          )}
        </InspectorSheet>
      );
    }
    render(<Swap />);
    await userEvent.click(screen.getByRole('button', { name: 'KRT1' }));
    // Le bouton cliqué a disparu avec le contenu : le focus ne reste pas dans le vide.
    expect(screen.getByRole('dialog', { name: 'Gene' })).toHaveFocus();
  });
});

describe('InspectorSheet — above a focus view', () => {
  it('becomes a modal: aria-modal, a veil, and a higher layer than the full-screen dialog', async () => {
    render(<Page modal initiallyOpen />);
    const dialog = screen.getByRole('dialog', { name: 'IL6' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByTestId('sheet-backdrop')).toBeInTheDocument();
    // La boîte de la vue agrandie est à z-[10000] (`ui/dialog`) : la fiche et son voile sont au-dessus.
    expect(dialog.className).toContain('z-[10002]');
    expect(screen.getByTestId('sheet-backdrop').className).toContain('z-[10001]');
  });

  it('closes when the veil is pressed', async () => {
    const onClose = jest.fn();
    render(<Page modal initiallyOpen onClose={onClose} />);
    await userEvent.pointer({ keys: '[MouseLeft>]', target: screen.getByTestId('sheet-backdrop') });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps Tab inside the sheet, from the last element to the first and back', async () => {
    render(<Page modal initiallyOpen />);
    const close = screen.getByRole('button', { name: 'Close panel' });
    const last = screen.getByRole('link', { name: 'Last link' });
    last.focus();
    await userEvent.tab();
    expect(close).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(last).toHaveFocus();
  });

  it('takes the focus when a focus view opens under an open sheet', async () => {
    function Toggle() {
      const [modal, setModal] = useState(false);
      return (
        <div>
          <button type="button" onClick={() => setModal(true)}>
            Open the view
          </button>
          <InspectorSheet title="IL6" open modal={modal} onClose={() => {}}>
            <p>Body</p>
          </InspectorSheet>
        </div>
      );
    }
    render(<Toggle />);
    await userEvent.click(screen.getByRole('button', { name: 'Open the view' }));
    expect(screen.getByRole('dialog', { name: 'IL6' })).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('dialog', { name: 'IL6' })).toHaveFocus();
  });

  it('brings the focus back into the sheet on Tab when it has strayed to the dialog under it', async () => {
    function Stack() {
      return (
        <div>
          <div role="dialog" aria-modal="true" aria-label="Volcano" tabIndex={-1}>
            <button type="button">Inside the view</button>
          </div>
          <InspectorSheet title="IL6" open modal onClose={() => {}}>
            <button type="button">First action</button>
          </InspectorSheet>
        </div>
      );
    }
    render(<Stack />);
    screen.getByRole('button', { name: 'Inside the view' }).focus();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Close panel' })).toHaveFocus();
    screen.getByRole('button', { name: 'Inside the view' }).focus();
    await userEvent.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'First action' })).toHaveFocus();
  });

  it('closes before the dialog under it on Escape, even when the focus is in that dialog', async () => {
    const underEscape = jest.fn();
    function Stack() {
      const [open, setOpen] = useState(true);
      return (
        <div>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Volcano"
            tabIndex={-1}
            onKeyDown={(event) => event.key === 'Escape' && underEscape()}
          >
            <button type="button">Inside the view</button>
          </div>
          <InspectorSheet title="IL6" open={open} modal onClose={() => setOpen(false)}>
            <p>Body</p>
          </InspectorSheet>
        </div>
      );
    }
    render(<Stack />);
    screen.getByRole('button', { name: 'Inside the view' }).focus();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'IL6' })).not.toBeInTheDocument();
    expect(underEscape).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Volcano' })).toBeInTheDocument();
  });

  it('gives the focus back to the dialog under it when the opener is behind that dialog', async () => {
    function Stack() {
      const [open, setOpen] = useState(false);
      return (
        <div>
          <button type="button" onClick={() => setOpen(true)}>
            Page button
          </button>
          <div role="dialog" aria-modal="true" aria-label="Volcano" tabIndex={-1}>
            <button type="button">Inside the view</button>
          </div>
          <InspectorSheet title="IL6" open={open} modal onClose={() => setOpen(false)}>
            <p>Body</p>
          </InspectorSheet>
        </div>
      );
    }
    render(<Stack />);
    await userEvent.click(screen.getByRole('button', { name: 'Page button' }));
    await userEvent.keyboard('{Escape}');
    // Le bouton de la page est derrière la vue agrandie : le focus rejoint cette vue.
    expect(screen.getByRole('dialog', { name: 'Volcano' })).toHaveFocus();
  });

  it('gives the focus back to the opener when it is inside the dialog under it', async () => {
    function Stack() {
      const [open, setOpen] = useState(false);
      return (
        <div>
          <div role="dialog" aria-modal="true" aria-label="Volcano" tabIndex={-1}>
            <button type="button" onClick={() => setOpen(true)}>
              Inside the view
            </button>
          </div>
          <InspectorSheet title="IL6" open={open} modal onClose={() => setOpen(false)}>
            <p>Body</p>
          </InspectorSheet>
        </div>
      );
    }
    render(<Stack />);
    const opener = screen.getByRole('button', { name: 'Inside the view' });
    await userEvent.click(opener);
    await userEvent.keyboard('{Escape}');
    expect(opener).toHaveFocus();
  });
});
