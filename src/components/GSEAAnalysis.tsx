'use client';

import { useState } from 'react';
import { Dataset } from '@/types';
import api from '@/utils/api';
import { Play, Settings, X } from 'lucide-react';
import GSEATable from './GSEATable';
import GSEAEnrichmentPlot from './GSEAEnrichmentPlot';

interface GSEAAnalysisProps {
  dataset: Dataset;
  comparisonName: string;
}

interface GSEAResult {
  gene_set_name: string;
  gene_set_size: number;
  enrichment_score: number;
  normalized_enrichment_score: number;
  p_value: number;
  fdr_q_value: number;
  leading_edge_genes: string[];
  core_enrichment: string[];
  running_enrichment_scores?: number[];
  gene_positions?: number[];
}

interface GSEAResponse {
  dataset_id: string;
  comparison_name: string;
  parameters: {
    gene_set_database: string;
    ranking_metric: string;
    min_size: number;
    max_size: number;
    n_permutations: number;
    fdr_threshold: number;
  };
  summary: {
    total_genes: number;
    total_gene_sets_tested: number;
    significant_gene_sets: number;
    enriched_in_phenotype_pos: number;
    enriched_in_phenotype_neg: number;
  };
  results: GSEAResult[];
}

export default function GSEAAnalysis({ dataset, comparisonName }: GSEAAnalysisProps) {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<GSEAResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedGeneSet, setSelectedGeneSet] = useState<string | null>(null);
  const [enrichmentPlotData, setEnrichmentPlotData] = useState<any | null>(null);
  const [loadingPlot, setLoadingPlot] = useState(false);

  // GSEA parameters
  const [parameters, setParameters] = useState({
    gene_set_database: 'GO_BP',
    ranking_metric: 'signed_pvalue',
    min_size: 15,
    max_size: 500,
    n_permutations: 1000,
    fdr_threshold: 0.25
  });

  const runGSEA = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.post(`/datasets/${dataset.id}/gsea`, {
        comparison_name: comparisonName,
        ...parameters
      });

      setResults(response.data);
    } catch (err: any) {
      console.error('GSEA analysis failed:', err);
      setError(err.response?.data?.detail || 'Failed to run GSEA analysis');
    } finally {
      setLoading(false);
    }
  };

  const viewEnrichmentPlot = async (geneSetName: string) => {
    try {
      setLoadingPlot(true);
      setSelectedGeneSet(geneSetName);

      const response = await api.get(
        `/datasets/${dataset.id}/gsea/${encodeURIComponent(geneSetName)}/enrichment-plot`,
        {
          params: {
            comparison_name: comparisonName,
            ranking_metric: parameters.ranking_metric
          }
        }
      );

      setEnrichmentPlotData(response.data);
    } catch (err: any) {
      console.error('Failed to load enrichment plot:', err);
      alert('Failed to load enrichment plot');
    } finally {
      setLoadingPlot(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Gene Set Enrichment Analysis (GSEA)</h2>
            <p className="text-sm text-gray-600 mt-1">
              Identify significantly enriched gene sets in your ranked gene list
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </button>

            <button
              onClick={runGSEA}
              disabled={loading}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-brand-primary hover:bg-brand-primary/90 disabled:opacity-50"
            >
              <Play className="h-4 w-4 mr-2" />
              {loading ? 'Running GSEA...' : 'Run GSEA'}
            </button>
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Gene Set Database
                </label>
                <select
                  value={parameters.gene_set_database}
                  onChange={(e) => setParameters({ ...parameters, gene_set_database: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="GO_BP">GO Biological Process</option>
                  <option value="GO_MF">GO Molecular Function</option>
                  <option value="GO_CC">GO Cellular Component</option>
                  <option value="KEGG">KEGG Pathways</option>
                  <option value="REACTOME">Reactome Pathways</option>
                  <option value="HALLMARK">MSigDB Hallmark</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ranking Metric
                </label>
                <select
                  value={parameters.ranking_metric}
                  onChange={(e) => setParameters({ ...parameters, ranking_metric: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="signed_pvalue">Signed P-value (recommended)</option>
                  <option value="log_fc">Log2 Fold Change</option>
                  <option value="signal2noise">Signal to Noise</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  FDR Threshold
                </label>
                <select
                  value={parameters.fdr_threshold}
                  onChange={(e) => setParameters({ ...parameters, fdr_threshold: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="0.05">0.05 (stringent)</option>
                  <option value="0.1">0.10</option>
                  <option value="0.25">0.25 (standard)</option>
                  <option value="0.5">0.50 (permissive)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Min Gene Set Size
                </label>
                <input
                  type="number"
                  value={parameters.min_size}
                  onChange={(e) => setParameters({ ...parameters, min_size: parseInt(e.target.value) })}
                  min="5"
                  max="100"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Gene Set Size
                </label>
                <input
                  type="number"
                  value={parameters.max_size}
                  onChange={(e) => setParameters({ ...parameters, max_size: parseInt(e.target.value) })}
                  min="100"
                  max="2000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Permutations
                </label>
                <select
                  value={parameters.n_permutations}
                  onChange={(e) => setParameters({ ...parameters, n_permutations: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="100">100 (fast)</option>
                  <option value="500">500</option>
                  <option value="1000">1000 (standard)</option>
                  <option value="5000">5000 (publication)</option>
                  <option value="10000">10000 (most accurate)</option>
                </select>
              </div>
            </div>

            <div className="mt-3 text-xs text-gray-600">
              <strong>Note:</strong> More permutations increase accuracy but take longer to compute.
              Standard is 1000 permutations.
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            <strong>Error:</strong> {error}
          </div>
        )}
      </div>

      {/* Summary Stats */}
      {results && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Analysis Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{results.summary.total_genes}</div>
              <div className="text-sm text-gray-600">Total Genes</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{results.summary.total_gene_sets_tested}</div>
              <div className="text-sm text-gray-600">Gene Sets Tested</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{results.summary.significant_gene_sets}</div>
              <div className="text-sm text-gray-600">Significant (FDR ≤ {parameters.fdr_threshold})</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{results.summary.enriched_in_phenotype_pos}</div>
              <div className="text-sm text-gray-600">Positive NES</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{results.summary.enriched_in_phenotype_neg}</div>
              <div className="text-sm text-gray-600">Negative NES</div>
            </div>
          </div>
        </div>
      )}

      {/* Results Table */}
      {results && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <GSEATable
            results={results.results}
            onViewEnrichmentPlot={viewEnrichmentPlot}
            loading={loading}
          />
        </div>
      )}

      {/* Enrichment Plot Modal */}
      {selectedGeneSet && enrichmentPlotData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Enrichment Plot: {selectedGeneSet}</h3>
              <button
                onClick={() => {
                  setSelectedGeneSet(null);
                  setEnrichmentPlotData(null);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6">
              {loadingPlot ? (
                <div className="text-center py-12">Loading plot...</div>
              ) : (
                <GSEAEnrichmentPlot
                  geneSetName={enrichmentPlotData.gene_set_name}
                  enrichmentScore={enrichmentPlotData.enrichment_score}
                  runningEnrichmentScores={enrichmentPlotData.running_enrichment_scores}
                  genePositions={enrichmentPlotData.gene_positions}
                  rankedGenes={enrichmentPlotData.ranked_genes}
                  metrics={enrichmentPlotData.metrics}
                  geneSetSize={enrichmentPlotData.gene_set_size}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Initial State */}
      {!results && !loading && (
        <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
          <Play className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Ready to Run GSEA</h3>
          <p className="text-gray-600 mb-4">
            Click "Run GSEA" to start the analysis. You can adjust settings before running.
          </p>
          <p className="text-sm text-gray-500">
            GSEA will analyze {comparisonName} to identify enriched gene sets.
          </p>
        </div>
      )}
    </div>
  );
}
