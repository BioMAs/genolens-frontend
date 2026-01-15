'use client';

import { useState } from 'react';
import api from '@/utils/api';
import { AlertCircle, Search, Loader2 } from 'lucide-react';

interface DiagnosticResult {
  dataset_id: string;
  dataset_name: string;
  comparison_name: string;
  columns: {
    logFC: string;
    padj: string;
    contrast: string | null;
  };
  contrast_analysis: {
    column: string;
    values: Record<string, number>;
    genes_with_contrast: number;
  } | null;
  padj_distribution: {
    total: number;
    null_or_na: number;
    equal_to_0: number;
    '0_to_1e-300': number;
    '1e-300_to_0.01': number;
    '0.01_to_0.05': number;
    '0.05_to_0.1': number;
    'gte_0.1': number;
  };
  logfc_distribution: {
    total: number;
    null_or_na: number;
    equal_to_0: number;
    'positive_0_to_0.5': number;
    'positive_0.5_to_1': number;
    positive_gt_1: number;
    'negative_0_to_-0.5': number;
    'negative_-0.5_to_-1': number;
    'negative_lt_-1': number;
  };
  progressive_filtering: {
    start: number;
    after_remove_nan: number;
    after_padj_gt_0: number;
    'after_padj_lt_0.05': number;
    after_logfc_abs_gt_1: number;
    up_regulated: number;
    down_regulated: number;
  };
  sample_genes: {
    up_regulated: Array<{ gene: string; logFC: number; padj: number }>;
    down_regulated: Array<{ gene: string; logFC: number; padj: number }>;
  };
}

export default function DiagnosticPage() {
  const [datasetId, setDatasetId] = useState('64d46ac5-42d2-4d4f-b705-0dd81e95cbc0');
  const [comparisonName, setComparisonName] = useState('M1_pos_24h_vs_M1_neg_24h');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DiagnosticResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runDiagnostic = async () => {
    if (!datasetId || !comparisonName) {
      setError('Please provide both Dataset ID and Comparison Name');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      console.log(`Making request to: /datasets/${datasetId}/diagnose-deg/${comparisonName}`);
      const response = await api.get(`/datasets/${datasetId}/diagnose-deg/${comparisonName}`);
      console.log('Diagnostic response:', response.data);
      setResult(response.data);
    } catch (err: any) {
      console.error('Diagnostic failed:', err);
      console.error('Error response:', err.response?.data);
      console.error('Error status:', err.response?.status);
      const errorDetail = err.response?.data?.detail;
      setError(typeof errorDetail === 'string' ? errorDetail : JSON.stringify(errorDetail) || 'Failed to run diagnostic');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">DEG Filtering Diagnostic</h1>

        {/* Input Form */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Dataset ID
              </label>
              <input
                type="text"
                value={datasetId}
                onChange={(e) => setDatasetId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary"
                placeholder="64d46ac5-42d2-4d4f-b705-0dd81e95cbc0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Comparison Name
              </label>
              <input
                type="text"
                value={comparisonName}
                onChange={(e) => setComparisonName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary"
                placeholder="M1_pos_24h_vs_M1_neg_24h"
              />
            </div>
          </div>
          <button
            onClick={runDiagnostic}
            disabled={loading}
            className="w-full md:w-auto px-6 py-2 bg-brand-primary text-white rounded-md hover:bg-brand-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Running Diagnostic...
              </>
            ) : (
              <>
                <Search className="h-5 w-5" />
                Run Diagnostic
              </>
            )}
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-red-800 mb-1">Error</h3>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        {/* Results Display */}
        {result && (
          <div className="space-y-6">
            {/* Dataset Info */}
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Dataset Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-700">Dataset:</span>
                  <span className="ml-2 text-gray-600">{result.dataset_name}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Comparison:</span>
                  <span className="ml-2 text-gray-600">{result.comparison_name}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">LogFC Column:</span>
                  <span className="ml-2 text-gray-600">{result.columns.logFC}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">P-adj Column:</span>
                  <span className="ml-2 text-gray-600">{result.columns.padj}</span>
                </div>
              </div>
            </div>

            {/* Progressive Filtering - MAIN RESULT */}
            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                🎯 Progressive Filtering Results
              </h2>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-white rounded-md">
                  <span className="font-medium text-gray-700">Starting genes:</span>
                  <span className="text-lg font-bold text-gray-900">
                    {result.progressive_filtering.start.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-white rounded-md">
                  <span className="text-gray-700">After removing NaN:</span>
                  <span className="font-semibold text-gray-900">
                    {result.progressive_filtering.after_remove_nan.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-white rounded-md">
                  <span className="text-gray-700">After padj &gt; 0 (exclude padj=0):</span>
                  <span className="font-semibold text-gray-900">
                    {result.progressive_filtering.after_padj_gt_0.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-white rounded-md">
                  <span className="text-gray-700">After padj &lt; 0.05:</span>
                  <span className="font-semibold text-gray-900">
                    {result.progressive_filtering['after_padj_lt_0.05'].toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-white rounded-md">
                  <span className="text-gray-700">After |logFC| &gt; 1:</span>
                  <span className="font-semibold text-gray-900">
                    {result.progressive_filtering.after_logfc_abs_gt_1.toLocaleString()}
                  </span>
                </div>
                <div className="border-t-2 border-blue-300 pt-3 mt-3">
                  <div className="flex justify-between items-center p-3 bg-red-100 rounded-md">
                    <span className="font-bold text-gray-900">Up-regulated (logFC &gt; 1):</span>
                    <span className="text-xl font-bold text-red-600">
                      {result.progressive_filtering.up_regulated.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-blue-100 rounded-md mt-2">
                    <span className="font-bold text-gray-900">Down-regulated (logFC &lt; -1):</span>
                    <span className="text-xl font-bold text-blue-600">
                      {result.progressive_filtering.down_regulated.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gray-100 rounded-md mt-2">
                    <span className="font-bold text-gray-900">Total DEGs:</span>
                    <span className="text-xl font-bold text-gray-900">
                      {(result.progressive_filtering.up_regulated + result.progressive_filtering.down_regulated).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* P-value Distribution */}
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">P-value Distribution</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between p-2 hover:bg-gray-50 rounded">
                  <span className="text-gray-700">Total genes:</span>
                  <span className="font-medium">{result.padj_distribution.total.toLocaleString()}</span>
                </div>
                <div className="flex justify-between p-2 hover:bg-gray-50 rounded">
                  <span className="text-gray-700">Null/NA:</span>
                  <span className="font-medium">{result.padj_distribution.null_or_na.toLocaleString()}</span>
                </div>
                <div className="flex justify-between p-2 bg-yellow-50 rounded">
                  <span className="text-gray-700 font-medium">Equal to 0 (INVALID):</span>
                  <span className="font-bold text-yellow-700">{result.padj_distribution.equal_to_0.toLocaleString()}</span>
                </div>
                <div className="flex justify-between p-2 hover:bg-gray-50 rounded">
                  <span className="text-gray-700">0 &lt; padj &lt; 1e-300:</span>
                  <span className="font-medium">{result.padj_distribution['0_to_1e-300'].toLocaleString()}</span>
                </div>
                <div className="flex justify-between p-2 bg-green-50 rounded">
                  <span className="text-gray-700">1e-300 ≤ padj &lt; 0.01:</span>
                  <span className="font-medium text-green-700">{result.padj_distribution['1e-300_to_0.01'].toLocaleString()}</span>
                </div>
                <div className="flex justify-between p-2 bg-green-50 rounded">
                  <span className="text-gray-700">0.01 ≤ padj &lt; 0.05:</span>
                  <span className="font-medium text-green-700">{result.padj_distribution['0.01_to_0.05'].toLocaleString()}</span>
                </div>
                <div className="flex justify-between p-2 hover:bg-gray-50 rounded">
                  <span className="text-gray-700">0.05 ≤ padj &lt; 0.1:</span>
                  <span className="font-medium">{result.padj_distribution['0.05_to_0.1'].toLocaleString()}</span>
                </div>
                <div className="flex justify-between p-2 hover:bg-gray-50 rounded">
                  <span className="text-gray-700">padj ≥ 0.1:</span>
                  <span className="font-medium">{result.padj_distribution['gte_0.1'].toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* LogFC Distribution */}
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">LogFC Distribution</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="space-y-2">
                  <h3 className="font-semibold text-red-600 mb-2">Up-regulated (positive)</h3>
                  <div className="flex justify-between p-2 hover:bg-gray-50 rounded">
                    <span className="text-gray-700">0 &lt; logFC ≤ 0.5:</span>
                    <span className="font-medium">{result.logfc_distribution['positive_0_to_0.5'].toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between p-2 hover:bg-gray-50 rounded">
                    <span className="text-gray-700">0.5 &lt; logFC ≤ 1:</span>
                    <span className="font-medium">{result.logfc_distribution['positive_0.5_to_1'].toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between p-2 bg-red-50 rounded">
                    <span className="text-gray-700 font-medium">logFC &gt; 1:</span>
                    <span className="font-bold text-red-600">{result.logfc_distribution.positive_gt_1.toLocaleString()}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <h3 className="font-semibold text-blue-600 mb-2">Down-regulated (negative)</h3>
                  <div className="flex justify-between p-2 hover:bg-gray-50 rounded">
                    <span className="text-gray-700">-0.5 ≤ logFC &lt; 0:</span>
                    <span className="font-medium">{result.logfc_distribution['negative_0_to_-0.5'].toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between p-2 hover:bg-gray-50 rounded">
                    <span className="text-gray-700">-1 ≤ logFC &lt; -0.5:</span>
                    <span className="font-medium">{result.logfc_distribution['negative_-0.5_to_-1'].toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between p-2 bg-blue-50 rounded">
                    <span className="text-gray-700 font-medium">logFC &lt; -1:</span>
                    <span className="font-bold text-blue-600">{result.logfc_distribution['negative_lt_-1'].toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Sample Genes */}
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Sample Genes</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold text-red-600 mb-3">Top 10 Up-regulated</h3>
                  {result.sample_genes.up_regulated.length > 0 ? (
                    <div className="space-y-2">
                      {result.sample_genes.up_regulated.map((gene, idx) => (
                        <div key={idx} className="p-2 bg-red-50 rounded text-xs">
                          <div className="font-medium text-gray-900">{gene.gene}</div>
                          <div className="text-gray-600">
                            logFC: {gene.logFC.toFixed(3)} | padj: {gene.padj.toExponential(2)}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm">No up-regulated genes found</p>
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-blue-600 mb-3">Top 10 Down-regulated</h3>
                  {result.sample_genes.down_regulated.length > 0 ? (
                    <div className="space-y-2">
                      {result.sample_genes.down_regulated.map((gene, idx) => (
                        <div key={idx} className="p-2 bg-blue-50 rounded text-xs">
                          <div className="font-medium text-gray-900">{gene.gene}</div>
                          <div className="text-gray-600">
                            logFC: {gene.logFC.toFixed(3)} | padj: {gene.padj.toExponential(2)}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm">No down-regulated genes found</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
