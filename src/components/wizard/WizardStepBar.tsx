'use client';

import React from 'react';
import { Check } from 'lucide-react';

export interface WizardStep {
  id: number;
  label: string;
  description: string;
}

export const WIZARD_STEPS: WizardStep[] = [
  { id: 1, label: 'Upload Files',       description: 'Matrix, samples & contrasts' },
  { id: 2, label: 'Data Validation',    description: 'QC preview' },
  { id: 3, label: 'Analysis Settings',  description: 'Standard or advanced config' },
  { id: 4, label: 'Launch & Monitor',   description: 'Run Analysis' },
  { id: 5, label: 'Results',            description: 'Explore your findings' },
];

interface WizardStepBarProps {
  currentStep: number;
}

export default function WizardStepBar({ currentStep }: WizardStepBarProps) {
  return (
    <nav aria-label="Analysis progress" className="mb-8">
      <ol className="flex items-center">
        {WIZARD_STEPS.map((step, index) => {
          const isDone    = step.id < currentStep;
          const isCurrent = step.id === currentStep;
          const isLast    = index === WIZARD_STEPS.length - 1;

          return (
            <React.Fragment key={step.id}>
              <li className="flex flex-col items-center shrink-0">
                {/* Circle — emerald when done, indigo when active, neutral when upcoming */}
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors"
                  style={
                    isDone
                      ? { background: 'var(--sl-teal-light)', borderColor: 'var(--sl-teal-muted)', color: 'var(--sl-teal)' }
                      : isCurrent
                        ? { background: 'var(--sl-purple)', borderColor: 'var(--sl-purple)', color: '#fff' }
                        : { background: 'var(--surface)', borderColor: 'var(--border-strong)', color: 'var(--text-muted)' }
                  }
                >
                  {isDone ? <Check className="h-4 w-4" strokeWidth={2.5} /> : step.id}
                </div>
                {/* Labels — hidden on small screens */}
                <div className="mt-1.5 hidden text-center sm:block">
                  <p
                    className="text-xs font-semibold leading-tight"
                    style={{ color: isCurrent ? 'var(--text-primary)' : isDone ? 'var(--sl-teal)' : 'var(--text-muted)' }}
                  >
                    {step.label}
                  </p>
                  <p className="text-[10px] leading-tight" style={{ color: 'var(--text-muted)' }}>
                    {step.description}
                  </p>
                </div>
              </li>

              {/* Connector line */}
              {!isLast && (
                <div
                  className="mx-2 h-0.5 flex-1 transition-colors"
                  style={{ background: step.id === currentStep - 1 ? 'var(--sl-purple)' : isDone ? 'var(--sl-teal)' : 'var(--border-strong)' }}
                />
              )}
            </React.Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
