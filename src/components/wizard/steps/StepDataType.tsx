'use client';

import React from 'react';
import { Dna, FlaskConical, Droplets, ArrowRight, Lock } from 'lucide-react';
import { cn } from '@/lib/cn';

export type DataType = 'transcriptomics' | 'proteomics' | 'lipidomics';

interface DataTypeCard {
  id: DataType;
  label: string;
  description: string;
  icon: React.ElementType;
  available: boolean;
}

const DATA_TYPES: DataTypeCard[] = [
  {
    id: 'transcriptomics',
    label: 'Transcriptomics',
    description: 'Differential gene expression, clustering & pathway enrichment from RNA-seq count matrices.',
    icon: Dna,
    available: true,
  },
  {
    id: 'proteomics',
    label: 'Proteomics',
    description: 'Protein abundance analysis, PTM profiling and quantitative proteomics workflows.',
    icon: FlaskConical,
    available: false,
  },
  {
    id: 'lipidomics',
    label: 'Lipidomics',
    description: 'Lipid species identification, quantification and differential lipid analysis.',
    icon: Droplets,
    available: false,
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
        {DATA_TYPES.map(({ id, label, description, icon: Icon, available }) => (
          <div
            key={id}
            onClick={() => available && onSelect(id)}
            /* Ce qui distingue ces cartes n'est pas la modalite mais la
               DISPONIBILITE : une seule est cliquable. Trois jeux de couleurs
               par modalite ne le disaient pas — et la migration des statuts en
               avait fait un succes et un avertissement. */
            className={cn(
              'relative flex flex-col rounded-card p-5 transition-colors',
              available
                ? 'gl-card gl-card-interactive'
                : 'cursor-not-allowed bg-surface-2 opacity-60',
            )}
          >
            {/* Coming soon badge */}
            {!available && (
              <span className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-pill bg-surface-2 px-2 py-0.5 text-micro font-medium text-secondary">
                <Lock className="h-2.5 w-2.5" />
                Coming soon
              </span>
            )}

            {/* Icon */}
            <div
              className={cn(
                'mb-4 inline-flex h-11 w-11 items-center justify-center rounded-control',
                available ? 'bg-accent-soft' : 'bg-surface',
              )}
            >
              <Icon className={cn('h-6 w-6', available ? 'text-accent-ink' : 'text-muted')} />
            </div>

            {/* Label */}
            <h3 className="text-body-sm font-semibold text-primary">{label}</h3>

            {/* Description */}
            <p className="mt-1 flex-1 text-caption text-secondary leading-relaxed">{description}</p>

            {/* CTA */}
            {available && (
              <div className="mt-4 inline-flex items-center gap-1 text-caption font-medium text-accent-ink">
                Get started <ArrowRight className="h-3.5 w-3.5" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
