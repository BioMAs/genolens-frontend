import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ColorblindToggle from '@/components/ui/ColorblindToggle';
import { setColorblind } from '@/contexts/chartPrefs';

/**
 * La bascule portait `...transition-colors${value ? 'text-blue-600 ...' : ''}`.
 * Sans espace avant l'interpolation, les deux classes fusionnaient en un token
 * invalide : `transition-colors` ET `text-blue-600` etaient perdues, et le
 * bouton n'avait aucun etat actif visible. Une assertion sur la chaine de
 * classe entiere n'aurait rien vu ; c'est la liste de tokens qui le dit.
 */
describe('ColorblindToggle', () => {
  // `localStorage.clear()` seul ne suffit pas : le store garde un repli
  // memoire pour les navigateurs ou l'ecriture echoue, et il survivrait d'un
  // test a l'autre. On remet la preference a zero par le chemin normal.
  beforeEach(() => {
    setColorblind(false);
    localStorage.clear();
  });

  it('rend des classes separees, pas un token fusionne', async () => {
    render(<ColorblindToggle />);
    const button = screen.getByRole('button');

    await userEvent.click(button);

    const tokens = Array.from(button.classList);
    expect(tokens).toContain('transition-colors');
    expect(tokens).toContain('bg-accent-soft');
    expect(tokens.some((t) => t.includes('transition-colorstext'))).toBe(false);
  });

  it("emploie l'accent du produit, pas un bleu hors systeme", async () => {
    // Corriger le seul espacement aurait rendu visible `text-blue-600` : la
    // regle de couleur du systeme n'admet qu'un accent interactif.
    render(<ColorblindToggle />);
    await userEvent.click(screen.getByRole('button'));

    const tokens = Array.from(screen.getByRole('button').classList);
    expect(tokens.some((t) => t.includes('blue'))).toBe(false);
    expect(tokens).toContain('text-accent-ink');
  });

  it('expose son etat aux technologies d’assistance', async () => {
    render(<ColorblindToggle />);
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-pressed', 'false');

    await userEvent.click(button);
    expect(button).toHaveAttribute('aria-pressed', 'true');
  });

  it('accorde deux instances montees cote a cote', async () => {
    // Le defaut d'origine : chaque graphique avait sa propre bascule.
    render(
      <>
        <ColorblindToggle className="volcano" />
        <ColorblindToggle className="pca" />
      </>,
    );
    await userEvent.click(document.querySelector('.volcano') as HTMLElement);

    expect(document.querySelector('.pca')).toHaveAttribute('aria-pressed', 'true');
  });
});
