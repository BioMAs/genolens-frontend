import * as React from 'react';
import { Check } from 'lucide-react';

export interface StepperStep {
  label: string;
}

export interface StepperProps {
  steps: StepperStep[];
  /** 0-based index of the active step. Steps before it are "done". */
  current: number;
  className?: string;
}

/**
 * Stepper — horizontal progress stepper for the upload / configure-analysis flow.
 * Matches the "Skin Stack" mockup: emerald for completed steps, indigo for the
 * active step, neutral for upcoming steps.
 */
export function Stepper({ steps, current, className = '' }: StepperProps) {
  return (
    <div
      className={`flex items-center rounded-2xl border px-6 py-4 ${className}`}
      style={{
        background: 'var(--surface)',
        borderColor: 'var(--border)',
        boxShadow: '0 1px 2px rgba(19,22,41,.04)',
      }}
    >
      {steps.map((step, i) => {
        const isDone = i < current;
        const isActive = i === current;
        // Connector leading INTO the active step is indigo; between done steps emerald.
        const connectorColor =
          i + 1 === current
            ? 'var(--sl-purple)'
            : i < current
              ? 'var(--sl-teal)'
              : 'var(--border-strong)';

        return (
          <React.Fragment key={step.label}>
            <div className="flex flex-none items-center gap-2.5">
              <span
                className="grid h-[30px] w-[30px] place-items-center rounded-full text-[13px] font-bold"
                style={
                  isActive
                    ? { background: 'var(--sl-purple)', color: '#fff' }
                    : isDone
                      ? { background: 'var(--sl-teal-light)', color: 'var(--sl-teal)' }
                      : {
                          background: 'var(--surface-secondary)',
                          border: '1px solid var(--border-strong)',
                          color: 'var(--text-muted)',
                        }
                }
              >
                {isDone ? <Check className="h-[15px] w-[15px]" strokeWidth={2.5} /> : i + 1}
              </span>
              <span
                className="text-[13.5px] font-medium"
                style={{
                  color: isActive
                    ? 'var(--text-primary)'
                    : isDone
                      ? 'var(--sl-teal)'
                      : 'var(--text-muted)',
                  fontWeight: isActive ? 600 : 500,
                }}
              >
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className="mx-4 h-[2px] flex-1"
                style={{ background: connectorColor }}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
