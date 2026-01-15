'use client';

import { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import api from '@/utils/api';
import { Dataset } from '@/types';

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });

interface GeneExpressionViewerProps {
  matrixDataset: Dataset;
  sampleIds?: string[];
  comparisonName: string;
  allGenes: string[];
}

export default function GeneExpressionViewer({ 
  matrixDataset, 
  sampleIds, 
  comparisonName,
  allGenes 
}: GeneExpressionViewerProps) {
  const [selectedGene, setSelectedGene] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [expressionData, setExpressionData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Parse comparison name to get conditions
  const conditions = useMemo(() => {
    const parts = comparisonName.split('_vs_');
    if (parts.length === 2) {
      return parts;
    }
    // Try other separators
    const altParts = comparisonName.split(/[-_\s]vs[-_\s]/i);
    if (altParts.length === 2) {
      return altParts;
    }
    return [comparisonName, ''];
  }, [comparisonName]);

  // Load top DEG on mount
  useEffect(() => {
    if (allGenes.length > 0 && !selectedGene) {
      const topGene = allGenes[0];
      setSelectedGene(topGene);
      setSearchTerm(topGene);
      fetchGeneExpression(topGene);
    }
  }, [allGenes]);

  // Filter genes based on search term
  const filteredGenes = useMemo(() => {
    if (!searchTerm) return [];
    return allGenes
      .filter(gene => gene.toLowerCase().includes(searchTerm.toLowerCase()))
      .slice(0, 50); // Limit to 50 results
  }, [searchTerm, allGenes]);

  const fetchGeneExpression = async (gene: string) => {
    if (!gene) return;
    
    try {
      setLoading(true);
      const response = await api.post(`/datasets/${matrixDataset.id}/query`, {
        gene_ids: [gene],
        sample_ids: sampleIds,
        limit: 1
      });

      if (response.data.data.length > 0) {
        const row = response.data.data[0];
        const columns = response.data.columns.filter((c: string) => c !== 'gene_id');
        
        // Group samples by condition
        const condition1Samples: { sample: string; value: number }[] = [];
        const condition2Samples: { sample: string; value: number }[] = [];
        
        columns.forEach((sample: string) => {
          const value = parseFloat(row[sample]);
          if (conditions[0] && sample.toLowerCase().includes(conditions[0].toLowerCase())) {
            condition1Samples.push({ sample, value });
          } else if (conditions[1] && sample.toLowerCase().includes(conditions[1].toLowerCase())) {
            condition2Samples.push({ sample, value });
          }
        });
        
        // Calculate statistics for boxplot
        const calculateBoxplotStats = (values: number[]) => {
          if (values.length === 0) return null;
          
          const sorted = [...values].sort((a, b) => a - b);
          const q1Index = Math.floor(sorted.length * 0.25);
          const q2Index = Math.floor(sorted.length * 0.5);
          const q3Index = Math.floor(sorted.length * 0.75);
          
          const q1 = sorted[q1Index];
          const median = sorted[q2Index];
          const q3 = sorted[q3Index];
          const iqr = q3 - q1;
          
          const min = Math.max(sorted[0], q1 - 1.5 * iqr);
          const max = Math.min(sorted[sorted.length - 1], q3 + 1.5 * iqr);
          const mean = values.reduce((a, b) => a + b, 0) / values.length;
          
          return { min, q1, median, q3, max, mean, values: sorted };
        };
        
        const cond1Values = condition1Samples.map(s => s.value);
        const cond2Values = condition2Samples.map(s => s.value);
        
        setExpressionData({
          gene,
          condition1: {
            name: conditions[0],
            samples: condition1Samples,
            stats: calculateBoxplotStats(cond1Values)
          },
          condition2: {
            name: conditions[1],
            samples: condition2Samples,
            stats: calculateBoxplotStats(cond2Values)
          }
        });
      }
    } catch (err) {
      console.error('Failed to fetch gene expression:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleGeneSelect = (gene: string) => {
    setSelectedGene(gene);
    setSearchTerm(gene);
    setShowDropdown(false);
    fetchGeneExpression(gene);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <h3 className="text-xl font-bold text-gray-900 mb-4">Gene Expression Query</h3>
      
      {/* Autocomplete input */}
      <div className="relative mb-4">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setShowDropdown(true);
          }}
          onFocus={() => setShowDropdown(true)}
          placeholder="Search for a gene (e.g., GAPDH, TP53, ACTB)..."
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary placeholder:text-gray-400"
        />
        
        {/* Dropdown */}
        {showDropdown && filteredGenes.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
            {filteredGenes.map((gene) => (
              <button
                key={gene}
                onClick={() => handleGeneSelect(gene)}
                className="w-full text-left px-3 py-2 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
              >
                {gene}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Loading state */}
      {loading && <div className="text-center py-4">Loading expression data...</div>}

      {/* Expression data display */}
      {!loading && expressionData && expressionData.condition1.stats && expressionData.condition2.stats && (
        <div>
          <div className="mb-6 p-4 bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5 rounded-lg border border-brand-primary/20">
            <span className="text-base font-semibold text-gray-700">Gene: </span>
            <span className="text-lg text-brand-primary font-mono font-bold">{expressionData.gene}</span>
          </div>
          
          {/* Boxplot visualization */}
          <div className="mb-6">
            <Plot
              data={[
                {
                  y: expressionData.condition1.stats.values,
                  type: 'box',
                  name: expressionData.condition1.name,
                  marker: { color: '#3b82f6' },
                  boxmean: 'sd',
                  boxpoints: 'all',
                  jitter: 0.3,
                  pointpos: -1.8,
                },
                {
                  y: expressionData.condition2.stats.values,
                  type: 'box',
                  name: expressionData.condition2.name,
                  marker: { color: '#ef4444' },
                  boxmean: 'sd',
                  boxpoints: 'all',
                  jitter: 0.3,
                  pointpos: -1.8,
                },
              ]}
              layout={{
                title: {
                  text: `Expression of ${expressionData.gene}`,
                  font: { size: 16, weight: 600 }
                },
                yaxis: {
                  title: 'Expression Level',
                  gridcolor: '#e5e7eb'
                },
                xaxis: {
                  title: 'Conditions'
                },
                plot_bgcolor: '#f9fafb',
                paper_bgcolor: '#ffffff',
                showlegend: false,
                margin: { l: 60, r: 40, t: 60, b: 60 },
                height: 400,
              } as any}
              config={{
                displayModeBar: true,
                displaylogo: false,
                modeBarButtonsToRemove: ['select2d', 'lasso2d'],
                toImageButtonOptions: {
                  format: 'png',
                  filename: `${expressionData.gene}_expression`,
                  height: 600,
                  width: 800,
                }
              }}
              style={{ width: '100%' }}
              useResizeHandler={true}
            />
          </div>

          {/* Fold change */}
          <div className="mt-6 p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg border border-gray-200">
            <div className="text-base">
              <span className="font-bold text-gray-900">Fold Change: </span>
              <span className={`font-mono text-lg font-bold ${
                expressionData.condition2.stats.mean > expressionData.condition1.stats.mean 
                  ? 'text-red-600' 
                  : 'text-blue-600'
              }`}>
                {(expressionData.condition2.stats.mean / (expressionData.condition1.stats.mean || 1)).toFixed(2)}x
              </span>
            </div>
          </div>
        </div>
      )}

      {!loading && !expressionData && selectedGene && (
        <div className="text-center py-4 text-gray-500">
          No expression data found for {selectedGene}
        </div>
      )}
    </div>
  );
}
