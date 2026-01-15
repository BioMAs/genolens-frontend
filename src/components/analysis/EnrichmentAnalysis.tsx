'use client';

import { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import api from '@/utils/api';
import { EnrichmentResult } from '@/types';
import Link from 'next/link';
import { Filter, ArrowUpRight, ExternalLink, BarChart2, Table as TableIcon, Activity } from 'lucide-react';
import { PlotData, Layout } from 'plotly.js';

// Dynamically import Plotly (SSR not supported)
const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });

interface EnrichmentAnalysisProps {
    datasetId: string;
}

export default function EnrichmentAnalysis({ datasetId }: EnrichmentAnalysisProps) {
    const [comparisons, setComparisons] = useState<string[]>([]);
    const [selectedComparison, setSelectedComparison] = useState<string>("");
    
    // We store ALL results here
    const [allResults, setAllResults] = useState<EnrichmentResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Filters
    const [categoryFilter, setCategoryFilter] = useState<string>("");
    const [regulationFilter, setRegulationFilter] = useState<string>("ALL");
    const [maxPadj, setMaxPadj] = useState<number>(0.05);
    const [viewMode, setViewMode] = useState<'table' | 'radar'>('table');

    // Fetch comparisons on mount
    useEffect(() => {
        const fetchComparisons = async () => {
             try {
                 const res = await api.get(`/enrichment/${datasetId}/comparisons`);
                 setComparisons(res.data);
                 if (res.data.length > 0) {
                     setSelectedComparison(res.data[0]);
                 }
             } catch (err: any) {
                 console.error("Failed to fetch comparisons", err);
             }
        };
        fetchComparisons();
    }, [datasetId]);

    // Fetch ALL results when comparison or maxPadj changes
    useEffect(() => {
        if (!selectedComparison) return;

        const fetchResults = async () => {
            setLoading(true);
            setError(null);
            try {
                const params = new URLSearchParams();
                params.append('max_padj', maxPadj.toString());
                params.append('limit', '500'); // reasonable limit
                // Note: We intentionally do NOT send 'regulation' or 'category' here
                // We fetch everything and filter client-side

                const res = await api.get(`/enrichment/${datasetId}/${selectedComparison}?${params.toString()}`);
                setAllResults(res.data);
            } catch (err: any) {
                setError("Failed to load enrichment results");
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchResults();
    }, [datasetId, selectedComparison, maxPadj]);

    // Derived filtered results for TABLE
    const filteredResults = useMemo(() => {
        return allResults.filter(r => {
            if (categoryFilter && r.category !== categoryFilter) return false;
            if (regulationFilter !== "ALL" && r.regulation !== regulationFilter) return false;
            return true;
        });
    }, [allResults, categoryFilter, regulationFilter]);

    // Prepare Radar Plot Data
    const radarPlotData: { data: PlotData[], layout: Partial<Layout> } | null = useMemo(() => {
        if (viewMode !== 'radar') return null;
        
        // Filter by category if selected, otherwise take top categories or mixed
        const baseSet = categoryFilter ? allResults.filter(r => r.category === categoryFilter) : allResults;
        
        // Separate UP, DOWN and ALL
        const upPathways = baseSet.filter(r => r.regulation === 'UP').sort((a,b) => a.padj - b.padj).slice(0, 10);
        const downPathways = baseSet.filter(r => r.regulation === 'DOWN').sort((a,b) => a.padj - b.padj).slice(0, 10);
        const allPathways = baseSet.filter(r => r.regulation === 'ALL').sort((a,b) => a.padj - b.padj).slice(0, 10);
        
        // Determine what to plot
        const hasDirectional = upPathways.length > 0 || downPathways.length > 0;
        const hasAll = allPathways.length > 0;

        if (!hasDirectional && !hasAll) return null;

        // Create a unified list of labels (pathw names)
        const labelsMap = new Map<string, string>(); // ID -> Name
        
        const sourceSets = [];
        if (upPathways.length > 0) sourceSets.push(upPathways);
        if (downPathways.length > 0) sourceSets.push(downPathways);
        if (allPathways.length > 0 && !hasDirectional) sourceSets.push(allPathways); // Only plot ALL if no directional data implies redundancy or fallback
        if (allPathways.length > 0 && hasDirectional) {
             // Optional: Decide if we want to overlay ALL with UP/DOWN. Usually it's messy. 
             // Let's only add ALL labels if we are going to plot it. 
             // For now, let's plot ALL as a reference "Global" if available? 
             // User request was "UP and DOWN". 
             // If we have UP/DOWN, we prioritize them.
        }

        // Add labels from all participating sets
        [...upPathways, ...downPathways, ...allPathways].forEach(p => labelsMap.set(p.pathway_id, p.pathway_name));
        
        // Limit total labels to avoid overcrowding (e.g. top 20 total)
        const labels = Array.from(labelsMap.values()).slice(0, 30);
        const ids = Array.from(labelsMap.keys()).slice(0, 30);

        // Helper to get value (-log10 padj)
        const getValue = (id: string, subset: EnrichmentResult[]) => {
            const match = subset.find(r => r.pathway_id === id);
            return match ? -Math.log10(match.padj) : 0;
        };

        const traces: PlotData[] = [];

        if (upPathways.length > 0) {
            const vals = ids.map(id => getValue(id, upPathways));
            traces.push({
                type: 'scatterpolar',
                r: [...vals, vals[0]],
                theta: [...labels, labels[0]],
                fill: 'toself',
                name: 'UP Regulated',
                line: { color: '#ef4444' }, // Red-500
                text: vals.map(v => v > 0 ? `Score: ${v.toFixed(2)}` : ''),
            });
        }

        if (downPathways.length > 0) {
            const vals = ids.map(id => getValue(id, downPathways));
            traces.push({
                type: 'scatterpolar',
                r: [...vals, vals[0]],
                theta: [...labels, labels[0]],
                fill: 'toself',
                name: 'DOWN Regulated',
                line: { color: '#3b82f6' }, // Blue-500
                text: vals.map(v => v > 0 ? `Score: ${v.toFixed(2)}` : ''),
            });
        }

        if (allPathways.length > 0) {
             const vals = ids.map(id => getValue(id, allPathways));
             // Plot 'ALL' if it's the only thing, OR if user wants comparison?
             // Let's plot it as a dashed line or different color like Purple/Green
             traces.push({
                type: 'scatterpolar',
                r: [...vals, vals[0]],
                theta: [...labels, labels[0]],
                fill: hasDirectional ? 'none' : 'toself', // Only fill if it's the main actor
                name: 'Global (All Genes)',
                line: { color: '#10b981', dash: hasDirectional ? 'dot' : 'solid' }, // Emerald-500
                text: vals.map(v => v > 0 ? `Score: ${v.toFixed(2)}` : ''),
                visible: hasDirectional ? 'legendonly' : true // Hide by default if we have split
             });
        }

        if (traces.length === 0) return null;

        // Calculate Max Range
        // Flatten all r values to find max
        const allValues = traces.flatMap(t => (t.r as number[]) || []);
        const maxVal = Math.max(...allValues);

        return {
            data: traces,
            layout: {
                polar: {
                    radialaxis: {
                        visible: true,
                        range: [0, maxVal * 1.1]
                    }
                },
                showlegend: true,
                title: categoryFilter ? `Enrichment: ${categoryFilter}` : 'Top Enriched Pathways',
                margin: { t: 50, b: 50, l: 50, r: 50 },
                height: 500,
                paper_bgcolor: 'rgba(0,0,0,0)',
                plot_bgcolor: 'rgba(0,0,0,0)'
            }
        };

    }, [allResults, viewMode, categoryFilter]);

    const categories = Array.from(new Set(allResults.map(r => r.category))).sort();

    return (
        <div className="space-y-6">
            {/* Controls */}
            <div className="bg-white p-4 rounded-lg shadow border border-gray-200 flex flex-col sm:flex-row gap-4 justify-between items-end">
                <div className="flex flex-wrap gap-4 items-end w-full">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Comparison</label>
                        <select 
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                            value={selectedComparison}
                            onChange={(e) => setSelectedComparison(e.target.value)}
                            disabled={comparisons.length === 0}
                        >
                            {comparisons.length === 0 && <option>No enrichment data found</option>}
                            {comparisons.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Max p-adj</label>
                        <select 
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                            value={maxPadj}
                            onChange={(e) => setMaxPadj(parseFloat(e.target.value))}
                        >
                            <option value={0.01}>0.01</option>
                            <option value={0.05}>0.05</option>
                            <option value={0.10}>0.10</option>
                            <option value={0.25}>0.25</option>
                        </select>
                    </div>
                
                    {viewMode === 'table' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Regulation</label>
                            <div className="flex rounded-md shadow-sm">
                                {['ALL', 'UP', 'DOWN'].map((reg) => (
                                     <button
                                        key={reg}
                                        type="button"
                                        onClick={() => setRegulationFilter(reg)}
                                        className={`
                                            relative inline-flex items-center px-4 py-2 border text-sm font-medium 
                                            ${reg === 'ALL' ? 'rounded-l-md' : ''} 
                                            ${reg === 'DOWN' ? 'rounded-r-md' : ''}
                                            ${regulationFilter === reg 
                                                ? 'z-10 bg-indigo-50 border-indigo-500 text-indigo-600' 
                                                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}
                                            focus:z-10 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500
                                        `}
                                    >
                                        {reg}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex gap-2">
                     <button
                        onClick={() => setViewMode('table')}
                        className={`inline-flex items-center px-3 py-2 border rounded-md text-sm font-medium ${
                            viewMode === 'table' 
                            ? 'bg-indigo-50 border-indigo-500 text-indigo-700' 
                            : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                     >
                        <TableIcon className="h-4 w-4 mr-2" />
                        Table
                     </button>
                     <button
                        onClick={() => setViewMode('radar')}
                        className={`inline-flex items-center px-3 py-2 border rounded-md text-sm font-medium ${
                            viewMode === 'radar' 
                            ? 'bg-indigo-50 border-indigo-500 text-indigo-700' 
                            : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                     >
                        <Activity className="h-4 w-4 mr-2" />
                        Radar Plot
                     </button>
                </div>
            </div>

            {loading && <div className="text-center py-12 text-gray-500">Loading enrichment data...</div>}
            
            {error && <div className="p-4 bg-red-50 text-red-700 rounded-md">{error}</div>}

            {/* Category Filter - Always visible as it affects both views logically */}
            {!loading && !error && allResults.length > 0 && (
                 <div className="flex gap-2 flex-wrap pb-2">
                    {categories.map(cat => (
                        <button 
                            key={cat}
                            onClick={() => setCategoryFilter(categoryFilter === cat ? "" : cat)}
                            className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
                                categoryFilter === cat 
                                ? 'bg-indigo-600 border-indigo-600 text-white' 
                                : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                            }`}
                        >
                            {cat}
                        </button>
                    ))}
                    {categoryFilter && (
                         <button 
                            onClick={() => setCategoryFilter("")}
                            className="px-2 py-1 text-xs text-indigo-600 hover:text-indigo-800"
                        >
                            Clear Filter
                        </button>
                    )}
                </div>
            )}

            {!loading && !error && viewMode === 'radar' && radarPlotData && (
                 <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
                    <Plot
                        data={radarPlotData.data}
                        layout={radarPlotData.layout}
                        useResizeHandler={true}
                        style={{ width: '100%', height: '100%', minHeight: '500px' }}
                    />
                    <div className="mt-4 text-center text-sm text-gray-500">
                        Showing top 10 significant pathways per regulation direction (-log10 P-adj).
                    </div>
                 </div>
            )}

            {!loading && !error && viewMode === 'radar' && !radarPlotData && (
                <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                    Not enough data to generate a Radar Plot (need both UP and DOWN regulated pathways).
                </div>
            )}


            {!loading && !error && viewMode === 'table' && filteredResults.length === 0 && (
                <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                    No enrichment pathways found for these settings.
                </div>
            )}

            {!loading && viewMode === 'table' && filteredResults.length > 0 && (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                     <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                        <span className="text-sm text-gray-700 font-medium">Found {filteredResults.length} pathways</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/3">Name</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Count</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">P-adjust</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reg</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredResults.map((r) => (
                                    <tr key={r.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-indigo-600">
                                            {r.pathway_id}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-900">
                                            <div className="font-medium">{r.pathway_name}</div>
                                            {r.description && <div className="text-xs text-gray-500 truncate max-w-xs">{r.description}</div>}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                                                {r.category}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {r.gene_count}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {r.padj.toExponential(2)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                                r.regulation === 'UP' ? 'bg-red-100 text-red-800' : 
                                                r.regulation === 'DOWN' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                                            }`}>
                                                {r.regulation}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            {(r.category.startsWith('GO:') || r.pathway_id.startsWith('GO:')) && (
                                                <Link 
                                                    href={`/tools/ontology/${encodeURIComponent(r.pathway_id)}`}
                                                    target="_blank"
                                                    className="text-indigo-600 hover:text-indigo-900 flex items-center justify-end"
                                                >
                                                    View <ExternalLink className="h-3 w-3 ml-1"/>
                                                </Link>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
