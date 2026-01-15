'use client';

import { useEffect, useState } from 'react';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import api from '@/utils/api';
import { Loader2, Sparkles, ChevronDown, Send, Lock, Info } from 'lucide-react';
import { UserProfile } from '@/types';

interface EnrichmentRadarPlotProps {
  datasetId: string;
  comparisonName: string;
  selectedTerms?: string[];
  maxTerms?: number;
}

interface RadarDataPoint {
  term: string;
  shortTerm: string;
  category: string;
  // ALL
  negLogPValue_ALL: number;
  geneRatio_ALL: number;
  // UP
  negLogPValue_UP: number;
  geneRatio_UP: number;
  // DOWN
  negLogPValue_DOWN: number;
  geneRatio_DOWN: number;
}

export default function EnrichmentRadarPlot({ 
  datasetId, 
  comparisonName, 
  selectedTerms,
  maxTerms = 10
}: EnrichmentRadarPlotProps) {
  const [data, setData] = useState<RadarDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState<'top' | 'ai' | 'custom'>('top');
  const [availableTerms, setAvailableTerms] = useState<Array<{ term: string; category: string; pValue: number }>>([]);
  const [customSelected, setCustomSelected] = useState<string[]>([]);
  const [showTermSelector, setShowTermSelector] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [showAiPrompt, setShowAiPrompt] = useState(false);
  const [termSearchQuery, setTermSearchQuery] = useState('');

  // Fetch user profile to check subscription
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await api.get('/users/me');
        setUserProfile(response.data);
      } catch (err) {
        console.error('Failed to fetch user profile:', err);
      }
    };
    fetchProfile();
  }, []);

  useEffect(() => {
    fetchRadarData();
  }, [datasetId, comparisonName, selectionMode, customSelected]);

  const fetchRadarData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch enrichment pathways for this comparison
      const response = await api.get(
        `/datasets/${datasetId}/enrichment-pathways/${encodeURIComponent(comparisonName)}`,
        {
          params: {
            page_size: 500, // Increase limit to capture all regulation variants
            sort_by: 'padj',
            sort_order: 'asc'
          }
        }
      );

      // Handle list response directly or wrapped
      const pathwaysRaw = Array.isArray(response.data) ? response.data : (response.data.pathways || []);
      
      if (pathwaysRaw.length === 0) {
        console.warn('[RadarPlot] No pathways from database - attempting Parquet fallback');
        throw new Error('No pathways from database, trying Parquet fallback');
      }

      // Group by Term to handle ALL/UP/DOWN
      const groupedMap = new Map<string, any[]>();
      pathwaysRaw.forEach((p: any) => {
          const term = p.pathway_name;
          if (!groupedMap.has(term)) groupedMap.set(term, []);
          groupedMap.get(term)?.push(p);
      });

      // Sort terms by significance (min padj in group)
      const sortedTerms = Array.from(groupedMap.keys()).sort((a, b) => {
          const minP_a = Math.min(...(groupedMap.get(a)?.map((p:any) => p.padj || p.pvalue || 1) || [1]));
          const minP_b = Math.min(...(groupedMap.get(b)?.map((p:any) => p.padj || p.pvalue || 1) || [1]));
          return minP_a - minP_b;
      });

      // Store available terms
      setAvailableTerms(sortedTerms.map((term) => {
        const group = groupedMap.get(term)!;
        const bestP = Math.min(...group.map((p:any) => p.padj || p.pvalue || 1));
        return {
          term: term,
          pathway_id: group[0].pathway_id || '',
          category: group[0].category,
          pValue: bestP
        };
      }));

      // Select terms based on mode
      let termsToKeep: string[] = [];
      
      if (selectionMode === 'custom' && customSelected.length > 0) {
        termsToKeep = customSelected;
      } else if (selectionMode === 'ai') {
        // In AI mode, show top terms initially until user submits AI prompt
        termsToKeep = sortedTerms.slice(0, maxTerms);
      } else {
        // Top mode: just take the most significant terms
        termsToKeep = sortedTerms.slice(0, maxTerms);
      }

      // Flatten selected groups back to objects
      const selectedPathways = termsToKeep.flatMap(term => groupedMap.get(term) || []);
      transformAndSetData(selectedPathways);

    } catch (err: any) {
      console.error('[RadarPlot] Database failed, trying Parquet fallback:', err);
      
      // Parquet fallback
      try {
        const response = await api.post(`/datasets/${datasetId}/query`, {
          limit: 5000
        });

        let rawData = response.data.data;
        const cols = response.data.columns;
        
        console.log('[RadarPlot] 📦 Parquet fallback - Raw data:', rawData.length);

        // Filter by comparison
        const clusterCol = cols.find((c: string) =>
          c.toLowerCase().includes('gene.cluster') ||
          c.toLowerCase().includes('cluster')
        );

        if (clusterCol) {
          rawData = rawData.filter((row: any) => {
            const clusterValue = String(row[clusterCol] || '');
            const cleanCluster = clusterValue.includes(':') ? clusterValue.split(':').pop() : clusterValue;
            return cleanCluster?.includes(comparisonName);
          });
        }

        // Find columns
        const termCol = cols.find((c: string) => c.toLowerCase() === 'term');
        const pvalCol = cols.find((c: string) => c.toLowerCase().includes('adj.p'));
        const categoryCol = cols.find((c: string) => c.toLowerCase() === 'category');
        const genesCol = cols.find((c: string) => c.toLowerCase() === 'genes');
        const rCol = cols.find((c: string) => c === 'r');
        const RCol = cols.find((c: string) => c === 'R');

        // Process Parquet data
        const parquetPathways = rawData
          .filter((row: any) => row[pvalCol] && row[pvalCol] > 0)
          .sort((a: any, b: any) => parseFloat(a[pvalCol]) - parseFloat(b[pvalCol]))
          .slice(0, 100) // Take top 100
          .map((row: any) => ({
            pathway_name: row[termCol],
            pvalue: parseFloat(row[pvalCol]),
            padj: parseFloat(row[pvalCol]),
            category: categoryCol ? row[categoryCol] : 'Unknown',
            genes: genesCol ? String(row[genesCol]).split('|') : [],
            gene_ratio: rCol && RCol ? parseFloat(row[rCol]) / parseFloat(row[RCol]) : 0,
            regulation: 'ALL' // Default for parquet
          }));

        console.log('[RadarPlot] ✅ Parquet fallback loaded', parquetPathways.length, 'pathways');

        if (parquetPathways.length === 0) {
          setError('No enrichment data available');
          setLoading(false);
          return;
        }

        // Store available terms
        setAvailableTerms(parquetPathways.map((p: any) => ({
          term: p.pathway_name,
          category: p.category,
          pValue: p.pvalue
        })));

        // Select top terms
        const selectedPathways = parquetPathways.slice(0, maxTerms);
        transformAndSetData(selectedPathways);
        
      } catch (fallbackErr) {
        console.error('[RadarPlot] Parquet fallback failed:', fallbackErr);
        setError('Failed to load enrichment data');
        setLoading(false);
      }
    }
  };

  const handleAiSelection = async () => {
    if (!aiPrompt.trim()) {
      alert('Please enter instructions for AI term selection');
      return;
    }

    // Check subscription
    if (!userProfile || (userProfile.subscription_plan === 'BASIC' && userProfile.role !== 'ADMIN')) {
      alert('AI term selection requires a PREMIUM or ADVANCED subscription');
      return;
    }

    try {
      setAiLoading(true);
      setError(null);

      const response = await api.post(
        `/datasets/${datasetId}/enrichment-pathways/${encodeURIComponent(comparisonName)}/ai-select`,
        {
          user_prompt: aiPrompt,
          max_terms: maxTerms
        }
      );

      const selectedTerms = response.data.selected_terms || [];
      transformAndSetData(selectedTerms);
      setShowAiPrompt(false);
      
    } catch (err: any) {
      console.error('AI selection failed:', err);
      if (err.response?.status === 403) {
        setError('AI features require a PREMIUM or ADVANCED subscription');
      } else {
        setError(err.response?.data?.detail || 'AI selection failed');
      }
    } finally {
      setAiLoading(false);
    }
  };

  const transformAndSetData = (selectedPathways: any[]) => {
    // Group by term to handle multiple regulations
    const groups = new Map<string, any[]>();
    selectedPathways.forEach(p => {
       const term = p.pathway_name || p.term;
       if (!term) return;
       if (!groups.has(term)) groups.set(term, []);
       groups.get(term)?.push(p);
    });

    const radarData: RadarDataPoint[] = Array.from(groups.entries()).map(([term, termPathways]) => {
      const pathwayName = term;
      const shortTerm = pathwayName.length > 40 ? pathwayName.substring(0, 37) + '...' : pathwayName;
      const category = termPathways[0].category || 'Unknown';

      const getVals = (reg: string) => {
         const entry = termPathways.find(p => (p.regulation || 'ALL').toUpperCase() === reg);
         if (!entry) return { negLogP: 0, geneRatio: 0, pValue: 1.0 };
         
         const pValue = entry.padj || entry.pvalue || entry.p_value || 1.0;
         const safeP = pValue <= 0 ? 1e-300 : pValue; 
         let negLogP = -Math.log10(safeP);
         if (negLogP > 5) negLogP = 5;
         
         let ratio = 0;
         if (typeof entry.gene_ratio === 'number') {
             ratio = entry.gene_ratio * 100;
         } else if (typeof entry.gene_ratio === 'string' && entry.gene_ratio.includes('/')) {
             const [k, n] = entry.gene_ratio.split('/');
             ratio = (parseInt(k) / parseInt(n)) * 100;
         }
         
         return { negLogP, geneRatio: ratio, pValue };
      };

      const all = getVals('ALL');
      const up = getVals('UP');
      const down = getVals('DOWN');

      return {
        term,
        shortTerm,
        category,
        negLogPValue_ALL: all.negLogP,
        geneRatio_ALL: all.geneRatio,
        negLogPValue_UP: up.negLogP,
        geneRatio_UP: up.geneRatio,
        negLogPValue_DOWN: down.negLogP,
        geneRatio_DOWN: down.geneRatio
      };
    });

    setData(radarData);
    setLoading(false);
  };

  const toggleTermSelection = (term: string) => {
    if (customSelected.includes(term)) {
      setCustomSelected(customSelected.filter(t => t !== term));
    } else {
      if (customSelected.length < maxTerms) {
        setCustomSelected([...customSelected, term]);
      }
    }
  };

  const canUseAI = userProfile && (userProfile.role === 'ADMIN' || ['PREMIUM', 'ADVANCED'].includes(userProfile.subscription_plan));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-4 border-2 border-purple-300 shadow-lg rounded-lg max-w-sm">
          <p className="font-bold text-sm text-gray-900 mb-2">{data.term}</p>
          <div className="space-y-1 text-xs">
            <p className="text-gray-700 font-semibold mb-2">Category: {data.category}</p>
            
            {data.negLogPValue_ALL > 0 && (
               <div className="flex items-center gap-2 text-purple-700">
                   <span className="font-bold w-12">ALL:</span>
                   <span>p={Math.pow(10, -data.negLogPValue_ALL).toExponential(1)}</span>
                   <span className="text-gray-500">(GR: {data.geneRatio_ALL.toFixed(1)}%)</span>
               </div>
            )}
            {data.negLogPValue_UP > 0 && (
               <div className="flex items-center gap-2 text-red-600">
                   <span className="font-bold w-12">UP:</span>
                   <span>p={Math.pow(10, -data.negLogPValue_UP).toExponential(1)}</span>
                   <span className="text-gray-500">(GR: {data.geneRatio_UP.toFixed(1)}%)</span>
               </div>
            )}
            {data.negLogPValue_DOWN > 0 && (
               <div className="flex items-center gap-2 text-blue-600">
                   <span className="font-bold w-12">DOWN:</span>
                   <span>p={Math.pow(10, -data.negLogPValue_DOWN).toExponential(1)}</span>
                   <span className="text-gray-500">(GR: {data.geneRatio_DOWN.toFixed(1)}%)</span>
               </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-purple-600 mx-auto mb-3" />
          <p className="text-sm text-gray-600">Loading radar plot...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-sm text-red-700">{error}</p>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-sm text-yellow-700">No enrichment terms selected</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Selection Mode Controls */}
      <div className="flex items-center justify-between bg-gradient-to-r from-purple-50 to-blue-50 p-4 rounded-lg border border-purple-200">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-700">Term Selection:</span>
          <div className="flex gap-2">
            <button
              onClick={() => setSelectionMode('top')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                selectionMode === 'top'
                  ? 'bg-purple-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-purple-100'
              }`}
            >
              Top {maxTerms}
            </button>
            <button
              onClick={() => {
                if (canUseAI) {
                  setSelectionMode('ai');
                  setShowAiPrompt(true);
                  setShowTermSelector(false);
                } else {
                  alert('AI term selection requires a PREMIUM or ADVANCED subscription');
                }
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1 ${
                selectionMode === 'ai'
                  ? 'bg-purple-600 text-white'
                  : canUseAI
                  ? 'bg-white text-gray-700 hover:bg-purple-100'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
              disabled={!canUseAI}
            >
              {!canUseAI && <Lock className="w-3 h-3" />}
              <Sparkles className="w-3 h-3" />
              AI Select
            </button>
            <button
              onClick={() => {
                setSelectionMode('custom');
                setShowTermSelector(!showTermSelector);
                setShowAiPrompt(false);
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1 ${
                selectionMode === 'custom'
                  ? 'bg-purple-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-purple-100'
              }`}
            >
              Custom
              <ChevronDown className={`w-3 h-3 transition-transform ${showTermSelector ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>
        <span className="text-xs text-gray-600">
          {data.length} term{data.length > 1 ? 's' : ''} displayed
        </span>
      </div>

      {/* AI Prompt Input */}
      {showAiPrompt && selectionMode === 'ai' && (
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-4">
          <div className="flex items-start gap-2 mb-3">
            <Sparkles className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-gray-900 mb-1">AI-Powered Term Selection</h4>
              <p className="text-xs text-gray-600 mb-3">
                Describe what biological processes you're interested in, and AI will select the most relevant terms
              </p>
              <textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="Example: 'focus on liver metabolism and lipid pathways' or 'immune response related to hepatocytes'"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                rows={3}
                disabled={aiLoading}
              />
              <div className="flex items-center justify-between mt-3">
                <span className="text-xs text-gray-500">
                  {aiPrompt.length}/200 characters
                </span>
                <button
                  onClick={handleAiSelection}
                  disabled={aiLoading || !aiPrompt.trim()}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {aiLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      AI is selecting...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Select Terms
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom Term Selector */}
      {showTermSelector && selectionMode === 'custom' && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="mb-3">
            <input
              type="text"
              placeholder="Search pathways..."
              value={termSearchQuery}
              onChange={(e) => setTermSearchQuery(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <p className="text-xs text-gray-600 mb-3">
            Select up to {maxTerms} terms (currently: {customSelected.length}/{maxTerms})
          </p>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {availableTerms
              .filter(term => 
                termSearchQuery === '' || 
                term.term.toLowerCase().includes(termSearchQuery.toLowerCase()) ||
                (term.category && term.category.toLowerCase().includes(termSearchQuery.toLowerCase()))
              )
              .slice(0, 50)
              .map((term, idx) => (
              <label key={idx} className="flex items-start gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                <input
                  type="checkbox"
                  checked={customSelected.includes(term.term)}
                  onChange={() => toggleTermSelection(term.term)}
                  disabled={!customSelected.includes(term.term) && customSelected.length >= maxTerms}
                  className="mt-1"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-900 truncate">{term.term}</p>
                  <p className="text-xs text-gray-500">
                    {term.category} • p={term.pValue.toExponential(2)}
                  </p>
                </div>
              </label>
            ))}
          </div>
          {customSelected.length > 0 && (
            <div className="mt-3 flex justify-between items-center border-t pt-3">
              <span className="text-xs text-gray-600">
                {customSelected.length} term{customSelected.length > 1 ? 's' : ''} selected
              </span>
              <button
                onClick={() => setCustomSelected([])}
                className="text-xs text-purple-600 hover:text-purple-800 font-medium"
              >
                Clear selection
              </button>
            </div>
          )}
        </div>
      )}

      {/* Radar Plot */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <ResponsiveContainer width="100%" height={500}>
          <RadarChart data={data}>
            <PolarGrid stroke="#d1d5db" />
            <PolarAngleAxis
              dataKey="shortTerm"
              tick={{ fill: '#374151', fontSize: 11 }}
              tickLine={{ stroke: '#9ca3af' }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[-1, 5]}
              tick={{ fill: '#6b7280', fontSize: 10 }}
              label={{ value: '-log10(p-value)', position: 'insideTop', fill: '#374151', fontSize: 12 }}
            />
            
            <Radar
              name="ALL"
              dataKey="negLogPValue_ALL"
              stroke="#8b5cf6"
              fill="#8b5cf6"
              fillOpacity={0.2}
              strokeWidth={2}
              dot={(props: any) => {
                 const { cx, cy, payload } = props;
                 const r = 3 + ((payload.geneRatio_ALL || 0) / 10);
                 return <circle cx={cx} cy={cy} r={r} fill="#7c3aed" stroke="#fff" strokeWidth={1} />;
              }}
            />
            
            <Radar
              name="UP"
              dataKey="negLogPValue_UP"
              stroke="#ef4444"
              fill="#ef4444"
              fillOpacity={0.2}
              strokeWidth={2}
              dot={(props: any) => {
                 const { cx, cy, payload } = props;
                 const r = 3 + ((payload.geneRatio_UP || 0) / 10);
                 return <circle cx={cx} cy={cy} r={r} fill="#ef4444" stroke="#fff" strokeWidth={1} />;
              }}
            />
            
            <Radar
              name="DOWN"
              dataKey="negLogPValue_DOWN"
              stroke="#3b82f6"
              fill="#3b82f6"
              fillOpacity={0.2}
              strokeWidth={2}
              dot={(props: any) => {
                 const { cx, cy, payload } = props;
                 const r = 3 + ((payload.geneRatio_DOWN || 0) / 10);
                 return <circle cx={cx} cy={cy} r={r} fill="#3b82f6" stroke="#fff" strokeWidth={1} />;
              }}
            />
            
            <Legend />
            <Tooltip content={<CustomTooltip />} />
          </RadarChart>
        </ResponsiveContainer>

        {/* Legend */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-center gap-6 text-xs text-gray-600">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-purple-500 opacity-50"></div>
              <span>Radial distance = -log10(p-value)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                <div className="w-2 h-2 rounded-full bg-purple-600"></div>
                <div className="w-3 h-3 rounded-full bg-purple-600"></div>
                <div className="w-4 h-4 rounded-full bg-purple-600"></div>
              </div>
              <span>Dot size = % genes in term</span>
            </div>
          </div>
          <p className="text-center text-xs text-gray-500 mt-2">
            Nominal p-values (unadjusted) • Preselected family of {data.length} terms
          </p>
        </div>
      </div>
    </div>
  );
}
