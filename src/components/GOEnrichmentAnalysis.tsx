'use client';

import { useState } from 'react';
import { Dataset } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Search, ChevronDown, ChevronUp, Network, Table as TableIcon } from 'lucide-react';
import GOEnrichmentTable from './GOEnrichmentTable';
import GOHierarchyGraph from './GOHierarchyGraph';

interface GOEnrichmentAnalysisProps {
  dataset: Dataset;
  comparisonName: string;
}

interface GOEnrichmentParams {
  namespace: string | null;
  regulation: string | null;
  padjThreshold: number;
  logFcThreshold: number;
  minTermSize: number;
  maxTermSize: number;
  pvalueThreshold: number;
  propagateAnnotations: boolean;
}

export default function GOEnrichmentAnalysis({ dataset, comparisonName }: GOEnrichmentAnalysisProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'hierarchy'>('table');
  const [selectedTerm, setSelectedTerm] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // Parameters
  const [params, setParams] = useState<GOEnrichmentParams>({
    namespace: null,
    regulation: null,
    padjThreshold: 0.05,
    logFcThreshold: 0.5,
    minTermSize: 5,
    maxTermSize: 500,
    pvalueThreshold: 0.05,
    propagateAnnotations: true
  });

  const runGOEnrichment = async () => {
    setIsRunning(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('supabase.auth.token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/datasets/${dataset.id}/comparisons/${comparisonName}/go-enrichment`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            namespace: params.namespace,
            regulation: params.regulation,
            padj_threshold: params.padjThreshold,
            log_fc_threshold: params.logFcThreshold,
            min_term_size: params.minTermSize,
            max_term_size: params.maxTermSize,
            pvalue_threshold: params.pvalueThreshold,
            fdr_method: 'fdr_bh',
            propagate_annotations: params.propagateAnnotations,
            organism: 'Homo sapiens'
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'GO enrichment failed');
      }

      const data = await response.json();
      setResults(data);
    } catch (err: any) {
      setError(err.message || 'Failed to run GO enrichment');
      console.error('GO enrichment error:', err);
    } finally {
      setIsRunning(false);
    }
  };

  const getNamespaceBadgeColor = (ns: string) => {
    switch (ns) {
      case 'biological_process': return 'bg-blue-500';
      case 'molecular_function': return 'bg-green-500';
      case 'cellular_component': return 'bg-purple-500';
      default: return 'bg-gray-500';
    }
  };

  const getNamespaceLabel = (ns: string) => {
    switch (ns) {
      case 'biological_process': return 'BP';
      case 'molecular_function': return 'MF';
      case 'cellular_component': return 'CC';
      default: return ns;
    }
  };

  return (
    <div className="space-y-6">
      {/* Parameters Panel */}
      <Card>
        <CardHeader>
          <CardTitle>GO Enrichment Analysis</CardTitle>
          <CardDescription>
            Analyze Gene Ontology term enrichment for {comparisonName}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Basic Parameters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>GO Namespace</Label>
              <Select
                value={params.namespace || 'all'}
                onValueChange={(value) => setParams({ ...params, namespace: value === 'all' ? null : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All namespaces" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Namespaces</SelectItem>
                  <SelectItem value="BP">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                      Biological Process (BP)
                    </span>
                  </SelectItem>
                  <SelectItem value="MF">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-green-500" />
                      Molecular Function (MF)
                    </span>
                  </SelectItem>
                  <SelectItem value="CC">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-purple-500" />
                      Cellular Component (CC)
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Regulation</Label>
              <Select
                value={params.regulation || 'all'}
                onValueChange={(value) => setParams({ ...params, regulation: value === 'all' ? null : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All genes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All DEGs</SelectItem>
                  <SelectItem value="UP">Upregulated Only</SelectItem>
                  <SelectItem value="DOWN">Downregulated Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Adj. P-value Threshold</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                max="1"
                value={params.padjThreshold}
                onChange={(e) => setParams({ ...params, padjThreshold: parseFloat(e.target.value) })}
              />
            </div>
          </div>

          {/* Advanced Parameters Toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full"
          >
            {showAdvanced ? <ChevronUp className="w-4 h-4 mr-2" /> : <ChevronDown className="w-4 h-4 mr-2" />}
            Advanced Parameters
          </Button>

          {showAdvanced && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
              <div className="space-y-2">
                <Label>Log FC Threshold</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  value={params.logFcThreshold}
                  onChange={(e) => setParams({ ...params, logFcThreshold: parseFloat(e.target.value) })}
                />
              </div>

              <div className="space-y-2">
                <Label>Min Term Size</Label>
                <Input
                  type="number"
                  min="1"
                  value={params.minTermSize}
                  onChange={(e) => setParams({ ...params, minTermSize: parseInt(e.target.value) })}
                />
              </div>

              <div className="space-y-2">
                <Label>Max Term Size</Label>
                <Input
                  type="number"
                  min="1"
                  value={params.maxTermSize}
                  onChange={(e) => setParams({ ...params, maxTermSize: parseInt(e.target.value) })}
                />
              </div>

              <div className="space-y-2">
                <Label>Enrichment P-value</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={params.pvalueThreshold}
                  onChange={(e) => setParams({ ...params, pvalueThreshold: parseFloat(e.target.value) })}
                />
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="propagate"
                  checked={params.propagateAnnotations}
                  onChange={(e) => setParams({ ...params, propagateAnnotations: e.target.checked })}
                  className="rounded"
                />
                <Label htmlFor="propagate" className="cursor-pointer">
                  Propagate Annotations (True Path Rule)
                </Label>
              </div>
            </div>
          )}

          {/* Run Button */}
          <Button 
            onClick={runGOEnrichment} 
            disabled={isRunning}
            className="w-full"
          >
            {isRunning ? 'Running GO Enrichment...' : 'Run GO Enrichment Analysis'}
          </Button>

          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-md text-sm text-destructive">
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {results && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Enrichment Results</CardTitle>
                <CardDescription>
                  Found {results.enriched_terms.length} enriched GO terms 
                  ({results.study_size} genes / {results.background_size} background)
                </CardDescription>
              </div>
              
              {/* View Mode Toggle */}
              <div className="flex gap-2">
                <Button
                  variant={viewMode === 'table' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('table')}
                >
                  <TableIcon className="w-4 h-4 mr-2" />
                  Table
                </Button>
                <Button
                  variant={viewMode === 'hierarchy' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('hierarchy')}
                >
                  <Network className="w-4 h-4 mr-2" />
                  Hierarchy
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {viewMode === 'table' ? (
              <GOEnrichmentTable 
                terms={results.enriched_terms}
                onTermSelect={setSelectedTerm}
              />
            ) : (
              <GOHierarchyGraph 
                terms={results.enriched_terms}
                selectedTerm={selectedTerm}
                onTermSelect={setSelectedTerm}
              />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
