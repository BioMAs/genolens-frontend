/**
 * Le filet de la barre de contexte.
 *
 * La barre partage le fond de l'application et ne porte AUCUN filet au repos —
 * c'est ce qui la fait disparaître dans la page plutôt que de la poser dessus.
 * Le filet n'apparaît qu'une fois le contenu défilé, pour séparer la barre de
 * ce qui glisse dessous.
 *
 * Verrouillé par un test et non par une capture : le comportement dépend d'un
 * événement de défilement, et le conteneur qui défile est `.app-content`, pas
 * la fenêtre — une erreur facile à commettre et invisible à l'œil tant qu'on
 * ne fait pas défiler la bonne boîte.
 */
import { render, screen, act } from '@testing-library/react';

// La recherche de la barre est devenue une pastille qui ouvre la palette de
// commandes. Elle est simulee pour la meme raison que l'ancienne zone de
// saisie : ces tests portent sur le fil d'Ariane et le filet de defilement.
jest.mock('@/components/command/CommandPaletteTrigger', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/components/onboarding/HelpTourButton', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/components/MobileNavToggle', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
}));

import TopBar from '@/components/TopBar';

/** La coquille réelle : la barre lit le défilement de `.app-content`. */
function mountShell() {
  const content = document.createElement('main');
  content.className = 'app-content';
  document.body.appendChild(content);
  return content;
}

afterEach(() => {
  document.querySelectorAll('.app-content').forEach((el) => el.remove());
});

const bar = () => screen.getByRole('banner');

it('ne porte pas de filet au repos', () => {
  mountShell();
  render(<TopBar />);
  expect(bar()).toHaveClass('border-transparent');
});

it('fait apparaître le filet une fois le contenu défilé', () => {
  const content = mountShell();
  render(<TopBar />);

  act(() => {
    Object.defineProperty(content, 'scrollTop', { value: 120, configurable: true });
    content.dispatchEvent(new Event('scroll'));
  });

  expect(bar()).toHaveClass('border-line');
  expect(bar()).not.toHaveClass('border-transparent');
});

it('retire le filet quand on revient en haut', () => {
  const content = mountShell();
  render(<TopBar />);

  act(() => {
    Object.defineProperty(content, 'scrollTop', { value: 120, configurable: true });
    content.dispatchEvent(new Event('scroll'));
  });
  act(() => {
    Object.defineProperty(content, 'scrollTop', { value: 0, configurable: true });
    content.dispatchEvent(new Event('scroll'));
  });

  expect(bar()).toHaveClass('border-transparent');
});

it("ne se déclenche pas sur un défilement d'un pixel", () => {
  // Un seuil est nécessaire : le rebond élastique de macOS produit des valeurs
  // de 1 ou 2px au repos, et le filet clignoterait.
  const content = mountShell();
  render(<TopBar />);

  act(() => {
    Object.defineProperty(content, 'scrollTop', { value: 2, configurable: true });
    content.dispatchEvent(new Event('scroll'));
  });

  expect(bar()).toHaveClass('border-transparent');
});

it('ne plante pas si la coquille est absente', () => {
  // La barre est aussi rendue par des tests et des outils qui ne montent pas
  // `.app-content` : l'absence du conteneur ne doit pas lever.
  expect(() => render(<TopBar />)).not.toThrow();
});
