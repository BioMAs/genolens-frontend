'use client';

import { useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface GOTerm {
  go_id: string;
  go_name: string;
  namespace: string;
  pvalue: number;
  fdr: number;
  enrichment_ratio: number;
  study_count: number;
  study_genes: string[];
  background_count: number;
  level?: number;
}

interface GOHierarchyGraphProps {
  terms: GOTerm[];
  selectedTerm: string | null;
  onTermSelect: (goId: string) => void;
}

export default function GOHierarchyGraph({ 
  terms, 
  selectedTerm, 
  onTermSelect 
}: GOHierarchyGraphProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [hoveredTerm, setHoveredTerm] = useState<GOTerm | null>(null);

  // Group terms by namespace
  const termsByNamespace = {
    biological_process: terms.filter((t) => t.namespace === 'biological_process'),
    molecular_function: terms.filter((t) => t.namespace === 'molecular_function'),
    cellular_component: terms.filter((t) => t.namespace === 'cellular_component'),
  };

  const getNamespaceBadgeColor = (ns: string) => {
    switch (ns) {
      case 'biological_process':
        return 'bg-blue-500';
      case 'molecular_function':
        return 'bg-green-500';
      case 'cellular_component':
        return 'bg-purple-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getNamespaceLabel = (ns: string) => {
    switch (ns) {
      case 'biological_process':
        return 'Biological Process';
      case 'molecular_function':
        return 'Molecular Function';
      case 'cellular_component':
        return 'Cellular Component';
      default:
        return ns;
    }
  };

  const getFDRColor = (fdr: number) => {
    if (fdr < 0.001) return 'bg-red-600';
    if (fdr < 0.01) return 'bg-orange-500';
    if (fdr < 0.05) return 'bg-yellow-500';
    return 'bg-gray-400';
  };

  return (
    <div className="space-y-6">
      {/* Hierarchical View by Namespace */}
      {Object.entries(termsByNamespace).map(([namespace, namespaceTerms]) => {
        if (namespaceTerms.length === 0) return null;

        // Sort by level (if available) and FDR
        const sortedTerms = [...namespaceTerms].sort((a, b) => {
          if (a.level !== undefined && b.level !== undefined) {
            if (a.level !== b.level) return a.level - b.level;
          }
          return a.fdr - b.fdr;
        });

        return (
          <Card key={namespace}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Badge className={`${getNamespaceBadgeColor(namespace)} text-white`}>
                  {getNamespaceLabel(namespace)}
                </Badge>
                <CardTitle className="text-lg">
                  {namespaceTerms.length} enriched terms
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {/* Hierarchical Layout */}
              <div className="space-y-3">
                {sortedTerms.map((term) => {
                  const isSelected = selectedTerm === term.go_id;
                  const indent = (term.level || 0) * 24; // Indentation based on hierarchy level

                  return (
                    <div
                      key={term.go_id}
                      className={`
                        border rounded-lg p-4 cursor-pointer transition-all
                        hover:shadow-md hover:border-primary/50
                        ${isSelected ? 'border-primary bg-primary/5 shadow-md' : 'border-border'}
                      `}
                      style={{ marginLeft: `${indent}px` }}
                      onClick={() => onTermSelect(term.go_id)}
                      onMouseEnter={() => setHoveredTerm(term)}
                      onMouseLeave={() => setHoveredTerm(null)}
                    >
                      <div className="flex items-start justify-between gap-4">
                        {/* Left: Term Info */}
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            {/* Significance Indicator */}
                            <div className={`w-3 h-3 rounded-full ${getFDRColor(term.fdr)}`} />
                            
                            <div className="font-medium">{term.go_name}</div>
                          </div>
                          
                          <div className="text-sm text-muted-foreground">
                            {term.go_id}
                          </div>

                          {/* Statistics */}
                          <div className="flex items-center gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">FDR:</span>{' '}
                              <span className="font-mono">{term.fdr.toExponential(2)}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Enrichment:</span>{' '}
                              <span className="font-semibold">{term.enrichment_ratio.toFixed(2)}x</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Genes:</span>{' '}
                              <span>{term.study_count}/{term.background_count}</span>
                            </div>
                          </div>
                        </div>

                        {/* Right: Visualization */}
                        <div className="flex flex-col items-end gap-2">
                          {/* Enrichment Bar */}
                          <div className="w-32 h-6 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full ${getNamespaceBadgeColor(namespace)} transition-all`}
                              style={{ 
                                width: `${Math.min(100, (term.enrichment_ratio / 5) * 100)}%` 
                              }}
                            />
                          </div>
                          
                          {/* Level Badge */}
                          {term.level !== undefined && (
                            <Badge variant="outline" className="text-xs">
                              Level {term.level}
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Expanded Gene List (on hover or selection) */}
                      {(hoveredTerm?.go_id === term.go_id || isSelected) && (
                        <div className="mt-4 pt-4 border-t">
                          <div className="text-sm font-medium mb-2">
                            Associated Genes ({term.study_count}):
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {term.study_genes.slice(0, 20).map((gene) => (
                              <Badge key={gene} variant="secondary" className="text-xs">
                                {gene}
                              </Badge>
                            ))}
                            {term.study_genes.length > 20 && (
                              <Badge variant="outline" className="text-xs">
                                +{term.study_genes.length - 20} more
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Legend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Significance Legend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-600" />
              <span>FDR &lt; 0.001</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-orange-500" />
              <span>FDR &lt; 0.01</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <span>FDR &lt; 0.05</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-gray-400" />
              <span>Not significant</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {terms.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          No GO terms to display
        </div>
      )}
    </div>
  );
}
