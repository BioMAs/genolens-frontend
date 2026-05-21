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
                {/* Circle */}
                <div
                  className={`
                    flex items-center justify-center w-9 h-9 rounded-full border-2 text-sm font-semibold transition-colors
                    ${isDone    ? 'bg-indigo-600 border-indigo-600 text-white'            : ''}
                    ${isCurrent ? 'bg-white border-indigo-600 text-indigo-600'            : ''}
                    ${!isDone && !isCurrent ? 'bg-white border-gray-300 text-gray-400'   : ''}
                  `}
                >
                  {isDone ? <Check className="w-4 h-4" /> : step.id}
                </div>
                {/* Labels — hidden on small screens */}
                <div className="mt-1.5 text-center hidden sm:block">
                  <p className={`text-xs font-semibold leading-tight ${isCurrent ? 'text-indigo-600' : isDone ? 'text-gray-900' : 'text-gray-400'}`}>
                    {step.label}
                  </p>
                  <p className="text-[10px] text-gray-400 leading-tight">{step.description}</p>
                </div>
              </li>

              {/* Connector line */}
              {!isLast && (
                <div className={`flex-1 h-0.5 mx-2 transition-colors ${isDone ? 'bg-indigo-600' : 'bg-gray-200'}`} />
              )}
            </React.Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
