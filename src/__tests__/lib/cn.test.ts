import { cn } from '@/lib/cn';

/**
 * cn() est la brique dont dependent toutes les primitives ui/.
 *
 * Son interet n'est pas d'assembler des chaines — clsx suffirait — mais
 * d'arbitrer les conflits pour que le `className` d'un consommateur ecrase
 * bien le defaut de la primitive. Sans cet arbitrage, `<Button className="px-6">`
 * produit `px-4 px-6` et le rendu depend de l'ordre dans la feuille de style ;
 * c'est precisement ce qui pousse a re-styler a la main plutot qu'a reutiliser
 * la primitive.
 *
 * Le point non evident : tailwind-merge ignore les noms declares dans notre
 * `@theme`. Les crans typographiques doivent lui etre enseignes explicitement,
 * sinon deux `font-size` survivent dans la classe finale.
 */
describe('cn', () => {
  it('assemble et filtre les valeurs conditionnelles', () => {
    expect(cn('a', false && 'b', undefined, 'c')).toBe('a c');
  });

  it('laisse la derniere classe gagner sur un conflit standard', () => {
    expect(cn('px-4', 'px-6')).toBe('px-6');
  });

  // Rayons et elevations sont des valeurs nommees du @theme, invisibles pour
  // tailwind-merge par defaut — meme piege que les crans typographiques.
  it('arbitre les rayons nommes du @theme', () => {
    expect(cn('rounded-lg', 'rounded-card')).toBe('rounded-card');
    expect(cn('rounded-card', 'rounded-full')).toBe('rounded-full');
  });

  it('arbitre les elevations nommees du @theme', () => {
    expect(cn('shadow-sm', 'shadow-elev-2')).toBe('shadow-elev-2');
    expect(cn('shadow-elev-1', 'shadow-none')).toBe('shadow-none');
  });

  describe('crans typographiques du @theme', () => {
    // Sans extendTailwindMerge, ces cas renverraient les DEUX classes.
    it.each([
      ['text-body', 'text-title'],
      ['text-caption', 'text-micro'],
      ['text-body-sm', 'text-display'],
      ['text-heading', 'text-body'],
    ])('dedoublonne %s + %s', (first, second) => {
      expect(cn(first, second)).toBe(second);
    });

    it('ne confond pas un cran typographique avec une couleur de texte', () => {
      // text-body est une taille, text-secondary une couleur : groupes distincts,
      // les deux doivent survivre.
      expect(cn('text-body', 'text-secondary').split(' ').sort()).toEqual([
        'text-body',
        'text-secondary',
      ]);
    });

    it('arbitre les couleurs de texte entre elles', () => {
      expect(cn('text-primary', 'text-muted')).toBe('text-muted');
    });
  });

  it('arbitre les tokens semantiques de fond et de trait', () => {
    expect(cn('bg-surface', 'bg-surface-2')).toBe('bg-surface-2');
    expect(cn('border-line', 'border-strong')).toBe('border-strong');
  });
});
