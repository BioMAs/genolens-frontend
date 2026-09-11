import * as React from 'react';
import { cn } from '@/lib/cn';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

/**
 * Input — champ texte sur une ligne.
 *
 * Le theme passe par des classes, pas par un `style` inline. La version
 * precedente posait background / borderColor / color en inline : comme le style
 * inline l'emporte sur toute classe, `<Input className="bg-surface-2">` n'avait
 * aucun effet. C'est exactement le defaut deja corrige sur Card et Badge, et
 * c'est la raison concrete pour laquelle cette primitive n'avait que quatre
 * consommateurs.
 *
 * L'anneau de focus etait emerald (`ring-brand-teal`) : un reste de l'ancienne
 * palette. Le focus est un etat interactif, il porte donc l'accent indigo comme
 * partout ailleurs.
 */
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        'flex h-9 w-full rounded-control border border-line bg-surface px-3.5 py-2',
        'text-body-sm text-primary transition-colors',
        'placeholder:text-muted',
        'file:border-0 file:bg-transparent file:text-body-sm file:font-medium',
        'focus-visible:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
);

Input.displayName = 'Input';

export { Input };
