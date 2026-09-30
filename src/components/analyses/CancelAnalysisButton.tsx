'use client';

import React from 'react';
import { Loader, X } from 'lucide-react';
import { cancelAnalysisErrorMessage, useCancelAnalysis } from '@/hooks/useAnalyses';
import { cn } from '@/lib/cn';

interface Props {
  analysisId: string;
  analysisName?: string;
  /** Classes du bouton : chaque écran garde son apparence. */
  className?: string;
  showIcon?: boolean;
}

/**
 * Bouton « Cancel » d'une analyse en cours, partagé par l'assistant (étape
 * Launch) et la liste des analyses : même confirmation, même état d'attente,
 * même message d'échec, même appel (useCancelAnalysis).
 */
export default function CancelAnalysisButton({
  analysisId,
  analysisName,
  className,
  showIcon = false,
}: Props) {
  const cancel = useCancelAnalysis();

  const handleClick = () => {
    const label = analysisName ? `analysis "${analysisName}"` : 'this analysis';
    if (
      !window.confirm(
        `Cancel ${label}? The run will be stopped and will not count against your monthly quota.`,
      )
    ) {
      return;
    }
    cancel.mutate(analysisId);
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={cancel.isPending}
        aria-busy={cancel.isPending}
        className={cn('inline-flex items-center gap-1 disabled:opacity-50', className)}
      >
        {showIcon &&
          (cancel.isPending ? (
            <Loader className="h-3 w-3 animate-spin" />
          ) : (
            <X className="h-3 w-3" />
          ))}
        {cancel.isPending ? 'Cancelling…' : 'Cancel'}
      </button>
      {cancel.isError && (
        <p role="alert" className="text-caption text-danger-ink">
          {cancelAnalysisErrorMessage(cancel.error)}
        </p>
      )}
    </div>
  );
}
