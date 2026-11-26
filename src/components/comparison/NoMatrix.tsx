import { Database } from 'lucide-react';

/**
 * Un module qui a besoin de la matrice d'expression, sur un projet qui n'en a pas.
 *
 * Sorti de `ComparisonDetail`, qui le gardait pour lui : la vue agrandie de la lecture dit la même
 * chose, avec les mêmes mots, et ne doit pas importer tout l'écran pour cela.
 */
export default function NoMatrix({ purpose }: { purpose: string }) {
  return (
    <div className="py-16 text-center">
      <Database className="mx-auto mb-4 h-12 w-12 text-muted" aria-hidden />
      <h3 className="mb-2 text-title font-medium text-primary">No expression matrix</h3>
      <p className="mx-auto max-w-sm text-body-sm text-secondary">
        {purpose} requires an expression matrix (count matrix). Upload a dataset of type
        &quot;Expression Matrix&quot; to enable it.
      </p>
    </div>
  );
}
