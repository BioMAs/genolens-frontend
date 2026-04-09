import React from 'react';
import EnrichmentPlot from './EnrichmentPlot';
import { Dataset } from '@/types';

interface EnrichmentPlotMemoProps {
  dataset: Dataset;
  comparisonName?: string;
}

/**
 * Version mémoïsée d'EnrichmentPlot pour éviter les re-renders inutiles
 * Optimisation: évite le recalcul du graphique quand les props ne changent pas
 */
const EnrichmentPlotMemo = React.memo(
  EnrichmentPlot,
  (prevProps, nextProps) => {
    // Comparaison personnalisée des props
    return (
      prevProps.dataset.id === nextProps.dataset.id &&
      prevProps.comparisonName === nextProps.comparisonName &&
      prevProps.dataset.updated_at === nextProps.dataset.updated_at
    );
  }
);

EnrichmentPlotMemo.displayName = 'EnrichmentPlotMemo';

export default EnrichmentPlotMemo;
