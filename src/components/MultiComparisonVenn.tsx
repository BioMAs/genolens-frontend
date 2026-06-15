'use client';

import { useState } from 'react';
import api from '@/utils/api';
import VennDiagram from './VennDiagram';
import UpSetPlot from './UpSetPlot';

// One comparison, tagged with the DEG dataset that holds it. `label` is the
// unique display key used across selection state and the Venn response.
export interface ComparisonRef {
  datasetId: string;
  comparisonName: string;
  label: string;
  degCount: number;
}

interface MultiComparisonVennProps {
  projectId: string;
  pathDatasetId: string; // Any dataset id in the project; used for the endpoint URL + access check
  comparisons: ComparisonRef[]; // Comparisons aggregated from all DEG datasets
}

interface ApiErrorShape {
  response?: {
    data?: {
      detail?: unknown;
    };
  };
}

interface VennData {
  sets: string[];
  intersections: {
    sets: string[];
    size: number;
    genes: string[];
  }[];
}

export default function MultiComparisonVenn({ pathDatasetId, comparisons: availableComparisons }: MultiComparisonVennProps) {
  const [selectedComparisons, setSelectedComparisons] = useState<string[]>([]);
  const [vennData, setVennData] = useState<VennData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleComparisonToggle = (compLabel: string) => {
    setSelectedComparisons(prev => {
      if (prev.includes(compLabel)) {
        return prev.filter(c => c !== compLabel);
      } else {
        // Limit to 5 comparisons
        if (prev.length >= 5) {
          setError('Maximum 5 comparisons allowed');
          return prev;
        }
        return [...prev, compLabel];
      }
    });
    setError(null);
  };

  const fetchVennData = async () => {
    if (selectedComparisons.length < 2) {
      setError('Select at least 2 comparisons');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const selectedRefs = availableComparisons
        .filter((c) => selectedComparisons.includes(c.label))
        .map((c) => ({
          dataset_id: c.datasetId,
          comparison_name: c.comparisonName,
          label: c.label,
        }));

      const response = await api.post(`/datasets/${pathDatasetId}/venn-analysis`, {
        comparison_refs: selectedRefs,
        padj_threshold: 0.05,
        logfc_threshold: 0.58
      });

      setVennData(response.data);
    } catch (err: unknown) {
      const detail = (err as ApiErrorShape)?.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Failed to generate Venn diagram');
      console.error('Venn analysis error:', err);
    } finally {
      setLoading(false);
    }
  };

  const exportGeneList = (genes: string[], setName: string) => {
    const blob = new Blob([genes.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${setName}_genes.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Multi-Comparison Analysis</h2>
        <p className="mt-1 text-sm text-gray-500">
          Compare 2-5 comparisons to identify common and unique differentially expressed genes
        </p>
      </div>

      {/* Comparison Selection */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Select Comparisons ({selectedComparisons.length}/5)
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {availableComparisons.map((comp) => (
            <label
              key={comp.label}
              className={`
                relative flex items-center p-4 rounded-lg border-2 cursor-pointer transition-all
                ${selectedComparisons.includes(comp.label)
                  ? 'border-brand-primary bg-brand-primary/5'
                  : 'border-gray-200 hover:border-gray-300'
                }
              `}
            >
              <input
                type="checkbox"
                checked={selectedComparisons.includes(comp.label)}
                onChange={() => handleComparisonToggle(comp.label)}
                className="h-4 w-4 text-brand-primary focus:ring-brand-primary border-gray-300 rounded"
              />
              <div className="ml-3 flex-1">
                <div className="text-sm font-medium text-gray-900">{comp.label}</div>
                <div className="text-xs text-gray-500">{comp.degCount} DEGs</div>
              </div>
            </label>
          ))}
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <div className="mt-4 flex gap-3">
          <button
            onClick={fetchVennData}
            disabled={selectedComparisons.length < 2 || loading}
            className="px-4 py-2 bg-brand-primary text-white rounded-md hover:bg-brand-primary/90 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {loading ? 'Analyzing...' : 'Generate Analysis'}
          </button>

          {selectedComparisons.length > 0 && (
            <button
              onClick={() => setSelectedComparisons([])}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 font-medium"
            >
              Clear Selection
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      {vennData && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Analysis Results</h3>

          {/* Visualization */}
          {selectedComparisons.length <= 3 ? (
            <VennDiagram data={vennData} />
          ) : (
            <UpSetPlot data={vennData} />
          )}

          {/* Intersection Table */}
          <div className="mt-6">
            <h4 className="text-md font-semibold text-gray-900 mb-3">Gene Sets</h4>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Set
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Gene Count
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {vennData.intersections
                    .sort((a, b) => b.size - a.size)
                    .map((intersection, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {intersection.sets.length === 1
                            ? `Only in ${intersection.sets[0]}`
                            : `Common to ${intersection.sets.join(' ∩ ')}`
                          }
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {intersection.size} genes
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <button
                            onClick={() => exportGeneList(
                              intersection.genes,
                              intersection.sets.join('_and_')
                            )}
                            className="text-brand-primary hover:text-brand-primary/80 font-medium"
                          >
                            Export List
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

