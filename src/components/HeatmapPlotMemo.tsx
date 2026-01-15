'use client';

import { memo } from 'react';
import HeatmapPlot from './HeatmapPlot';
import { Dataset } from '@/types';

interface HeatmapPlotMemoProps {
  degDataset: Dataset;
  matrixDataset: Dataset;
  sampleIds?: string[];
  comparisonName: string;
}

// Memoized version of HeatmapPlot for performance
// Only re-renders if dataset IDs or comparison name changes
const HeatmapPlotMemo = memo(
  HeatmapPlot,
  (prevProps, nextProps) => {
    const sampleIdsEqual =
      JSON.stringify(prevProps.sampleIds) === JSON.stringify(nextProps.sampleIds);

    return (
      prevProps.degDataset.id === nextProps.degDataset.id &&
      prevProps.matrixDataset.id === nextProps.matrixDataset.id &&
      prevProps.comparisonName === nextProps.comparisonName &&
      sampleIdsEqual
    );
  }
);

HeatmapPlotMemo.displayName = 'HeatmapPlotMemo';

export default HeatmapPlotMemo;
