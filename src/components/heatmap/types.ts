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
