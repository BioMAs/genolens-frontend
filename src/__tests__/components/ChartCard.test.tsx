import { render, screen } from '@testing-library/react';
import ChartCard, { type ChartState } from '@/components/charts/ChartCard';

/**
 * L'enveloppe commune des graphiques.
 *
 * Ce qu'elle remplace : quatre traitements de chargement sans rapport — un
 * spinner dans une carte, deux textes nus HORS carte, des barres de squelette —
 * chacun avec sa hauteur (h-48, h-64, 260px, min-h-[400px]), sa couleur
 * d'erreur et sa formulation. Le defaut n'etait pas l'incoherence mais
 * l'INSTABILITE : chaque etat occupait une place differente, donc l'arrivee des
 * donnees deplacait tout ce qui suivait.
 */
const STATES: ChartState[] = ['ready', 'loading', 'empty', 'error'];

function body(container: HTMLElement) {
  // La zone de trace est le frere qui suit la legende.
  return container.querySelector('figcaption')!.nextElementSibling as HTMLElement;
}

describe('place reservee', () => {
  it.each(STATES)('garde la meme hauteur dans l’etat %s', (state) => {
    const { container } = render(
      <ChartCard title="PCA" height={340} state={state}>
        <div>graphique</div>
      </ChartCard>,
    );
    expect(body(container).style.height).toBe('340px');
  });

  it('rend toujours le cadre, meme en chargement', () => {
    // Deux des traitements remplaces rendaient leur texte hors de la carte :
    // le cadre disparaissait, puis revenait.
    const { container } = render(<ChartCard title="PCA" height={200} state="loading" />);
    expect(container.querySelector('figure')).toHaveClass('gl-card');
    expect(screen.getByText('PCA')).toBeInTheDocument();
  });

  it("n'impose pas de hauteur quand le graphique calcule la sienne", () => {
    // La carte de chaleur des DEG dimensionne sa zone au nombre de genes.
    const { container } = render(<ChartCard title="Heatmap" height="auto" state="ready" />);
    expect(body(container).style.height).toBe('');
  });
});

describe('semantique', () => {
  it('rend une figure dont le titre est la legende', () => {
    const { container } = render(<ChartCard title="Sample PCA" height={200} />);
    const figure = container.querySelector('figure');
    expect(figure).toBeInTheDocument();
    expect(figure!.querySelector('figcaption')).toHaveTextContent('Sample PCA');
  });

  it('annonce le chargement sans vider la region', () => {
    const { container } = render(<ChartCard title="PCA" height={200} state="loading" />);
    expect(container.querySelector('figure')).toHaveAttribute('aria-busy', 'true');
  });

  it("n'annonce rien quand le graphique est pret", () => {
    const { container } = render(<ChartCard title="PCA" height={200} state="ready" />);
    expect(container.querySelector('figure')).not.toHaveAttribute('aria-busy');
  });

  it('signale une erreur au lecteur d’ecran', () => {
    render(<ChartCard title="PCA" height={200} state="error" error="Calcul impossible" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Calcul impossible');
  });
});

describe('contenu par etat', () => {
  it('ne rend les enfants que lorsque le graphique est pret', () => {
    for (const state of STATES) {
      const { unmount } = render(
        <ChartCard title="PCA" height={200} state={state}>
          <div>trace</div>
        </ChartCard>,
      );
      if (state === 'ready') expect(screen.getByText('trace')).toBeInTheDocument();
      else expect(screen.queryByText('trace')).not.toBeInTheDocument();
      unmount();
    }
  });

  it('fournit un texte par defaut pour le vide et l’erreur', () => {
    // Trois formulations differentes circulaient ; un defaut evite la quatrieme.
    const { unmount } = render(<ChartCard title="PCA" height={200} state="empty" />);
    expect(screen.getByText(/no data/i)).toBeInTheDocument();
    unmount();
    render(<ChartCard title="PCA" height={200} state="error" />);
    expect(screen.getByRole('alert')).toHaveTextContent(/could not be loaded/i);
  });

  it('place les actions dans la legende, pas dans la zone de trace', () => {
    // Une bascule rendue dans la zone disparaitrait pendant le chargement.
    const { container } = render(
      <ChartCard title="PCA" height={200} state="loading" actions={<button>Export</button>} />,
    );
    expect(container.querySelector('figcaption')).toContainElement(screen.getByText('Export'));
  });
});
