import * as React from 'react';
import { cn } from '@/lib/cn';

export type ButtonVariant =
  | 'default'
  | 'brand'
  | 'outline'
  | 'ghost'
  | 'destructive'
  | 'secondary'
  | 'link';

export type ButtonSize = 'default' | 'sm' | 'lg' | 'icon' | 'icon-sm';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const base = cn(
  'inline-flex cursor-pointer select-none items-center justify-center gap-2',
  'rounded-control text-body-sm font-semibold',
  'transition-colors duration-150',
  // Le focus est un etat interactif : anneau indigo, jamais emerald.
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
  'disabled:pointer-events-none disabled:opacity-50',
);

/**
 * Une seule couleur est interactive : l'indigo (--color-accent). L'emerald
 * porte la marque et le succes, jamais une action. Cette regle est ce qui
 * rend une interface sobre lisible : ce qui est colore est ce qui se clique.
 *
 * Pas d'ombre coloree sur les variantes pleines : l'aplat d'accent porte deja
 * la hierarchie, un halo par-dessus ne fait qu'ajouter du bruit (cf. l'echelle
 * d'elevation a deux niveaux dans globals.css).
 */
const VARIANTS: Record<ButtonVariant, string> = {
  default: 'bg-accent text-on-accent hover:bg-accent-hover',

  // Marque emerald — reserve aux surfaces qui parlent du produit lui-meme
  // (onboarding, marque), pas aux actions courantes.
  brand: 'bg-brand text-on-accent hover:bg-success',

  destructive: 'bg-danger text-on-accent hover:bg-danger-hover',

  // Survol neutre : la bordure se renforce, elle ne change pas de teinte.
  outline: 'border border-line bg-surface text-primary hover:border-strong hover:bg-hover',

  secondary: 'border border-line bg-surface-2 text-primary hover:bg-hover',

  ghost: 'text-secondary hover:bg-hover hover:text-primary',

  link: 'text-accent-ink underline-offset-4 hover:underline',
};

const SIZES: Record<ButtonSize, string> = {
  // Trois hauteurs, pas six. 44px est aussi le minimum tactile, d'ou `lg` pour
  // toute cible mobile. `sm` passe de 32 a 28 : reserve aux barres d'outils
  // denses, il doit se distinguer nettement du defaut.
  default: 'h-9 px-4 py-2',
  sm: 'h-7 px-2.5 text-caption',
  lg: 'h-11 px-5 text-body',
  // 36px : sous le minimum tactile de 44px, d'ou le hit-area etendu.
  icon: 'h-9 w-9 p-0',
  'icon-sm': 'h-7 w-7 p-0',
};

/**
 * Les classes du bouton, sans le composant.
 *
 * Une bonne moitie des « boutons » de l'application sont des `<Link>` de
 * Next : `Button` est un forwardRef<HTMLButtonElement> et ne peut pas les
 * envelopper, ce qui explique qu'ils aient tous ete stylistes a la main.
 * Cet export les ramene dans le systeme sans changer leur balise :
 *
 *   <Link href={…} className={buttonClasses({ variant: 'default' })}>
 */
export function buttonClasses(opts: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}): string {
  const { variant = 'default', size = 'default', className } = opts;
  return cn(base, VARIANTS[variant], SIZES[size], className);
}

/**
 * `type` vaut "button" par defaut : sans cela, un bouton place dans un <form>
 * sans type explicite le soumet au clic, ce qui produit des envois accidentels.
 * Les consommateurs qui veulent soumettre passent type="submit" — c'est deja
 * le cas des deux seuls formulaires concernes (CommentEditor, CommentsSection).
 */
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={buttonClasses({ variant, size, className })}
      {...props}
    />
  ),
);

Button.displayName = 'Button';

export { Button };
