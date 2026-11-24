/**
 * L'en-tete de page : un titre long doit se replier, pas deborder.
 *
 * Un nom de comparaison peut atteindre 255 caracteres (`Treated_D14_vs_Control_
 * D14_female…`), sans un seul espace. Un <h1> sans `min-w-0` ni coupure de mot
 * garde sa largeur minimale de contenu, et pousse la page hors d'un ecran de
 * 375px.
 */
import { render, screen } from '@testing-library/react';
import { PageHeader } from '@/components/ui/page-header';

const LONG = 'Treated_D14_vs_Control_D14_female_cohort_batch_3_replicate_B_normalised_counts';

describe('PageHeader title', () => {
  it('lets the <h1> shrink and break inside a word', () => {
    render(<PageHeader title="Power analysis" />);
    const h1 = screen.getByRole('heading', { level: 1, name: 'Power analysis' });
    expect(h1).toHaveClass('min-w-0', 'break-words');
  });

  it('does the same for a user-chosen name, which is the long one', () => {
    render(<PageHeader title={LONG} titleVariant="name" />);
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveClass('min-w-0');
    expect(h1).toHaveClass('break-words');
    // La coupure « n'importe ou » est remplacee : elle coupait un titre a
    // espaces au milieu d'un mot meme quand il tenait sur la ligne.
    expect(h1).not.toHaveClass('break-all');
  });

  it('keeps the full text on the title attribute, since it clamps at two lines', () => {
    render(<PageHeader title={LONG} titleVariant="name" />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveAttribute('title', LONG);
  });
});
