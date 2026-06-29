'use client';

import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import api from '@/utils/api';
import { Project, Dataset, DatasetType, DatasetStatus } from '@/types';
import { ArrowLeft, RefreshCw, TrendingUp, TrendingDown, Database, Calendar, Activity, Download } from 'lucide-react';
import DEGBarChart from './DEGBarChart';
import OverviewTopGenes from './OverviewTopGenes';
import Link from 'next/link';
import VolcanoPlot from './VolcanoPlot';
import DEGTable from './DEGTable';
import MethodStatsPanel from './MethodStatsPanel';
import AIInterpretationPanel from './AIInterpretationPanel';
import CustomVisualizationPanel from './CustomVisualizationPanel';
import ExportMenu from './ExportMenu';
import ComparisonReportButton from './ComparisonReportButton';
import ExternalIntegrationsPanel from './ExternalIntegrationsPanel';
import ClusteringAnalysis from './analysis/ClusteringAnalysis';
import DEGClusteringView from './analysis/DEGClusteringView';
import GOEnrichmentAnalysis from './GOEnrichmentAnalysis';
import CosmeticsTab from './cosmetics/CosmeticsTab';
import { formatDate } from '@/utils/formatters';
import { StatChip } from '@/components/ui/stat-chip';
import { Chip } from '@/components/ui/chip';
import { Dot } from '@/components/ui/dot';

interface ComparisonDetailProps {
  projectId: string;
  comparisonName: string;
  analysisId?: string;
}

type TabType = 'overview' | 'deg' | 'metrics' | 'enrichment' | 'cosmetics' | 'clustering' | 'integrations' | 'custom-viz';

type GenericRow = Record<string, unknown>;

type EnrichmentRow = {
  pathway_id?: string;
  term?: string;
  description?: string;
  pvalue?: number;
  padj?: number;
  geneRatio?: string;
  count?: number | string;
  genes?: string[];
  category?: string;
  regulation?: 'ALL' | 'UP' | 'DOWN' | string;
};

export default function ComparisonDetail({ projectId, comparisonName, analysisId }: ComparisonDetailProps) {
  const searchParams = useSearchParams();
  const globalDatasetId = searchParams.get('datasetId');

  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [project, setProject] = useState<Project | null>(null);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [relevantSamples, setRelevantSamples] = useState<string[]>([]);
  const [sampleConditionMap, setSampleConditionMap] = useState<Record<string, string>>({});
  const [reprocessing, setReprocessing] = useState(false);

  // State for statistics - must be declared before any conditional returns
  const [stats, setStats] = useState<{degUp: number, degDown: number, degTotal: number} | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  
  // State for all genes from matrix dataset (for gene expression query)
  const [allMatrixGenes, setAllMatrixGenes] = useState<string[]>([]);
  // Map ensemblId -> gene symbol (populated when matrix has a gene_name column)
  const [geneNameMap, setGeneNameMap] = useState<Record<string, string>>({});

  const handleReprocessDEG = async () => {
    if (!degDataset) return;

    try {
      setReprocessing(true);
      await api.post(`/datasets/${degDataset.id}/reprocess`);

      let pollCount = 0;
      const maxPolls = 120; // 120 * 5s = 10 minutes max

      // Poll for completion
      const pollInterval = setInterval(async () => {
        try {
          pollCount++;
          const resp = await api.get(`/datasets/${degDataset.id}`);

          if (resp.data.status === DatasetStatus.READY) {
            clearInterval(pollInterval);
            // Refresh datasets
            const dsResp = await api.get(`/datasets/project/${projectId}`);
            setDatasets(dsResp.data);
            setReprocessing(false);
          } else if (resp.data.status === DatasetStatus.FAILED) {
            clearInterval(pollInterval);
            setReprocessing(false);
            setError('Heatmap regeneration failed');
          } else if (pollCount >= maxPolls) {
            clearInterval(pollInterval);
            setReprocessing(false);
            setError('Heatmap regeneration timed out after 10 minutes');
          }
        } catch (err: unknown) {
          // Ignore ECONNABORTED errors during polling
          const errorCode = (err as { code?: string } | null)?.code;
          if (errorCode !== 'ECONNABORTED') {
            console.error('Polling error:', err);
          }
        }
      }, 5000); // Poll every 5 seconds

    } catch (err) {
      console.error('Failed to reprocess dataset:', err);
      setReprocessing(false);
      setError('Failed to start heatmap regeneration');
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Parallel fetch: project and datasets
        const [projResp, dsResp] = await Promise.all([
          api.get(`/projects/${projectId}`),
          api.get(`/datasets/project/${projectId}`)
        ]);
        setProject(projResp.data);
        const allDatasets = dsResp.data;
        setDatasets(allDatasets);
        setLoading(false);

        // Fetch Sample Metadata in parallel (don't block main loading)
        const metadataDataset = allDatasets.find((d: Dataset) => d.type === DatasetType.METADATA_SAMPLE && d.status === DatasetStatus.READY);
        if (metadataDataset) {
            try {
                // Reduced from 10,000 to 500 for performance - only need samples for this comparison
                const metaResp = await api.post(`/datasets/${metadataDataset.id}/query`, { limit: 500 });
                const metaData: GenericRow[] = Array.isArray(metaResp.data.data) ? metaResp.data.data : [];

                // Resolve actual column names from column_mapping (fallback to common alternatives)
                const cm = metadataDataset.column_mapping ?? {};
                const sampleCol: string = cm.sample_id || cm.sample || 'sample_id';
                const conditionCol: string = cm.condition || 'condition';

                const getSample = (row: GenericRow): string | undefined => {
                  const value = row[sampleCol] ?? row.sample ?? row['ini.sample.name'];
                  return value == null ? undefined : String(value);
                };
                const getCondition = (row: GenericRow): string | undefined => {
                  const value = row[conditionCol] ?? row.condition;
                  return value == null ? undefined : String(value);
                };

                // Parse comparison name to find relevant samples
                // Expected format: ConditionA_vs_ConditionB
                const decodedName = decodeURIComponent(comparisonName);
                const parts = decodedName.split('_vs_');

                if (parts.length === 2) {
                    const [cond1, cond2] = parts;
                    const filteredMeta = metaData.filter((row: GenericRow) => {
                        const cond = getCondition(row);
                        return cond === cond1 || cond === cond2;
                    });
                    const relevant = filteredMeta.map(getSample).filter(Boolean) as string[];
                    setRelevantSamples(relevant);

                    // Build sample→condition map for GeneExpressionViewer
                    const condMap: Record<string, string> = {};
                    filteredMeta.forEach((row: GenericRow) => {
                        const sampleName = getSample(row);
                        const cond = getCondition(row);
                        if (sampleName && cond) condMap[sampleName] = cond;
                    });
                    setSampleConditionMap(condMap);
                } else {
                    const filteredMeta = metaData.filter((row: GenericRow) => {
                        const cond = getCondition(row);
                        return cond && decodedName.includes(cond);
                    });
                    const relevant = filteredMeta.map(getSample).filter(Boolean) as string[];
                    setRelevantSamples(relevant);

                    const condMap: Record<string, string> = {};
                    filteredMeta.forEach((row: GenericRow) => {
                        const sampleName = getSample(row);
                        const cond = getCondition(row);
                        if (sampleName && cond) condMap[sampleName] = cond;
                    });
                    setSampleConditionMap(condMap);
                }

            } catch (err) {
                console.error('Failed to fetch sample metadata:', err);
            }
        }

      } catch (err) {
        console.error('Failed to fetch data:', err);
        setError('Failed to load comparison details.');
        setLoading(false);
      }
    };
    fetchData();
  }, [projectId, comparisonName]);

  // Compute derived values using useMemo to ensure they're available before early returns
  const decodedName = useMemo(() => decodeURIComponent(comparisonName), [comparisonName]);

  // Scope candidate datasets to the current analysis (when known) so comparisons
  // from OTHER analyses sharing the same name don't bleed in ("mélange entre
  // analyses"). Falls back to the full project list if the analysis has none.
  const scopedDatasets = useMemo(() => {
    if (!datasets || datasets.length === 0) return [];
    if (analysisId) {
      const inAnalysis = datasets.filter(d => d.dataset_metadata?.analysis_id === analysisId);
      if (inAnalysis.length > 0) return inAnalysis;
    }
    return datasets;
  }, [datasets, analysisId]);

  const degDataset = useMemo(() => {
    if (globalDatasetId) {
      return datasets.find(d => d.id === globalDatasetId);
    }
    if (scopedDatasets.length === 0) return undefined;
    const matches = scopedDatasets.filter(d =>
      d.type === DatasetType.DEG && (
        d.dataset_metadata?.comparison_name === decodedName ||
        d.name === decodedName ||
        (Array.isArray(d.dataset_metadata?.comparisons) && (d.dataset_metadata.comparisons as unknown[]).includes(decodedName)) ||
        (d.dataset_metadata?.comparisons && typeof d.dataset_metadata.comparisons === 'object' && !Array.isArray(d.dataset_metadata.comparisons) && decodedName in (d.dataset_metadata.comparisons as object))
      )
    );
    // Prefer a READY dataset so failed/old duplicates are never picked.
    return matches.find(d => d.status === DatasetStatus.READY) ?? matches[0];
  }, [scopedDatasets, datasets, globalDatasetId, decodedName]);

  // Derive the actual comparison name from dataset metadata.
  // When the URL contains the dataset display name (e.g. "DEG Analysis — KO vs WT")
  // instead of the stored comparison key (e.g. "KO_vs_WT"), extract the correct key.
  const actualComparisonName = useMemo(() => {
    if (!degDataset) return decodedName;
    const meta = degDataset.dataset_metadata;
    if (meta?.comparison_name) return meta.comparison_name;
    if (Array.isArray(meta?.comparisons) && meta.comparisons.length > 0) return meta.comparisons[0];
    return decodedName;
  }, [degDataset, decodedName]);

  const enrichmentDataset = useMemo(() => {
    if (scopedDatasets.length === 0) return undefined;

    const byName = scopedDatasets.filter(d => d.type === DatasetType.ENRICHMENT && (
      d.dataset_metadata?.comparison_name === actualComparisonName ||
      d.dataset_metadata?.comparison_name === decodedName ||
      d.name === decodedName
    ));

    // Also match enrichment files via enrichment_comparisons metadata
    const byComparisons = scopedDatasets.filter(d =>
      d.type === DatasetType.ENRICHMENT &&
      Array.isArray(d.dataset_metadata?.enrichment_comparisons) &&
      ((d.dataset_metadata.enrichment_comparisons as unknown[]).includes(actualComparisonName) ||
       (d.dataset_metadata.enrichment_comparisons as unknown[]).includes(decodedName))
    );

    const matches = byName.length > 0 ? byName : byComparisons;
    // Prefer a READY dataset so failed/old duplicates are never picked.
    return matches.find(d => d.status === DatasetStatus.READY) ?? matches[0];
  }, [scopedDatasets, decodedName, actualComparisonName]);

  const matrixDataset = useMemo(() => {
    if (!datasets || datasets.length === 0) return undefined;
    return datasets.find(d => d.type === DatasetType.MATRIX && d.status === DatasetStatus.READY);
  }, [datasets]);

  // Fetch all genes from matrix dataset for gene expression query
  useEffect(() => {
    if (!matrixDataset) return;

    const fetchAllGenes = async () => {
      // Strategy 1: use /genes/map endpoint (new backend) — fast, alignment-safe
      try {
        const mapResp = await api.get(`/datasets/${matrixDataset.id}/genes/map`, {
          params: { primary_column: 'gene_id', secondary_column: 'gene_name' }
        });
        const geneMap: Record<string, string> = mapResp.data.gene_map || {};
        if (Object.keys(geneMap).length > 0) {
          setAllMatrixGenes(Object.keys(geneMap));
          setGeneNameMap(geneMap);
          return;
        }
      } catch {
        // endpoint absent or columns missing — fall through
      }

      // Strategy 2: query endpoint with gene_id + gene_name columns — works with any
      // backend version; builds the map row-by-row to avoid alignment issues.
      try {
        const queryResp = await api.post(`/datasets/${matrixDataset.id}/query`, {
          limit: 100000,
          columns: ['gene_id', 'gene_name'],
        });
          const rows: GenericRow[] = Array.isArray(queryResp.data.data) ? queryResp.data.data : [];
        const availableCols: string[] = queryResp.data.columns || [];

        const hasGeneId = availableCols.includes('gene_id');
        const hasGeneName = availableCols.includes('gene_name');

        if (hasGeneId) {
          const geneIds: string[] = [];
          const map: Record<string, string> = {};
            rows.forEach((row: GenericRow) => {
            const id = row['gene_id'];
            if (!id) return;
            geneIds.push(String(id));
            const name = row['gene_name'];
            if (name) map[String(id)] = String(name);
          });
          setAllMatrixGenes(geneIds);
          if (Object.keys(map).length > 0) setGeneNameMap(map);
          return;
        }

        // No gene_id column — matrix uses gene_name as primary key
        if (hasGeneName) {
            const geneNames = rows.map((r: GenericRow) => r['gene_name']).filter(Boolean).map(String);
          setAllMatrixGenes(geneNames);
          return;
        }
      } catch {
        // query endpoint failed — fall through to /genes/list
      }

      // Strategy 3: last resort — gene_id list only (no symbol search)
      try {
        const listResp = await api.get(`/datasets/${matrixDataset.id}/genes/list`, {
          params: { gene_column: 'gene_id' }
        });
        setAllMatrixGenes(listResp.data.genes || []);
      } catch (err) {
        console.error('Failed to fetch matrix genes:', err);
      }
    };

    fetchAllGenes();
  }, [matrixDataset]);

  // Calculate or fetch statistics from DEG dataset
  useEffect(() => {
    if (!degDataset) return;

    const metadata = degDataset.dataset_metadata as Record<string, unknown> | undefined;
    const toNumber = (value: unknown): number => {
      if (typeof value === 'number') return value;
      if (typeof value === 'string') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
      }
      return 0;
    };
    const comparisons =
      metadata?.comparisons && typeof metadata.comparisons === 'object' && !Array.isArray(metadata.comparisons)
        ? (metadata.comparisons as Record<string, Record<string, unknown>>)
        : undefined;

    // Check if stats already exist in metadata
    if (metadata?.deg_up !== undefined && metadata?.deg_down !== undefined) {
      const degUp = toNumber(metadata.deg_up);
      const degDown = toNumber(metadata.deg_down);
      const degTotal = metadata.deg_total !== undefined ? toNumber(metadata.deg_total) : degUp + degDown;

      // Stats exist at top level (for individual comparison datasets)
      setStats({
        degUp,
        degDown,
        degTotal,
      });
      return;
    }

    if (globalDatasetId && comparisons?.[decodedName]) {
      const compData = comparisons[decodedName];
      if (compData.deg_up !== undefined && compData.deg_down !== undefined) {
        // Stats exist in comparisons metadata (for global DEG files)
        setStats({
          degUp: toNumber(compData.deg_up),
          degDown: toNumber(compData.deg_down),
          degTotal: toNumber(compData.deg_total)
        });
        return;
      }
    }

    // Stats don't exist - fetch them using optimized endpoint
    const fetchStatsFromAPI = async () => {
      setStatsLoading(true);
      try {
        // OPTIMIZATION: Use new /stats endpoint instead of fetching 100K rows
        // Old: Fetch 100K rows + calculate in JavaScript (5-15 MB + 1-2s CPU)
        // New: Backend calculates stats (<1 KB, <500ms)
        const response = await api.get(`/datasets/${degDataset.id}/stats`, {
          params: globalDatasetId ? { comparison_name: decodedName } : {}
        });

        const { up_genes, down_genes, total_genes, significant_genes } = response.data;
        
        // Convert to expected format
        const newStats = {
          degUp: up_genes || 0,
          degDown: down_genes || 0,
          degTotal: significant_genes || total_genes || 0
        };
        
        setStats(newStats);

        // Save statistics back to database metadata for future use
        const updatedMetadata = globalDatasetId
          ? {
              comparisons: {
                ...comparisons,
                [decodedName]: {
                  ...comparisons?.[decodedName],
                  deg_up: newStats.degUp,
                  deg_down: newStats.degDown,
                  deg_total: newStats.degTotal
                }
              }
            }
          : {
              ...metadata,
              deg_up: newStats.degUp,
              deg_down: newStats.degDown,
              deg_total: newStats.degTotal
            };

        await api.patch(`/datasets/${degDataset.id}`, {
          dataset_metadata: updatedMetadata
        });

        console.log('DEG statistics fetched and saved:', newStats);
        setStatsLoading(false);
      } catch (err) {
        console.error('Failed to fetch DEG statistics from API:', err);
        // Fallback to old computation method
        await computeAndSaveStatsLegacy();
      }
    };

    // Legacy fallback computation method (kept for compatibility)
    const computeAndSaveStatsLegacy = async () => {
      setStatsLoading(true);
      try {
        // Query the dataset to get all DEG data
        const response = await api.post(`/datasets/${degDataset.id}/query`, {
          limit: 100000 // Get all genes
        });

        const data = response.data.data;
        const columns = response.data.columns;

        // Find the relevant columns for this comparison
        let logFCCol: string | null = null;
        let padjCol: string | null = null;

        // For global dataset, find columns for this comparison
        if (globalDatasetId) {
          const compData = comparisons?.[decodedName];
          logFCCol = typeof compData?.logFC === 'string' ? compData.logFC : null;
          padjCol = typeof compData?.padj === 'string' ? compData.padj : null;
        } else {
          // For individual comparison dataset, find any logFC/padj columns
          logFCCol = columns.find((c: string) =>
            c.includes('log2FoldChange') || c.includes('logFC')
          ) || null;
          padjCol = columns.find((c: string) =>
            c.includes('padj') || c.includes('adj.P.Val') || c.includes('FDR')
          ) || null;
        }

        if (!logFCCol || !padjCol) {
          console.warn('Could not find logFC or padj columns');
          setStats({ degUp: 0, degDown: 0, degTotal: 0 });
          return;
        }

        // Calculate statistics using EXACT same logic as DEG table
        // Check if contrast column exists
        const contrastCol = `contrast:${decodedName}`;
        const hasContrastCol = columns.includes(contrastCol);

        console.log('[ComparisonDetail] Contrast column:', contrastCol, 'Found:', hasContrastCol);

        let degUp = 0;
        let degDown = 0;
        let degTotal = 0;

          if (hasContrastCol) {
          // Use contrast column to count (matches DEG table logic exactly)
            (Array.isArray(data) ? data : []).forEach((row: GenericRow) => {
            const contrastValue = row[contrastCol];

            // Only count rows with non-empty contrast values
            if (contrastValue && contrastValue !== '' && contrastValue !== null) {
              const upperValue = String(contrastValue).toUpperCase();
              if (upperValue === 'UP') {
                degUp++;
                degTotal++;
              } else if (upperValue === 'DOWN') {
                degDown++;
                degTotal++;
              }
            }
          });
        } else {
          // Fallback: use logFC sign (old method)
          const logFCThreshold = 0.58;
          const padjThreshold = 0.05;

            const logFCCol = columns.find((c: string) => c.includes('log2FoldChange') || c.includes('logFC'));
            const padjCol = columns.find((c: string) => c.includes('padj') || c.includes('adj.P.Val') || c.includes('FDR'));

            if (!logFCCol || !padjCol) {
              setStats({ degUp: 0, degDown: 0, degTotal: 0 });
              return;
            }

            (Array.isArray(data) ? data : []).forEach((row: GenericRow) => {
              const logFC = Number(row[logFCCol]);
              const padj = Number(row[padjCol]);

            // Filter: padj < 0.05 AND |logFC| > 0.58
              if (Number.isFinite(logFC) && Number.isFinite(padj) && padj < padjThreshold && Math.abs(logFC) > logFCThreshold) {
              degTotal++;
              if (logFC > 0) {
                degUp++;
              } else {
                degDown++;
              }
            }
          });
        }

        console.log('[ComparisonDetail] Calculated stats:', { degUp, degDown, degTotal });

        const newStats = { degUp, degDown, degTotal };
        setStats(newStats);

        // Save statistics back to database
        const updatedMetadata = globalDatasetId
          ? {
              comparisons: {
                ...comparisons,
                [decodedName]: {
                  ...comparisons?.[decodedName],
                  deg_up: degUp,
                  deg_down: degDown,
                  deg_total: degTotal
                }
              }
            }
          : {
              ...metadata,
              deg_up: degUp,
              deg_down: degDown,
              deg_total: degTotal
            };

        await api.patch(`/datasets/${degDataset.id}`, {
          dataset_metadata: updatedMetadata
        });

        console.log('DEG statistics calculated and saved:', newStats);
      } catch (err) {
        console.error('Failed to compute DEG statistics:', err);
        setStats({ degUp: 0, degDown: 0, degTotal: 0 });
      } finally {
        setStatsLoading(false);
      }
    };

    fetchStatsFromAPI();
  }, [degDataset, decodedName, globalDatasetId]);

  if (loading) return <div className="p-8 text-center">Loading...</div>;
  if (error) return <div className="p-8 text-center text-red-600">{error}</div>;
  if (!project) return <div className="p-8 text-center">Project not found</div>;

  if (!degDataset) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Link href={analysisId ? `/projects/${projectId}/analyses/${analysisId}` : `/projects/${projectId}`} className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4">
            <ArrowLeft className="mr-1 h-4 w-4" /> {analysisId ? 'Back to Analysis' : 'Back to Project'}
          </Link>
          <div className="bg-yellow-50 p-4 rounded-md mt-4">
            <p className="text-yellow-700">No Differential Expression (DEG) dataset found for this comparison.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <Link
        href={analysisId ? `/projects/${projectId}/analyses/${analysisId}` : `/projects/${projectId}`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm"
        style={{ color: 'var(--text-secondary)' }}
      >
        <ArrowLeft className="h-4 w-4" /> {analysisId ? 'Back to Analysis' : 'Back to Project'}
      </Link>

      <div className="gl-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="page-title">{decodedName}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <span className="inline-flex items-center gap-1.5">
                <Database className="h-4 w-4" /> Project: {project.name}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-4 w-4" /> Created {formatDate(degDataset.created_at)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ComparisonReportButton datasetId={degDataset.id} comparisonName={actualComparisonName} />
            <button
              onClick={handleReprocessDEG}
              disabled={reprocessing}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold"
              style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${reprocessing ? 'animate-spin' : ''}`} />
              {reprocessing ? 'Reprocessing…' : 'Reprocess'}
            </button>
          </div>
        </div>

        {statsLoading ? (
          <div className="mt-4 inline-flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
            <RefreshCw className="h-4 w-4 animate-spin" /> Calculating DEG statistics...
          </div>
        ) : stats ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <StatChip
              icon={<TrendingUp className="h-4 w-4" />}
              value={stats.degUp}
              label="Upregulated"
              tone="teal"
            />
            <StatChip
              icon={<TrendingDown className="h-4 w-4" />}
              value={stats.degDown}
              label="Downregulated"
              tone="purple"
            />
            <StatChip
              icon={<Activity className="h-4 w-4" />}
              value={stats.degTotal}
              label="Total DEGs"
              tone="neutral"
            />
            <StatChip
              icon={<Database className="h-4 w-4" />}
              value={enrichmentDataset ? 1 : 0}
              label="Enrichment"
              tone="neutral"
            />
          </div>
        ) : null}
      </div>

      {/* Tabs */}
      <div className="mt-4 gl-card overflow-hidden">
        <div className="border-b" style={{ borderColor: 'var(--border)' }}>
          <nav className="flex overflow-x-auto px-2 py-2">
              <button
                onClick={() => setActiveTab('overview')}
                className="whitespace-nowrap rounded-lg px-3 py-1.5 font-medium text-sm transition-colors"
                style={
                  activeTab === 'overview'
                    ? { color: 'var(--sl-teal-dark)', background: 'var(--sl-teal-light)' }
                    : { color: 'var(--text-secondary)' }
                }
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab('deg')}
                className="whitespace-nowrap rounded-lg px-3 py-1.5 font-medium text-sm transition-colors"
                style={
                  activeTab === 'deg'
                    ? { color: 'var(--sl-teal-dark)', background: 'var(--sl-teal-light)' }
                    : { color: 'var(--text-secondary)' }
                }
              >
                DEG Table
              </button>
              <button
                onClick={() => setActiveTab('metrics')}
                className="whitespace-nowrap rounded-lg px-3 py-1.5 font-medium text-sm transition-colors"
                style={
                  activeTab === 'metrics'
                    ? { color: 'var(--sl-teal-dark)', background: 'var(--sl-teal-light)' }
                    : { color: 'var(--text-secondary)' }
                }
              >
                Method statistics
              </button>
              <button
                onClick={() => setActiveTab('enrichment')}
                className="whitespace-nowrap rounded-lg px-3 py-1.5 font-medium text-sm transition-colors"
                style={
                  activeTab === 'enrichment'
                    ? { color: 'var(--sl-teal-dark)', background: 'var(--sl-teal-light)' }
                    : { color: 'var(--text-secondary)' }
                }
              >
                Enrichment
              </button>
              <button
                onClick={() => setActiveTab('cosmetics')}
                className="whitespace-nowrap rounded-lg px-3 py-1.5 font-medium text-sm transition-colors"
                style={
                  activeTab === 'cosmetics'
                    ? { color: 'var(--sl-teal-dark)', background: 'var(--sl-teal-light)' }
                    : { color: 'var(--text-secondary)' }
                }
              >
                Claims
              </button>
              <button
                onClick={() => setActiveTab('clustering')}
                className="whitespace-nowrap rounded-lg px-3 py-1.5 font-medium text-sm transition-colors"
                style={
                  activeTab === 'clustering'
                    ? { color: 'var(--sl-teal-dark)', background: 'var(--sl-teal-light)' }
                    : { color: 'var(--text-secondary)' }
                }
              >
                Clustering
                {!matrixDataset && (
                  <span className="ml-1 text-xs opacity-50">(N/A)</span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('integrations')}
                className="whitespace-nowrap rounded-lg px-3 py-1.5 font-medium text-sm transition-colors"
                style={
                  activeTab === 'integrations'
                    ? { color: 'var(--sl-teal-dark)', background: 'var(--sl-teal-light)' }
                    : { color: 'var(--text-secondary)' }
                }
              >
                Integrations
              </button>
              {/* Custom Visualizations tab - hidden for now */}
              {false && (
                <button
                  onClick={() => setActiveTab('custom-viz')}
                  className={`${
                    activeTab === 'custom-viz'
                      ? 'border-brand-primary text-brand-primary'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm transition-colors`}
                >
                  Custom Visualizations
                </button>
              )}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-5">
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
                  <div className="xl:col-span-8 space-y-4">
                    {/* Volcano Plot */}
                    <div className="gl-card p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <div>
                          <h2 className="font-display text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                            Volcano Plot
                          </h2>
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            log2FC threshold: 0.58 · padj: 0.05
                          </p>
                        </div>
                        <Link
                          href={`/projects/${projectId}/datasets/${degDataset.id}`}
                          className="text-xs font-semibold"
                          style={{ color: 'var(--sl-teal-dark)' }}
                        >
                          View dataset
                        </Link>
                      </div>

                      <VolcanoPlot dataset={degDataset} comparisonName={actualComparisonName} />

                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                        <span className="inline-flex items-center gap-1">
                          <Dot variant="ready" size={7} /> Upregulated
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Dot variant="failed" size={7} /> Downregulated
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Dot variant="pending" size={7} /> Not significant
                        </span>
                        {stats ? <Chip>{stats.degTotal.toLocaleString()} significant genes</Chip> : null}
                      </div>
                    </div>

                    {/* Top up / down genes — simple list */}
                    <div className="gl-card p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="font-display text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                          Top differentially expressed genes
                        </h3>
                        <button
                          type="button"
                          onClick={() => setActiveTab('deg')}
                          className="text-xs font-semibold"
                          style={{ color: 'var(--sl-teal-dark)' }}
                        >
                          Full DEG table →
                        </button>
                      </div>
                      <OverviewTopGenes dataset={degDataset} comparisonName={actualComparisonName} />
                    </div>
                  </div>

                  <div className="xl:col-span-4 space-y-4">
                    <AIInterpretationPanel datasetId={degDataset.id} comparisonName={actualComparisonName} />
                  </div>
                </div>
              </div>
            )}

            {/* DEG Tab */}
            {activeTab === 'deg' && (
              <div className="space-y-6">
                {/* Top DEG Bar Chart */}
                <div>
                  <DEGBarChart dataset={degDataset} comparisonName={actualComparisonName} />
                </div>

                {/* DEG Table */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-gray-900">Differentially Expressed Genes</h2>
                    <button
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white hover:bg-gray-50 text-gray-700"
                      onClick={async () => {
                        try {
                          const response = await api.get(
                            `/datasets/${degDataset.id}/deg-stats/export`,
                            {
                              params: { comparison: actualComparisonName },
                              responseType: 'blob',
                            }
                          );
                          const url = URL.createObjectURL(new Blob([response.data]));
                          const link = document.createElement('a');
                          link.href = url;
                          link.download = `deg_stats_${actualComparisonName}.csv`;
                          link.click();
                          URL.revokeObjectURL(url);
                        } catch (e) {
                          console.error('DEG stats download failed', e);
                        }
                      }}
                    >
                      <Download className="w-4 h-4" />
                      Download DEG — per-method p-values (.csv)
                    </button>
                  </div>
                  <p className="text-sm text-gray-600 mb-4">Browse all differentially expressed genes with filtering and sorting capabilities.</p>
                  <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <DEGTable dataset={degDataset} comparisonName={actualComparisonName} />
                  </div>
                </div>
              </div>
            )}

            {/* Method statistics Tab (per-method p-values + Stouffer) */}
            {activeTab === 'metrics' && (
              <MethodStatsPanel datasetId={degDataset.id} comparisonName={actualComparisonName} />
            )}

            {/* Enrichment Tab */}
            {activeTab === 'enrichment' && (
              degDataset ? (
                <GOEnrichmentAnalysis
                  dataset={degDataset}
                  enrichmentDataset={enrichmentDataset}
                  comparisonName={actualComparisonName}
                />
              ) : (
                <div className="text-center py-16">
                  <Database className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No DEG data</h3>
                  <p className="text-sm text-gray-500 max-w-sm mx-auto">
                    Enrichment requires a DEG dataset associated with this comparison.
                  </p>
                </div>
              )
            )}

            {/* Cosmetics (Claims) Tab — always visible; locked teaser when not unlocked */}
            {activeTab === 'cosmetics' && (
              <CosmeticsTab
                datasetId={degDataset?.id}
                comparisonName={actualComparisonName}
              />
            )}

            {/* Clustering Tab */}
            {activeTab === 'clustering' && (
              matrixDataset && degDataset ? (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Heatmap — DEG Genes</h2>
                    <p className="text-sm text-gray-600 mb-4">
                      Visualization of differentially expressed genes (DEGs) for the samples in this comparison only.
                    </p>
                    <DEGClusteringView
                      degDataset={degDataset}
                      matrixDataset={matrixDataset}
                      sampleIds={relevantSamples.length > 0 ? relevantSamples : undefined}
                      comparisonName={actualComparisonName}
                      sampleConditionMap={Object.keys(sampleConditionMap).length > 0 ? sampleConditionMap : undefined}
                    />
                  </div>
                </div>
              ) : matrixDataset ? (
                <ClusteringAnalysis
                  projectId={projectId}
                  datasetId={matrixDataset.id}
                  datasetName={matrixDataset.name}
                />
              ) : (
                <div className="text-center py-16">
                  <Database className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No expression matrix</h3>
                  <p className="text-sm text-gray-500 max-w-sm mx-auto">
                    Clustering requires an expression matrix (count matrix).
                    Upload a matrix of type &quot;Expression Matrix&quot; to enable this view.
                  </p>
                </div>
              )
            )}

            {/* External Integrations Tab */}
            {activeTab === 'integrations' && (
              <ExternalIntegrationsPanel
                genesToPreload={allMatrixGenes.slice(0, 50)}
              />
            )}

            {/* Custom Visualizations Tab */}
            {activeTab === 'custom-viz' && (
              <div>
                <CustomVisualizationPanel 
                  datasetId={degDataset.id} 
                  comparisonName={actualComparisonName}
                  allGenes={allMatrixGenes}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    );
    }

// Component for enrichment table
function EnrichmentTable({ dataset, comparisonName }: { dataset: Dataset, comparisonName: string }) {
  const [data, setData] = useState<EnrichmentRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterText, setFilterText] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
    const [availableCategories, setAvailableCategories] = useState<string[]>([]);
    const [padjThreshold, setPadjThreshold] = useState(0.05);
    const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
    const [itemsPerPage, setItemsPerPage] = useState(25);
    const [regulationFilter, setRegulationFilter] = useState<'ALL' | 'UP' | 'DOWN'>('ALL');

    useEffect(() => {
        const fetchData = async () => {
            try {
                console.log('[EnrichmentTable] Fetching enrichment for comparison:', comparisonName);
                console.log('[EnrichmentTable] Dataset ID:', dataset.id);

                // NEW: Use database API for much faster loading (<100ms vs 2-5s)
                const response = await api.get(
                    `/datasets/${dataset.id}/enrichment-pathways/${encodeURIComponent(comparisonName)}`,
                    {
                        params: {
                            regulation: regulationFilter,
                            page: 1,
                            page_size: 1000, // Max allowed by backend
                            padj_max: 1.0, // Load all, filter client-side
                            sort_by: 'padj',
                            sort_order: 'asc'
                        }
                    }
                );

                console.log('[EnrichmentTable] API Response:', response.data);
                const pathways = response.data.pathways || [];
                console.log('[EnrichmentTable] Pathways count:', pathways.length);

                // If no data from database, throw error to trigger Parquet fallback
                if (pathways.length === 0) {
                    console.warn('[EnrichmentTable] ⚠️ No pathways from database - triggering Parquet fallback');
                    throw new Error('No pathways in database, using Parquet fallback');
                }

                // Extract unique categories
                const categories = [...new Set(pathways.map((p: GenericRow) => p.category).filter(Boolean).map(String))];
                setAvailableCategories(categories as string[]);

                // Transform database format to component format
                const processedData: EnrichmentRow[] = pathways.map((pathway: GenericRow) => {
                  const geneRatioValue = Number(pathway.gene_ratio);
                  const geneCountValue = Number(pathway.gene_count);
                  const bgRatioValue = Number(pathway.bg_ratio);

                  const row: EnrichmentRow = {
                    pathway_id: pathway.pathway_id ? String(pathway.pathway_id) : undefined,
                    term: pathway.pathway_name ? String(pathway.pathway_name) : undefined,
                    description: pathway.description ? String(pathway.description) : undefined,
                    pvalue: Number(pathway.pvalue ?? pathway.padj),
                    padj: Number(pathway.padj),
                    geneRatio: Number.isFinite(geneRatioValue)
                      ? geneRatioValue.toFixed(3)
                      : (Number.isFinite(geneCountValue) && Number.isFinite(bgRatioValue)
                        ? (geneCountValue * bgRatioValue).toFixed(3)
                        : 'N/A'),
                    count: Number.isFinite(geneCountValue) ? geneCountValue : 'N/A',
                    genes: Array.isArray(pathway.genes) ? pathway.genes.map(String) : [],
                    category: pathway.category ? String(pathway.category) : undefined,
                    regulation: pathway.regulation ? String(pathway.regulation) : 'ALL',
                  };

                  return row;
                });

                console.log(`[EnrichmentTable] Processed ${processedData.length} pathways from database`);
                console.log('[EnrichmentTable] First pathway sample:', processedData[0]);
                
                setData(processedData);
                console.log('[EnrichmentTable] ✅ setData called with', processedData.length, 'pathways');
                
                if (processedData.length === 0) {
                    console.warn('[EnrichmentTable] ⚠️ No enrichment data found for this comparison');
                }
            } catch (err) {
                console.error('Failed to fetch enrichment table from database:', err);
                // Fallback to old method if database API fails
                console.warn('[EnrichmentTable] Falling back to Parquet loading');
                try {
                    const response = await api.post(`/datasets/${dataset.id}/query`, {
                        limit: 50000 // Increased to load all pathways
                    });

                    let rawData = response.data.data;
                    const cols = response.data.columns;
                    
                    console.log('[EnrichmentTable] 📦 Parquet fallback - Raw data count:', rawData.length);
                    console.log('[EnrichmentTable] 📦 Columns:', cols);

                    // Filter by comparison
                    const clusterCol = cols.find((c: string) =>
                        c.toLowerCase() === 'gene_cluster' ||
                        c.toLowerCase() === 'genecluster' ||
                        c.toLowerCase() === 'gene.cluster' ||
                        c.toLowerCase() === 'cluster'
                    );

                    if (clusterCol) {
                        rawData = rawData.filter((row: GenericRow) => {
                            const clusterValue = String(row[clusterCol] || '');
                            const cleanCluster = clusterValue.includes(':') ? clusterValue.split(':').pop() : clusterValue;
                            return cleanCluster?.includes(comparisonName) ||
                                   cleanCluster?.replace(/_up|_down|_upregulated|_downregulated/gi, '') === comparisonName;
                        });
                    }

                    // Find columns
                    const termCol = cols.find((c: string) => c.toLowerCase() === 'term' || c.toLowerCase().includes('description'));
                    const pvalCol = cols.find((c: string) => c === 'adj.p.hyper.enri' || c.toLowerCase().includes('adj.p'));
                    const rCol = cols.find((c: string) => c === 'r');
                    const rExpectedCol = cols.find((c: string) => c === 'rExpected');
                    const categoryCol = cols.find((c: string) => c.toLowerCase() === 'category');
                    const genesCol = cols.find((c: string) => c.toLowerCase() === 'genes');
                    
                    console.log('[EnrichmentTable] 🔍 Column mapping:', { termCol, pvalCol, rCol, rExpectedCol, categoryCol, genesCol });

                    // Sort by p-value and process all
                      const processedData: EnrichmentRow[] = rawData
                        .filter((row: GenericRow) => pvalCol ? Number(row[pvalCol]) > 0 : false)
                        .sort((a: GenericRow, b: GenericRow) => {
                            if (!pvalCol) return 0;
                            return Number(a[pvalCol]) - Number(b[pvalCol]);
                        })
                        .map((row: GenericRow) => ({
                            term: termCol ? String(row[termCol] ?? '') : undefined,
                            pvalue: pvalCol ? Number(row[pvalCol]) : undefined,
                            padj: pvalCol ? Number(row[pvalCol]) : undefined,
                            geneRatio: rCol && rExpectedCol ? (Number(row[rCol]) / Number(row[rExpectedCol])).toFixed(3) : 'N/A',
                            count: rCol ? Number(row[rCol]) : 'N/A',
                            category: categoryCol && row[categoryCol] ? String(row[categoryCol]) : undefined,
                            genes: genesCol ? (row[genesCol] ? String(row[genesCol]).split('|') : []) : []
                        }));

                    console.log(`[EnrichmentTable] 📦 Loaded ${processedData.length} pathways from Parquet fallback`);
                    console.log('[EnrichmentTable] 📦 First fallback pathway:', processedData[0]);

                    // Extract unique categories for fallback data
                      const categories = [...new Set(processedData.map((p) => p.category).filter(Boolean).map(String))];
                    setAvailableCategories(categories as string[]);

                    setData(processedData);
                    console.log('[EnrichmentTable] ✅ Fallback setData called with', processedData.length, 'pathways');
                } catch (fallbackErr) {
                    console.error('Fallback also failed:', fallbackErr);
                }
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [dataset, comparisonName, regulationFilter]);

    console.log('[EnrichmentTable] 🎨 Render - loading:', loading, 'data.length:', data.length);
    
    if (loading) return <div className="text-sm text-gray-500">Loading enrichment data...</div>;
    if (data.length === 0) {
        console.error('[EnrichmentTable] ❌ Rendering empty state - data.length is 0');
        return <div className="text-sm text-gray-500">No enrichment data available for this comparison.</div>;
    }

    // Filter data based on search, categories, and padj threshold
    const filteredData = data.filter(row => {
        const matchesText = !filterText || row.term?.toLowerCase().includes(filterText.toLowerCase());
        const matchesCategory = categoryFilter.length === 0 || categoryFilter.includes(row.category || '');
        const matchesPadj = !row.padj || row.padj <= padjThreshold;
        return matchesText && matchesCategory && matchesPadj;
    });

    return (
        <div className="space-y-4">
          {/* Filters - Compact Bar */}
          <div className="flex gap-4 items-center flex-wrap bg-gray-50 px-4 py-3 rounded-md border border-gray-200">
            {/* Search Input */}
            <div className="flex-1 min-w-50">
              <input
                type="text"
                placeholder="Search pathways..."
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-primary focus:ring-brand-primary sm:text-sm px-3 py-1.5 border"
              />
            </div>
            
            {/* Category Multi-Select */}
            {availableCategories.length > 0 && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                  className="inline-flex items-center gap-2 px-3 py-1.5 border border-gray-300 rounded-md bg-white hover:bg-gray-50 text-sm"
                >
                  <span className="text-gray-700">
                    {categoryFilter.length === 0 
                      ? 'All Categories' 
                      : `${categoryFilter.length} selected`}
                  </span>
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {showCategoryDropdown && (
                  <div className="absolute z-10 mt-1 w-64 bg-white border border-gray-200 rounded-md shadow-lg">
                    <div className="p-2 space-y-1 max-h-64 overflow-y-auto">
                      <label className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={categoryFilter.length === 0}
                          onChange={() => setCategoryFilter([])}
                          className="rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
                        />
                        <span className="text-sm text-gray-700">All Categories</span>
                      </label>
                      {availableCategories.map((cat) => (
                        <label key={cat} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer">
                          <input
                            type="checkbox"
                            checked={categoryFilter.includes(cat)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setCategoryFilter([...categoryFilter, cat]);
                              } else {
                                setCategoryFilter(categoryFilter.filter(c => c !== cat));
                              }
                            }}
                            className="rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
                          />
                          <span className="text-sm text-gray-700">{cat}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* Regulation Filter */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600 whitespace-nowrap">Regulation:</label>
              <select
                value={regulationFilter}
                onChange={(e) => setRegulationFilter(e.target.value as 'ALL' | 'UP' | 'DOWN')}
                className="px-3 py-1.5 border border-gray-300 rounded-md bg-white text-sm"
              >
                <option value="ALL">All genes</option>
                <option value="UP">↑ Upregulated</option>
                <option value="DOWN">↓ Downregulated</option>
              </select>
            </div>
            
            {/* Padj Threshold Filter */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600 whitespace-nowrap">adj. p ≤</label>
              <input
                type="number"
                min="0"
                max="1"
                step="0.001"
                value={padjThreshold}
                onChange={(e) => setPadjThreshold(parseFloat(e.target.value))}
                className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
              />
            </div>
            
            {/* Items per page */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600 whitespace-nowrap">Show</label>
              <select
                value={itemsPerPage}
                onChange={(e) => setItemsPerPage(Number(e.target.value))}
                className="px-2 py-1 border border-gray-300 rounded text-sm"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={500}>500</option>
                <option value={filteredData.length}>All</option>
              </select>
            </div>
            
            {/* Export Menu */}
            {filteredData.length > 0 && (
              <ExportMenu
                data={filteredData.map(row => ({
                  pathway_id: row.pathway_id || '',
                  pathway: row.term || '',
                  category: row.category || '',
                  gene_ratio: row.geneRatio || '',
                  count: row.count || '',
                  pvalue: row.pvalue ? row.pvalue.toExponential(3) : '',
                  padj: row.padj ? row.padj.toExponential(3) : '',
                  genes: Array.isArray(row.genes) ? row.genes.join('; ') : ''
                }))}
                filename={`enrichment_${comparisonName}_${new Date().toISOString().split('T')[0]}`}
                formats={['csv', 'json', 'html']}
                csvColumns={[
                  { key: 'pathway_id', label: 'Pathway ID' },
                  { key: 'pathway', label: 'Pathway' },
                  { key: 'category', label: 'Category' },
                  { key: 'gene_ratio', label: 'Gene Ratio' },
                  { key: 'count', label: 'Count' },
                  { key: 'pvalue', label: 'P-value' },
                  { key: 'padj', label: 'adj. P-value' },
                  { key: 'genes', label: 'Genes' }
                ]}
                htmlConfig={{
                  title: `Enrichment Results - ${comparisonName}`,
                  metadata: {
                    'Comparison': comparisonName,
                    'Total Pathways': data.length,
                    'Filtered Pathways': filteredData.length,
                    'Regulation': regulationFilter,
                    'adj. p-value threshold': `≤ ${padjThreshold}`,
                    'Generated': new Date().toLocaleString()
                  }
                }}
                variant="outline"
                size="sm"
              />
            )}
            
            {/* Results Count */}
            <div className="text-xs text-gray-500 whitespace-nowrap">
              {filteredData.length} / {data.length} pathways
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pathway</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Regulation</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Gene Ratio</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Count</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">adj.p-value</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {filteredData.slice(0, itemsPerPage).map((row, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-6 py-4 text-sm text-gray-900">
                              <div className="font-medium">{row.term}</div>
                              {row.pathway_id && (
                                <div className="text-xs text-gray-500 mt-1">{row.pathway_id}</div>
                              )}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600">
                              {row.category ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                  {row.category}
                                </span>
                              ) : '-'}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600">
                              {row.regulation === 'UP' ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                  ↑ UP
                                </span>
                              ) : row.regulation === 'DOWN' ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                                  ↓ DOWN
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                                  ALL
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600">{row.geneRatio}</td>
                            <td className="px-6 py-4 text-sm text-gray-600">{row.count}</td>
                            <td className="px-6 py-4 text-sm text-gray-600">
                              {row.padj ? row.padj.toExponential(2) : (row.pvalue ? row.pvalue.toExponential(2) : 'N/A')}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
          </div>
        </div>
    );
}
