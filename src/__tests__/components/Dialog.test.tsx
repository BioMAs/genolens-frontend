/**
 * Le contrat de la modale : ce que les quatorze fenetres ecrites a la main
 * oubliaient toutes. Chaque cas ci-dessous a manque au moins une fois.
 */
import React, { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Dialog } from '@/components/ui/dialog';

function Harness({ dismissible = true, onClose = jest.fn() }: { dismissible?: boolean; onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open</button>
      <Dialog
        open={open}
        onClose={() => {
          onClose();
          setOpen(false);
        }}
        title="Edit dataset"
        description="Rename or retype"
        dismissible={dismissible}
        footer={<button>Save</button>}
      >
        <input aria-label="Name" />
      </Dialog>
    </>
  );
}

describe('Dialog', () => {
  it('ne rend rien quand il est ferme', () => {
    render(<Dialog open={false} onClose={jest.fn()} title="Hidden" />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('annonce une boite modale nommee par son titre et decrite par son sous-titre', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByText('Open'));
    const dialog = screen.getByRole('dialog', { name: 'Edit dataset' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleDescription('Rename or retype');
  });

  it('donne un nom accessible a la croix', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByText('Open'));
    expect(screen.getByRole('button', { name: 'Close dialog' })).toBeInTheDocument();
  });

  it('place le focus sur le premier champ du corps, pas sur la croix', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByText('Open'));
    expect(screen.getByLabelText('Name')).toHaveFocus();
  });

  it('se ferme a Echap et rend le focus au declencheur', async () => {
    const onClose = jest.fn();
    render(<Harness onClose={onClose} />);
    const trigger = screen.getByText('Open');
    await userEvent.click(trigger);
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it('se ferme au clic sur le voile', async () => {
    const onClose = jest.fn();
    render(<Harness onClose={onClose} />);
    await userEvent.click(screen.getByText('Open'));
    fireEvent.mouseDown(screen.getByTestId('dialog-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ignore Echap, le voile et la croix quand dismissible est faux', async () => {
    const onClose = jest.fn();
    render(<Harness onClose={onClose} dismissible={false} />);
    await userEvent.click(screen.getByText('Open'));
    await userEvent.keyboard('{Escape}');
    fireEvent.mouseDown(screen.getByTestId('dialog-backdrop'));
    expect(screen.getByRole('button', { name: 'Close dialog' })).toBeDisabled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('retient le focus : Tab depuis le dernier element revient au premier', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByText('Open'));
    screen.getByRole('button', { name: 'Save' }).focus();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Close dialog' })).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Save' })).toHaveFocus();
  });

  it('bloque le defilement de la page tant qu il est ouvert', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByText('Open'));
    expect(document.body.style.overflow).toBe('hidden');
    await userEvent.keyboard('{Escape}');
    expect(document.body.style.overflow).toBe('');
  });
});
