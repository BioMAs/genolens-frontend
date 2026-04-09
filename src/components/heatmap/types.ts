import { Dataset } from '@/types';

export interface HeatmapPlotProps {
  degDataset: Dataset;
  matrixDataset: Dataset;
  sampleIds?: string[];
  comparisonName?: string;
}

export interface ClusteringParams {
  top_n_genes: number;
  method: string;
  metric: string;
  cluster_rows: boolean;
  cluster_cols: boolean;
}

export interface HeatmapData {
  z: number[][];
  x: string[];
  y: string[];
  logFCs: number[];
  type: string;
}

export interface HeatmapConfig {
  height: number;
  mainMargin: { l: number; r: number; b: number; t: number };
  sidebarMargin: { l: number; r: number; b: number; t: number };
  colorscale: string;
  logFCColorscale: string;
  zmin: number;
  zmax: number;
  logFCmin: number;
  logFCmax: number;
}

export interface TopNOption {
  value: number;
  label: string;
  description: string;
}

export type ExportFormat = 'png' | 'svg';
