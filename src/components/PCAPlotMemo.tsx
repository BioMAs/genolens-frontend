'use client';

import { memo } from 'react';
import PCAPlot from './PCAPlot';
import { Dataset } from '@/types';

interface PCAPlotMemoProps {
  dataset: Dataset;
  metadataDataset?: Dataset;
}

// Memoized version of PCAPlot for performance
// Only re-renders if dataset IDs change
const PCAPlotMemo = memo(
  PCAPlot,
  (prevProps, nextProps) => {
    return (
      prevProps.dataset.id === nextProps.dataset.id &&
      prevProps.metadataDataset?.id === nextProps.metadataDataset?.id
    );
  }
);

PCAPlotMemo.displayName = 'PCAPlotMemo';

export default PCAPlotMemo;
