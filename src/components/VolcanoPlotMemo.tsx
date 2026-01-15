'use client';

import { memo } from 'react';
import VolcanoPlot from './VolcanoPlot';
import { Dataset } from '@/types';

interface VolcanoPlotMemoProps {
  dataset: Dataset;
  logFCColumn?: string;
  pValColumn?: string;
}

// Memoized version of VolcanoPlot for performance
// Only re-renders if dataset ID or comparison name changes
const VolcanoPlotMemo = memo(
  VolcanoPlot,
  (prevProps, nextProps) => {
    return (
      prevProps.dataset.id === nextProps.dataset.id &&
      prevProps.comparisonName === nextProps.comparisonName
    );
  }
);

VolcanoPlotMemo.displayName = 'VolcanoPlotMemo';

export default VolcanoPlotMemo;
