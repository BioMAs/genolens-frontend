import * as React from 'react';
import { Input, type InputProps } from '@/components/ui/input';

/**
 * Label + Input pair for the auth screens.
 *
 * Uses the design-system Input rather than a bare <input>. Two overrides are
 * passed through `style` on purpose: inline declarations beat the utility
 * classes baked into the primitive, which is what lets the auth palette
 * (--auth-*) win over the app palette (--sl-*) without forking the component.
 */
export default function AuthField({
  id,
  label,
  hint,
  ...props
}: InputProps & { id: string; label: string; hint?: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="auth-label">
        {label}
      </label>
      <Input
        id={id}
        style={
          {
            background: 'var(--auth-bg)',
            borderColor: 'var(--auth-card-border)',
            color: 'var(--auth-text)',
          } as React.CSSProperties
        }
        className="auth-input h-10"
        {...props}
      />
      {hint}
    </div>
  );
}
