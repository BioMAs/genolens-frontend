import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import api from '@/utils/api';

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });

interface CustomVisualizationPanelProps {
    datasetId: string;
    comparisonName: string;
    allGenes?: string[];
}

type VisualizationType = 'pca' | 'umap' | 'boxplot';

interface PCAData {
    data: Array<{
        sample: string;
        pc1: number;
        pc2: number;
        pc3?: number;
        group?: string;
    }>;
    explained_variance: number[];
    total_variance: number;
    n_genes_used: number;
}

interface UMAPData {
    data: Array<{
        sample: string;
        umap1: number;
        umap2: number;
        umap3?: number;
        group?: string;
    }>;
    n_genes_used: number;
    parameters: {
        n_neighbors: number;
        min_dist: number;
    };
}

interface BoxplotData {
    genes: Array<{
        gene: string;
        values: Array<{
            sample: string;
            value: number;
            group: string;
        }>;
    }>;
    n_genes: number;
    n_samples: number;
}

export default function CustomVisualizationPanel({ 
    datasetId, 
    comparisonName,
    allGenes = []
}: CustomVisualizationPanelProps) {
    const [vizType, setVizType] = useState<VisualizationType>('pca');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    // Gene selection
    const [selectedGenes, setSelectedGenes] = useState<string[]>([]);
    const [geneInput, setGeneInput] = useState('');
    const [geneSearchResults, setGeneSearchResults] = useState<string[]>([]);
    
    // PCA/UMAP parameters
    const [nComponents, setNComponents] = useState<2 | 3>(2);
    const [nNeighbors, setNNeighbors] = useState(15);
    const [minDist, setMinDist] = useState(0.1);
    
    // Visualization data
    const [pcaData, setPcaData] = useState<PCAData | null>(null);
    const [umapData, setUmapData] = useState<UMAPData | null>(null);
    const [boxplotData, setBoxplotData] = useState<BoxplotData | null>(null);

    // Gene search autocomplete
    useEffect(() => {
        if (geneInput.length > 1) {
            const filtered = allGenes.filter(g => 
                g.toLowerCase().includes(geneInput.toLowerCase())
            ).slice(0, 20);
            setGeneSearchResults(filtered);
        } else {
            setGeneSearchResults([]);
        }
    }, [geneInput, allGenes]);

    const addGene = (gene: string) => {
        if (!selectedGenes.includes(gene)) {
            setSelectedGenes([...selectedGenes, gene]);
        }
        setGeneInput('');
        setGeneSearchResults([]);
    };

    const removeGene = (gene: string) => {
        setSelectedGenes(selectedGenes.filter(g => g !== gene));
    };

    const calculatePCA = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await api.post(
                `/datasets/${datasetId}/comparisons/${comparisonName}/visualizations/pca`,
                {
                    gene_list: selectedGenes.length > 0 ? selectedGenes : null,
                    n_components: nComponents,
                    color_by: 'condition'
                }
            );
            setPcaData(response.data);
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to calculate PCA');
        } finally {
            setLoading(false);
        }
    };

    const calculateUMAP = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await api.post(
                `/datasets/${datasetId}/comparisons/${comparisonName}/visualizations/umap`,
                {
                    gene_list: selectedGenes.length > 0 ? selectedGenes : null,
                    n_components: nComponents,
                    n_neighbors: nNeighbors,
                    min_dist: minDist,
                    color_by: 'condition'
                }
            );
            setUmapData(response.data);
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to calculate UMAP');
        } finally {
            setLoading(false);
        }
    };

    const calculateBoxplot = async () => {
        if (selectedGenes.length === 0) {
            setError('Please select at least one gene for box plot');
            return;
        }
        
        setLoading(true);
        setError(null);
        try {
            const response = await api.post(
                `/datasets/${datasetId}/comparisons/${comparisonName}/visualizations/boxplot`,
                {
                    gene_list: selectedGenes
                }
            );
            setBoxplotData(response.data);
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to load box plot data');
        } finally {
            setLoading(false);
        }
    };

    const handleGenerate = () => {
        if (vizType === 'pca') {
            calculatePCA();
        } else if (vizType === 'umap') {
            calculateUMAP();
        } else {
            calculateBoxplot();
        }
    };

    const renderPCAPlot = () => {
        if (!pcaData) return null;

        const groups = Array.from(new Set(pcaData.data.map(d => d.group || 'Unknown')));
        const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

        if (nComponents === 2) {
            const traces = groups.map((group, idx) => ({
                x: pcaData.data.filter(d => d.group === group).map(d => d.pc1),
                y: pcaData.data.filter(d => d.group === group).map(d => d.pc2),
                text: pcaData.data.filter(d => d.group === group).map(d => d.sample),
                name: group,
                mode: 'markers',
                type: 'scatter',
                marker: {
                    size: 10,
                    color: colors[idx % colors.length]
                }
            }));

            return (
                <Plot
                    data={traces as any}
                    layout={{
                        title: `PCA - ${pcaData.n_genes_used} genes (${(pcaData.total_variance * 100).toFixed(1)}% variance explained)`,
                        xaxis: { title: `PC1 (${(pcaData.explained_variance[0] * 100).toFixed(1)}%)` },
                        yaxis: { title: `PC2 (${(pcaData.explained_variance[1] * 100).toFixed(1)}%)` },
                        hovermode: 'closest',
                        height: 500
                    } as any}
                    config={{ responsive: true, displayModeBar: true }}
                    style={{ width: '100%' }}
                />
            );
        } else {
            const traces = groups.map((group, idx) => ({
                x: pcaData.data.filter(d => d.group === group).map(d => d.pc1),
                y: pcaData.data.filter(d => d.group === group).map(d => d.pc2),
                z: pcaData.data.filter(d => d.group === group).map(d => d.pc3),
                text: pcaData.data.filter(d => d.group === group).map(d => d.sample),
                name: group,
                mode: 'markers',
                type: 'scatter3d',
                marker: {
                    size: 8,
                    color: colors[idx % colors.length]
                }
            }));

            return (
                <Plot
                    data={traces as any}
                    layout={{
                        title: `PCA 3D - ${pcaData.n_genes_used} genes (${(pcaData.total_variance * 100).toFixed(1)}% variance explained)`,
                        scene: {
                            xaxis: { title: `PC1 (${(pcaData.explained_variance[0] * 100).toFixed(1)}%)` },
                            yaxis: { title: `PC2 (${(pcaData.explained_variance[1] * 100).toFixed(1)}%)` },
                            zaxis: { title: `PC3 (${(pcaData.explained_variance[2] * 100).toFixed(1)}%)` }
                        },
                        height: 600
                    } as any}
                    config={{ responsive: true, displayModeBar: true }}
                    style={{ width: '100%' }}
                />
            );
        }
    };

    const renderUMAPPlot = () => {
        if (!umapData) return null;

        const groups = Array.from(new Set(umapData.data.map(d => d.group || 'Unknown')));
        const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

        if (nComponents === 2) {
            const traces = groups.map((group, idx) => ({
                x: umapData.data.filter(d => d.group === group).map(d => d.umap1),
                y: umapData.data.filter(d => d.group === group).map(d => d.umap2),
                text: umapData.data.filter(d => d.group === group).map(d => d.sample),
                name: group,
                mode: 'markers',
                type: 'scatter',
                marker: {
                    size: 10,
                    color: colors[idx % colors.length]
                }
            }));

            return (
                <Plot
                    data={traces as any}
                    layout={{
                        title: `UMAP - ${umapData.n_genes_used} genes (neighbors=${nNeighbors}, min_dist=${minDist})`,
                        xaxis: { title: 'UMAP1' },
                        yaxis: { title: 'UMAP2' },
                        hovermode: 'closest',
                        height: 500
                    } as any}
                    config={{ responsive: true, displayModeBar: true }}
                    style={{ width: '100%' }}
                />
            );
        } else {
            const traces = groups.map((group, idx) => ({
                x: umapData.data.filter(d => d.group === group).map(d => d.umap1),
                y: umapData.data.filter(d => d.group === group).map(d => d.umap2),
                z: umapData.data.filter(d => d.group === group).map(d => d.umap3),
                text: umapData.data.filter(d => d.group === group).map(d => d.sample),
                name: group,
                mode: 'markers',
                type: 'scatter3d',
                marker: {
                    size: 8,
                    color: colors[idx % colors.length]
                }
            }));

            return (
                <Plot
                    data={traces as any}
                    layout={{
                        title: `UMAP 3D - ${umapData.n_genes_used} genes (neighbors=${nNeighbors}, min_dist=${minDist})`,
                        scene: {
                            xaxis: { title: 'UMAP1' },
                            yaxis: { title: 'UMAP2' },
                            zaxis: { title: 'UMAP3' }
                        },
                        height: 600
                    } as any}
                    config={{ responsive: true, displayModeBar: true }}
                    style={{ width: '100%' }}
                />
            );
        }
    };

    const renderBoxplot = () => {
        if (!boxplotData) return null;

        const traces = boxplotData.genes.map(geneData => {
            const groups = Array.from(new Set(geneData.values.map(v => v.group)));
            
            return groups.map(group => ({
                y: geneData.values.filter(v => v.group === group).map(v => v.value),
                name: `${geneData.gene} - ${group}`,
                type: 'box',
                boxmean: 'sd',
                boxpoints: 'all',
                jitter: 0.3,
                pointpos: -1.8
            }));
        }).flat();

        return (
            <Plot
                data={traces as any}
                layout={{
                    title: `Expression Distribution - ${boxplotData.n_genes} gene(s)`,
                    yaxis: { title: 'Expression Level' },
                    xaxis: { title: '' },
                    height: 500,
                    showlegend: true
                } as any}
                config={{ responsive: true, displayModeBar: true }}
                style={{ width: '100%' }}
            />
        );
    };

    return (
        <div className="space-y-6">
            {/* Visualization Type Selector */}
            <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Custom Visualization</h2>
                
                <div className="flex gap-3 mb-6">
                    <button
                        onClick={() => setVizType('pca')}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                            vizType === 'pca'
                                ? 'bg-brand-primary text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                    >
                        PCA
                    </button>
                    <button
                        onClick={() => setVizType('umap')}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                            vizType === 'umap'
                                ? 'bg-brand-primary text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                    >
                        UMAP
                    </button>
                    <button
                        onClick={() => setVizType('boxplot')}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                            vizType === 'boxplot'
                                ? 'bg-brand-primary text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                    >
                        Box Plot
                    </button>
                </div>

                {/* Gene Selection */}
                <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Gene Selection {vizType === 'boxplot' && <span className="text-red-500">*</span>}
                        <span className="text-gray-500 font-normal ml-2">
                            ({vizType === 'boxplot' ? 'Required' : 'Optional - leave empty to use all genes'})
                        </span>
                    </label>
                    
                    <div className="relative">
                        <input
                            type="text"
                            value={geneInput}
                            onChange={(e) => setGeneInput(e.target.value)}
                            placeholder="Type to search genes..."
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                        />
                        
                        {geneSearchResults.length > 0 && (
                            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                {geneSearchResults.map(gene => (
                                    <button
                                        key={gene}
                                        onClick={() => addGene(gene)}
                                        className="w-full text-left px-4 py-2 hover:bg-gray-100 transition-colors"
                                    >
                                        {gene}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {selectedGenes.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-3">
                            {selectedGenes.map(gene => (
                                <span
                                    key={gene}
                                    className="inline-flex items-center gap-1 px-3 py-1 bg-brand-primary/10 text-brand-primary rounded-full text-sm"
                                >
                                    {gene}
                                    <button
                                        onClick={() => removeGene(gene)}
                                        className="hover:text-brand-primary/80"
                                    >
                                        ×
                                    </button>
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                {/* Parameters */}
                {(vizType === 'pca' || vizType === 'umap') && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Dimensions
                            </label>
                            <select
                                value={nComponents}
                                onChange={(e) => setNComponents(Number(e.target.value) as 2 | 3)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                            >
                                <option value={2}>2D</option>
                                <option value={3}>3D</option>
                            </select>
                        </div>

                        {vizType === 'umap' && (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Neighbors
                                    </label>
                                    <input
                                        type="number"
                                        value={nNeighbors}
                                        onChange={(e) => setNNeighbors(Number(e.target.value))}
                                        min={2}
                                        max={200}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Min Distance
                                    </label>
                                    <input
                                        type="number"
                                        value={minDist}
                                        onChange={(e) => setMinDist(Number(e.target.value))}
                                        min={0}
                                        max={0.99}
                                        step={0.05}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                                    />
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* Generate Button */}
                <button
                    onClick={handleGenerate}
                    disabled={loading || (vizType === 'boxplot' && selectedGenes.length === 0)}
                    className="w-full bg-brand-primary text-white py-3 px-6 rounded-lg font-medium hover:bg-brand-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    {loading ? 'Generating...' : `Generate ${vizType.toUpperCase()}`}
                </button>

                {error && (
                    <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                        {error}
                    </div>
                )}
            </div>

            {/* Visualization Display */}
            {!loading && (
                <div className="bg-white rounded-lg shadow p-6">
                    {vizType === 'pca' && pcaData && renderPCAPlot()}
                    {vizType === 'umap' && umapData && renderUMAPPlot()}
                    {vizType === 'boxplot' && boxplotData && renderBoxplot()}
                    
                    {!pcaData && !umapData && !boxplotData && (
                        <div className="text-center py-12 text-gray-500">
                            Configure parameters and click Generate to create your visualization
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
