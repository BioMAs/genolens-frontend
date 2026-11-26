/**
 * Le bloc verrouillé : cadenas, titre, texte, un bouton qui demande l'accès, une seule fois.
 *
 * Le hook de demande est simulé : ce qu'on vérifie ici est ce que le bloc en fait (quel module il
 * demande, ce qu'il affiche, quand il se bloque), pas l'appel réseau, qui est celui de la page de
 * profil et de l'ancienne grille.
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LockedPart, { LOCKED_COPY } from '@/components/reading/LockedPart';
import type { ModuleId } from '@/components/modules/ModuleSelector';

const mockRequest = jest.fn();
let mockHookState: {
  pending: ModuleId | null;
  notice: { kind: 'success' | 'error'; text: string } | null;
  requested: ModuleId[];
};

jest.mock('@/hooks/useModuleAccessRequest', () => ({
  useModuleAccessRequest: () => ({
    request: mockRequest,
    reset: jest.fn(),
    ...mockHookState,
  }),
}));

beforeEach(() => {
  mockRequest.mockReset();
  mockHookState = { pending: null, notice: null, requested: [] };
});

const renderLocked = (module: ModuleId = 'claim') =>
  render(<LockedPart module={module} title="Skin claims need the CosmOmics module" body="Not in your plan." />);

const askButton = () => screen.getByRole('button', { name: 'Ask for access' });

describe('LockedPart', () => {
  it('shows the title as a heading, the text, and a button to ask for access', () => {
    renderLocked();
    expect(
      screen.getByRole('heading', { name: 'Skin claims need the CosmOmics module' })
    ).toBeInTheDocument();
    expect(screen.getByText('Not in your plan.')).toBeInTheDocument();
    expect(askButton()).toBeInTheDocument();
    expect(askButton()).not.toHaveAttribute('aria-disabled', 'true');
  });

  it('keeps the padlock out of the accessible name', () => {
    const { container } = renderLocked();
    // Decorative: the heading already says what is locked.
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(askButton().textContent).toBe('Ask for access');
  });

  it.each<ModuleId>(['claim', 'drugdiscovery', 'science'])('asks for the %s module', async (module) => {
    renderLocked(module);
    await userEvent.click(askButton());
    expect(mockRequest).toHaveBeenCalledTimes(1);
    expect(mockRequest).toHaveBeenCalledWith(module);
  });

  it('shows the hook notice in a status region', () => {
    mockHookState.notice = { kind: 'success', text: "Request sent — we'll get back to you soon." };
    renderLocked();
    expect(screen.getByRole('status')).toHaveTextContent("Request sent — we'll get back to you soon.");
  });

  it('keeps an empty status region before any request, so the notice is announced when it arrives', () => {
    renderLocked();
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('turns the button aria-disabled once this module is requested, and asks no second time', async () => {
    mockHookState.requested = ['claim'];
    mockHookState.notice = { kind: 'success', text: 'Sent.' };
    renderLocked('claim');
    // aria-disabled, not disabled: the button stays in the tab order and keeps its name.
    expect(askButton()).toHaveAttribute('aria-disabled', 'true');
    expect(askButton()).not.toBeDisabled();
    await userEvent.click(askButton());
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it('does not lock the button for a request made for another module', async () => {
    mockHookState.requested = ['science'];
    renderLocked('claim');
    expect(askButton()).not.toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(askButton());
    expect(mockRequest).toHaveBeenCalledWith('claim');
  });

  it('is aria-disabled while its request is in flight', async () => {
    mockHookState.pending = 'drugdiscovery';
    renderLocked('drugdiscovery');
    expect(askButton()).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(askButton());
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it('lets the reader try again after a failure', async () => {
    mockHookState.notice = { kind: 'error', text: 'Could not send your request. Please try again later.' };
    renderLocked('science');
    expect(within(screen.getByRole('status')).getByText(/Could not send your request/)).toBeInTheDocument();
    expect(askButton()).not.toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(askButton());
    expect(mockRequest).toHaveBeenCalledWith('science');
  });
});

describe('LOCKED_COPY', () => {
  it('has the title and the text of each locked view, word for word', () => {
    expect(LOCKED_COPY).toEqual({
      gsea: {
        title: 'GSEA needs the scientific module',
        body: 'Ranks every gene against gene sets to find coordinated shifts that thresholds miss. Your plan does not include it.',
      },
      signature: {
        title: 'Signature score needs the scientific module',
        body: 'Scores every sample of the study against a gene list you choose. Your plan does not include it.',
      },
      targets: {
        title: 'Drug targets need the drug discovery module',
        body: 'Ranks the genes that move here by how druggable they are. Your plan does not include it.',
      },
      claims: {
        title: 'Skin claims need the CosmOmics module',
        body: 'Reads this comparison against cosmetic claims and shows which pathways support or contradict each one. Your plan does not include it.',
      },
    });
  });
});
