import React from 'react';
import UMAPPlot from './UMAPPlot';
import { Dataset } from '@/types';

interface UMAPPlotMemoProps {
  dataset: Dataset;
  metadataDataset?: Dataset;
}

/**
 * Version mémoïsée d'UMAPPlot pour éviter les re-renders inutiles
 * Optimisation: évite le recalcul du graphique quand les props ne changent pas
 */
const UMAPPlotMemo = React.memo(
  UMAPPlot,
  (prevProps, nextProps) => {
    // Comparaison personnalisée des props
    return (
      prevProps.dataset.id === nextProps.dataset.id &&
      prevProps.dataset.status === nextProps.dataset.status &&
      prevProps.dataset.updated_at === nextProps.dataset.updated_at &&
      prevProps.metadataDataset?.id === nextProps.metadataDataset?.id &&
      prevProps.metadataDataset?.updated_at === nextProps.metadataDataset?.updated_at
    );
  }
);

UMAPPlotMemo.displayName = 'UMAPPlotMemo';

export default UMAPPlotMemo;
