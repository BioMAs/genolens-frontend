'use client';

import React from 'react';
import { Dna, FlaskConical, Droplets, ArrowRight, Lock } from 'lucide-react';

export type DataType = 'transcriptomics' | 'proteomics' | 'lipidomics';

interface DataTypeCard {
  id: DataType;
  label: string;
  description: string;
  icon: React.ElementType;
  available: boolean;
  color: string;
  bgColor: string;
  borderColor: string;
}

const DATA_TYPES: DataTypeCard[] = [
  {
    id: 'transcriptomics',
    label: 'Transcriptomics',
    description: 'Differential gene expression, clustering & pathway enrichment from RNA-seq count matrices.',
    icon: Dna,
    available: true,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
    borderColor: 'border-indigo-200 hover:border-indigo-400',
  },
  {
    id: 'proteomics',
    label: 'Proteomics',
    description: 'Protein abundance analysis, PTM profiling and quantitative proteomics workflows.',
    icon: FlaskConical,
    available: false,
    color: 'text-success-ink',
    bgColor: 'bg-success-soft',
    borderColor: 'border-success/30',
  },
  {
    id: 'lipidomics',
    label: 'Lipidomics',
    description: 'Lipid species identification, quantification and differential lipid analysis.',
    icon: Droplets,
    available: false,
    color: 'text-warning-ink',
    bgColor: 'bg-warning-soft',
    borderColor: 'border-warning/30',
  },
];

interface StepDataTypeProps {
  onSelect: (type: DataType) => void;
}

export default function StepDataType({ onSelect }: StepDataTypeProps) {
  return (
    <div>
      <h2 className="text-title text-primary">Select Data Type</h2>
      <p className="mt-1 mb-6 text-body-sm text-secondary">
        Choose the type of omics data you want to analyse.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {DATA_TYPES.map(({ id, label, description, icon: Icon, available, color, bgColor, borderColor }) => (
          <div
            key={id}
            onClick={() => available && onSelect(id)}
            className={`
              relative flex flex-col rounded-card border-2 p-5 transition-all
              ${borderColor}
              ${available
                ? 'cursor-pointer shadow-sm hover:shadow-md'
                : 'cursor-not-allowed opacity-60'}
            `}
          >
            {/* Coming soon badge */}
            {!available && (
              <span className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-pill bg-surface-2 px-2 py-0.5 text-micro font-medium text-secondary">
                <Lock className="h-2.5 w-2.5" />
                Coming soon
              </span>
            )}

            {/* Icon */}
            <div className={`mb-4 inline-flex h-11 w-11 items-center justify-center rounded-control ${bgColor}`}>
              <Icon className={`h-6 w-6 ${color}`} />
            </div>

            {/* Label */}
            <h3 className="text-body-sm font-semibold text-primary">{label}</h3>

            {/* Description */}
            <p className="mt-1 flex-1 text-caption text-secondary leading-relaxed">{description}</p>

            {/* CTA */}
            {available && (
              <div className={`mt-4 inline-flex items-center gap-1 text-caption font-medium ${color}`}>
                Get started <ArrowRight className="h-3.5 w-3.5" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
