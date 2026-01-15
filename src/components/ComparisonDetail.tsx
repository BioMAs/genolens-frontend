'use client';

import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import api from '@/utils/api';
import { Project, Dataset, DatasetType, DatasetStatus } from '@/types';
import { ArrowLeft, RefreshCw, TrendingUp, TrendingDown, Database, Calendar, Activity } from 'lucide-react';
import Link from 'next/link';
import VolcanoPlot from './VolcanoPlot';
import EnrichmentPlot from './EnrichmentPlot';
import EnrichmentRadarPlot from './EnrichmentRadarPlot';
import HeatmapPlot from './HeatmapPlot';
import GeneExpressionViewer from './GeneExpressionViewer';
import DEGTable from './DEGTable';
import AIInterpretationPanel from './AIInterpretationPanel';
import CustomVisualizationPanel from './CustomVisualizationPanel';
import { formatDate } from '@/utils/formatters';

interface ComparisonDetailProps {
  projectId: string;
  comparisonName: string;
}

type TabType = 'overview' | 'deg' | 'enrichment' | 'custom-viz';

export default function ComparisonDetail({ projectId, comparisonName }: ComparisonDetailProps) {
  const searchParams = useSearchParams();
  const globalDatasetId = searchParams.get('datasetId');

  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [project, setProject] = useState<Project | null>(null);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [relevantSamples, setRelevantSamples] = useState<string[]>([]);
  const [reprocessing, setReprocessing] = useState(false);

  // State for statistics - must be declared before any conditional returns
  const [stats, setStats] = useState<{degUp: number, degDown: number, degTotal: number} | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  
  // State for top DEGs (sorted by padj)
  const [topDEGGenes, setTopDEGGenes] = useState<string[]>([]);
  
  // State for all genes from matrix dataset (for gene expression query)
  const [allMatrixGenes, setAllMatrixGenes] = useState<string[]>([]);

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
        } catch (err: any) {
          // Ignore ECONNABORTED errors during polling
          if (err?.code !== 'ECONNABORTED') {
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
                const metaData = metaResp.data.data;

                // Parse comparison name to find relevant samples
                // Expected format: ConditionA_vs_ConditionB
                const decodedName = decodeURIComponent(comparisonName);
                const parts = decodedName.split('_vs_');

                if (parts.length === 2) {
                    const [cond1, cond2] = parts;
                    // Filter samples that match these conditions
                    // Assuming 'condition' column exists and 'sample' column exists
                    const relevant = metaData.filter((row: any) =>
                        row.condition === cond1 || row.condition === cond2
                    ).map((row: any) => row.sample || row['ini.sample.name']); // Fallback to other common names

                    setRelevantSamples(relevant);
                } else {
                    // If format doesn't match, maybe show all? or try to match single condition?
                    // For now, if we can't parse, we might not filter or filter nothing.
                    // Let's try to find any sample whose condition is contained in the comparison name
                    const relevant = metaData.filter((row: any) =>
                        row.condition && decodedName.includes(row.condition)
                    ).map((row: any) => row.sample);
                    setRelevantSamples(relevant);
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

  const degDataset = useMemo(() => {
    if (!datasets || datasets.length === 0) return undefined;

    if (globalDatasetId) {
      return datasets.find(d => d.id === globalDatasetId);
    } else {
      return datasets.find(d => d.type === DatasetType.DEG && (d.dataset_metadata?.comparison_name === decodedName || d.name === decodedName));
    }
  }, [datasets, globalDatasetId, decodedName]);

  const enrichmentDataset = useMemo(() => {
    if (!datasets || datasets.length === 0) return undefined;

    // First try to find by comparison_name or name
    let enrichment = datasets.find(d => d.type === DatasetType.ENRICHMENT && (d.dataset_metadata?.comparison_name === decodedName || d.name === decodedName));

    // Also check for enrichment files with enrichment_comparisons metadata
    if (!enrichment) {
      enrichment = datasets.find(d =>
        d.type === DatasetType.ENRICHMENT &&
        d.dataset_metadata?.enrichment_comparisons?.includes(decodedName)
      );
    }

    return enrichment;
  }, [datasets, decodedName]);

  const matrixDataset = useMemo(() => {
    if (!datasets || datasets.length === 0) return undefined;
    return datasets.find(d => d.type === DatasetType.MATRIX && d.status === DatasetStatus.READY);
  }, [datasets]);

  const { logFCColumn, pValColumn } = useMemo(() => {
    if (!degDataset || !degDataset.dataset_metadata?.comparisons?.[decodedName]) {
      return { logFCColumn: undefined, pValColumn: undefined };
    }
    return {
      logFCColumn: degDataset.dataset_metadata.comparisons[decodedName].logFC,
      pValColumn: degDataset.dataset_metadata.comparisons[decodedName].padj
    };
  }, [degDataset, decodedName]);

  // Fetch top DEGs sorted by padj for Gene Expression Viewer
  useEffect(() => {
    if (!degDataset) return;

    const fetchTopDEGs = async () => {
      try {
        const metadata = degDataset.dataset_metadata;
        
        // First, check if top genes are stored in metadata
        let storedTopGenes = null;
        if (globalDatasetId && metadata?.comparisons?.[decodedName]?.top_genes) {
          storedTopGenes = metadata.comparisons[decodedName].top_genes;
        } else if (metadata?.top_genes) {
          storedTopGenes = metadata.top_genes;
        }

        if (storedTopGenes && storedTopGenes.length > 0) {
          // Extract gene names from stored top genes
          const geneNames = storedTopGenes.map((g: any) => 
            g.gene || g.gene_id || g.Gene || g.symbol || ''
          ).filter(Boolean);
          setTopDEGGenes(geneNames);
          return;
        }

        // If not in metadata, fetch from dataset sorted by padj
        const response = await api.post(`/datasets/${degDataset.id}/query`, {
          limit: 100,
          sort_by: 'padj',
          sort_order: 'asc'
        });

        const geneColumn = response.data.columns.find((c: string) => 
          c.toLowerCase().includes('gene') || c.toLowerCase().includes('symbol')
        );

        if (geneColumn) {
          const geneNames = response.data.data
            .map((row: any) => row[geneColumn])
            .filter(Boolean);
          setTopDEGGenes(geneNames);
        }
      } catch (err) {
        console.error('Failed to fetch top DEGs:', err);
      }
    };

    fetchTopDEGs();
  }, [degDataset, decodedName, globalDatasetId]);

  // Fetch all genes from matrix dataset for gene expression query
  useEffect(() => {
    if (!matrixDataset) return;

    const fetchAllGenes = async () => {
      try {
        // Query matrix with limit 1 to get column names (all genes)
        const response = await api.post(`/datasets/${matrixDataset.id}/query`, {
          limit: 1
        });

        // Extract gene_id column which contains all genes
        const geneIdColumn = 'gene_id';
        if (response.data.columns.includes(geneIdColumn)) {
          // Fetch all gene IDs from the dataset
          const allGenesResponse = await api.post(`/datasets/${matrixDataset.id}/query`, {
            limit: 100000, // High limit to get all genes
            columns: [geneIdColumn]
          });

          const genes = allGenesResponse.data.data
            .map((row: any) => row[geneIdColumn])
            .filter(Boolean);
          
          setAllMatrixGenes(genes);
        }
      } catch (err) {
        console.error('Failed to fetch all matrix genes:', err);
      }
    };

    fetchAllGenes();
  }, [matrixDataset]);

  // Calculate or fetch statistics from DEG dataset
  useEffect(() => {
    if (!degDataset) return;

    const metadata = degDataset.dataset_metadata;

    // Check if stats already exist in metadata
    if (metadata?.deg_up !== undefined && metadata?.deg_down !== undefined) {
      // Stats exist at top level (for individual comparison datasets)
      setStats({
        degUp: metadata.deg_up,
        degDown: metadata.deg_down,
        degTotal: metadata.deg_total || metadata.deg_up + metadata.deg_down
      });
      return;
    }

    if (globalDatasetId && metadata?.comparisons?.[decodedName]) {
      const compData = metadata.comparisons[decodedName];
      if (compData.deg_up !== undefined && compData.deg_down !== undefined) {
        // Stats exist in comparisons metadata (for global DEG files)
        setStats({
          degUp: compData.deg_up || 0,
          degDown: compData.deg_down || 0,
          degTotal: compData.deg_total || 0
        });
        return;
      }
    }

    // Stats don't exist - compute them
    const computeAndSaveStats = async () => {
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
          const compData = metadata?.comparisons?.[decodedName];
          logFCCol = compData?.logFC || null;
          padjCol = compData?.padj || null;
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
          data.forEach((row: any) => {
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

          data.forEach((row: any) => {
            const logFC = row[logFCCol!];
            const padj = row[padjCol!];

            // Filter: padj < 0.05 AND |logFC| > 0.58
            if (logFC != null && padj != null && padj < padjThreshold && Math.abs(logFC) > logFCThreshold) {
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
                ...metadata?.comparisons,
                [decodedName]: {
                  ...metadata?.comparisons?.[decodedName],
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

    computeAndSaveStats();
  }, [degDataset, decodedName, globalDatasetId]);

  if (loading) return <div className="p-8 text-center">Loading...</div>;
  if (error) return <div className="p-8 text-center text-red-600">{error}</div>;
  if (!project) return <div className="p-8 text-center">Project not found</div>;

  if (!degDataset) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Link href={`/projects/${projectId}`} className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4">
            <ArrowLeft className="mr-1 h-4 w-4" /> Back to Project
          </Link>
          <div className="bg-yellow-50 p-4 rounded-md mt-4">
            <p className="text-yellow-700">No Differential Expression (DEG) dataset found for this comparison.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Back Button */}
        <Link href={`/projects/${projectId}`} className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-6">
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to Project
        </Link>

        {/* Header Section */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{decodedName}</h1>
              <div className="flex items-center gap-6 text-sm text-gray-500">
                <div className="flex items-center gap-1.5">
                  <Database className="h-4 w-4" />
                  <span>Project: {project.name}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" />
                  <span>Created {formatDate(degDataset.created_at)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Statistics Grid */}
          {statsLoading ? (
            <div className="mt-6 text-center text-sm text-gray-500">
              <div className="inline-flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
                Calculating DEG statistics...
              </div>
            </div>
          ) : stats && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
              {/* DEG Up */}
              <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="h-5 w-5 text-red-600" />
                  <span className="text-sm font-medium text-red-900">Upregulated</span>
                </div>
                <p className="text-2xl font-bold text-red-600">{stats.degUp.toLocaleString()}</p>
              </div>

              {/* DEG Down */}
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingDown className="h-5 w-5 text-blue-600" />
                  <span className="text-sm font-medium text-blue-900">Downregulated</span>
                </div>
                <p className="text-2xl font-bold text-blue-600">{stats.degDown.toLocaleString()}</p>
              </div>

              {/* Total DEG */}
              <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-200">
                <div className="flex items-center gap-2 mb-1">
                  <Activity className="h-5 w-5 text-indigo-600" />
                  <span className="text-sm font-medium text-indigo-900">Total DEG</span>
                </div>
                <p className="text-2xl font-bold text-indigo-600">{stats.degTotal.toLocaleString()}</p>
              </div>

              {/* Enrichment */}
              <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                <div className="flex items-center gap-2 mb-1">
                  <Database className="h-5 w-5 text-purple-600" />
                  <span className="text-sm font-medium text-purple-900">Enrichment</span>
                </div>
                <p className="text-2xl font-bold text-purple-600">
                  {enrichmentDataset ? 'Available' : 'N/A'}
                </p>
              </div>
            </div>
          )}

          {/* Top DEG Preview - Compact */}
          <TopDEGPreview dataset={degDataset} comparisonName={decodedName} />
        </div>

        {/* Tabs */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex">
              <button
                onClick={() => setActiveTab('overview')}
                className={`${
                  activeTab === 'overview'
                    ? 'border-brand-primary text-brand-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm transition-colors`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab('deg')}
                className={`${
                  activeTab === 'deg'
                    ? 'border-brand-primary text-brand-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm transition-colors`}
              >
                DEG Analysis
              </button>
              {enrichmentDataset && (
                <button
                  onClick={() => setActiveTab('enrichment')}
                  className={`${
                    activeTab === 'enrichment'
                      ? 'border-brand-primary text-brand-primary'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm transition-colors`}
                >
                  Enrichment
                </button>
              )}
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
          <div className="p-6">
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* AI Interpretation Panel */}
                <div>
                  <AIInterpretationPanel 
                    datasetId={degDataset.id} 
                    comparisonName={decodedName} 
                  />
                </div>

                {/* Heatmap and Volcano Plot - Side by side on large screens */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Heatmap */}
                  {matrixDataset && (
                    <div className="lg:col-span-1">
                      <h2 className="text-xl font-bold text-gray-900 mb-4">Expression Heatmap</h2>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <HeatmapPlot
                          degDataset={degDataset}
                          matrixDataset={matrixDataset}
                          sampleIds={relevantSamples.length > 0 ? relevantSamples : undefined}
                          comparisonName={decodedName}
                        />
                      </div>
                    </div>
                  )}
                  
                  {/* Volcano Plot */}
                  <div className="lg:col-span-1">
                    <div className="flex justify-between items-center mb-4">
                      <h2 className="text-xl font-bold text-gray-900">Volcano Plot</h2>
                      <Link
                        href={`/projects/${projectId}/datasets/${degDataset.id}`}
                        className="text-sm text-brand-primary hover:text-brand-primary/80 font-medium"
                      >
                        View Full Dataset &rarr;
                      </Link>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <VolcanoPlot
                        dataset={degDataset}
                        comparisonName={decodedName}
                      />
                    </div>
                  </div>
                </div>

                {/* Gene Expression Viewer */}
                {matrixDataset && (
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 mb-4">Gene Expression Query</h2>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <GeneExpressionViewer
                        matrixDataset={matrixDataset}
                        sampleIds={relevantSamples.length > 0 ? relevantSamples : undefined}
                        comparisonName={decodedName}
                        allGenes={allMatrixGenes}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* DEG Tab */}
            {activeTab === 'deg' && (
              <div className="space-y-6">
                {/* DEG Table */}
                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-4">Differentially Expressed Genes</h2>
                  <p className="text-sm text-gray-600 mb-4">Browse all differentially expressed genes with filtering and sorting capabilities.</p>
                  <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <DEGTable dataset={degDataset} comparisonName={decodedName} />
                  </div>
                </div>
              </div>
            )}

            {/* Enrichment Tab */}
            {activeTab === 'enrichment' && enrichmentDataset && (
              <div className="space-y-6">
                {/* Dot Plot */}
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-gray-900">Pathway Enrichment Plot</h2>
                    <Link
                      href={`/projects/${projectId}/datasets/${enrichmentDataset.id}`}
                      className="text-sm text-brand-primary hover:text-brand-primary/80 font-medium"
                    >
                      View Full Dataset &rarr;
                    </Link>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <EnrichmentPlot dataset={enrichmentDataset} comparisonName={decodedName} />
                  </div>
                </div>

                {/* Enrichment Radar Plot */}
                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-purple-600" />
                    Enrichment Radar Plot
                  </h2>
                  <EnrichmentRadarPlot 
                    datasetId={enrichmentDataset.id} 
                    comparisonName={decodedName}
                    maxTerms={10}
                  />
                </div>

                {/* Enrichment Table */}
                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-4">Enriched Pathways</h2>
                  <EnrichmentTable dataset={enrichmentDataset} comparisonName={decodedName} />
                </div>
              </div>
            )}

            {/* Custom Visualizations Tab */}
            {activeTab === 'custom-viz' && (
              <div>
                <CustomVisualizationPanel 
                  datasetId={degDataset.id} 
                  comparisonName={decodedName}
                  allGenes={allMatrixGenes}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Component for Top DEG Preview (compact in header)
function TopDEGPreview({ dataset, comparisonName }: { dataset: Dataset, comparisonName: string }) {
  const [topGenes, setTopGenes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTopGenes = async () => {
      try {
        // First, check if top genes are stored in metadata
        const metadata = dataset.dataset_metadata;
        let storedTopGenes = null;

        // Check in comparisons metadata (for global DEG files)
        if (metadata?.comparisons?.[comparisonName]?.top_genes) {
          storedTopGenes = metadata.comparisons[comparisonName].top_genes;
        }
        // Check at top level (for individual comparison datasets)
        else if (metadata?.top_genes) {
          storedTopGenes = metadata.top_genes;
        }

        if (storedTopGenes && storedTopGenes.length > 0) {
          // Use stored top genes
          setTopGenes(storedTopGenes.slice(0, 5));
          setLoading(false);
          return;
        }

        // If not in metadata, fetch from dataset
        const response = await api.post(`/datasets/${dataset.id}/query`, {
          limit: 5,
          sort_by: 'padj',
          sort_order: 'asc'
        });

        setTopGenes(response.data.data.slice(0, 5));
      } catch (err) {
        console.error('Failed to fetch top genes:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTopGenes();
  }, [dataset, comparisonName]);

  if (loading || topGenes.length === 0) return null;

  return (
    <div className="mt-6 pt-6 border-t border-gray-200">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Top 5 DEGs (by adj. p-value)</h3>
      <div className="grid grid-cols-5 gap-2">
        {topGenes.map((gene, idx) => (
          <div key={idx} className="bg-gray-50 rounded px-3 py-2 border border-gray-200">
            <p className="text-sm font-medium text-gray-900 truncate">
              {gene.gene || gene.gene_id || gene.Gene || 'N/A'}
            </p>
            <p className="text-xs text-gray-500">
              log2FC: {gene.log2FoldChange?.toFixed(2) || gene.logFC?.toFixed(2) || 'N/A'}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// Component for enrichment table
function EnrichmentTable({ dataset, comparisonName }: { dataset: Dataset, comparisonName: string }) {
    const [data, setData] = useState<any[]>([]);
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
                const categories = [...new Set(pathways.map((p: any) => p.category).filter(Boolean))];
                setAvailableCategories(categories as string[]);

                // Transform database format to component format
                const processedData = pathways.map((pathway: any) => ({
                    pathway_id: pathway.pathway_id,
                    term: pathway.pathway_name,
                    description: pathway.description,
                    pvalue: pathway.pvalue || pathway.padj,
                    padj: pathway.padj,
                    geneRatio: pathway.gene_ratio ? pathway.gene_ratio.toFixed(3) :
                               (pathway.gene_count && pathway.bg_ratio ? (pathway.gene_count * pathway.bg_ratio).toFixed(3) : 'N/A'),
                    count: pathway.gene_count || 'N/A',
                    genes: pathway.genes || [],
                    category: pathway.category,
                    regulation: pathway.regulation || 'ALL'
                }));

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
                        rawData = rawData.filter((row: any) => {
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
                    const processedData = rawData
                        .filter((row: any) => row[pvalCol] && row[pvalCol] > 0)
                        .sort((a: any, b: any) => parseFloat(a[pvalCol]) - parseFloat(b[pvalCol]))
                        .map((row: any) => ({
                            term: row[termCol],
                            pvalue: parseFloat(row[pvalCol]),
                            padj: parseFloat(row[pvalCol]),
                            geneRatio: rCol && rExpectedCol ? (parseFloat(row[rCol]) / parseFloat(row[rExpectedCol])).toFixed(3) : 'N/A',
                            count: rCol ? parseFloat(row[rCol]) : 'N/A',
                            category: categoryCol ? row[categoryCol] : undefined,
                            genes: genesCol ? (row[genesCol] ? String(row[genesCol]).split('|') : []) : []
                        }));

                    console.log(`[EnrichmentTable] 📦 Loaded ${processedData.length} pathways from Parquet fallback`);
                    console.log('[EnrichmentTable] 📦 First fallback pathway:', processedData[0]);

                    // Extract unique categories for fallback data
                    const categories = [...new Set(processedData.map((p: any) => p.category).filter(Boolean))];
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

    // Export function
    const handleExport = (format: 'csv' | 'tsv') => {
        const separator = format === 'csv' ? ',' : '\t';
        const headers = ['Pathway', 'Category', 'Gene Ratio', 'Count', 'adj.p-value', 'Genes'];
        const rows = filteredData.map(row => [
            row.term || '',
            row.category || '',
            row.geneRatio || '',
            row.count || '',
            row.padj ? row.padj.toExponential(2) : (row.pvalue ? row.pvalue.toExponential(2) : ''),
            Array.isArray(row.genes) ? row.genes.join(';') : ''
        ]);
        
        const content = [headers.join(separator), ...rows.map(r => r.join(separator))].join('\n');
        const blob = new Blob([content], { type: `text/${format}` });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `enrichment_${comparisonName}_${new Date().toISOString().split('T')[0]}.${format}`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-4">
          {/* Filters - Compact Bar */}
          <div className="flex gap-4 items-center flex-wrap bg-gray-50 px-4 py-3 rounded-md border border-gray-200">
            {/* Search Input */}
            <div className="flex-1 min-w-[200px]">
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
            
            {/* Export Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleExport('csv')}
                className="inline-flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded-md bg-white hover:bg-gray-50 text-sm text-gray-700"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                CSV
              </button>
              <button
                onClick={() => handleExport('tsv')}
                className="inline-flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded-md bg-white hover:bg-gray-50 text-sm text-gray-700"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                TSV
              </button>
            </div>
            
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
