'use client';

import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import BookmarkButton from './BookmarkButton';
import ExportMenu from '@/components/ExportMenu';

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

interface GOEnrichmentTableProps {
  terms: GOTerm[];
  onTermSelect?: (goId: string) => void;
  projectId?: string; // Optional project ID for bookmarks
}

export default function GOEnrichmentTable({ terms, onTermSelect, projectId }: GOEnrichmentTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'fdr' | 'pvalue' | 'ratio'>('fdr');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Filter and sort
  const filteredTerms = useMemo(() => {
    let filtered = terms;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = terms.filter(
        (t) =>
          t.go_id.toLowerCase().includes(query) ||
          t.go_name.toLowerCase().includes(query)
      );
    }

    // Sort
    filtered = [...filtered].sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'fdr':
          comparison = a.fdr - b.fdr;
          break;
        case 'pvalue':
          comparison = a.pvalue - b.pvalue;
          break;
        case 'ratio':
          comparison = a.enrichment_ratio - b.enrichment_ratio;
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [terms, searchQuery, sortBy, sortOrder]);

  const toggleSort = (column: 'fdr' | 'pvalue' | 'ratio') => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  const toggleRowExpansion = (goId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(goId)) {
      newExpanded.delete(goId);
    } else {
      newExpanded.add(goId);
    }
    setExpandedRows(newExpanded);
  };

  const getNamespaceBadgeColor = (ns: string) => {
    switch (ns) {
      case 'biological_process':
        return 'bg-blue-500 hover:bg-blue-600';
      case 'molecular_function':
        return 'bg-green-500 hover:bg-green-600';
      case 'cellular_component':
        return 'bg-purple-500 hover:bg-purple-600';
      default:
        return 'bg-gray-500 hover:bg-gray-600';
    }
  };

  const getNamespaceLabel = (ns: string) => {
    switch (ns) {
      case 'biological_process':
        return 'BP';
      case 'molecular_function':
        return 'MF';
      case 'cellular_component':
        return 'CC';
      default:
        return ns;
    }
  };

  return (
    <div className="space-y-4">
      {/* Search and Export */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search GO terms or IDs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        {filteredTerms.length > 0 && (
          <ExportMenu
            data={filteredTerms.map(term => ({
              go_id: term.go_id,
              go_name: term.go_name,
              namespace: term.namespace,
              pvalue: term.pvalue.toExponential(3),
              fdr: term.fdr.toExponential(3),
              enrichment_ratio: term.enrichment_ratio.toFixed(2),
              study_count: term.study_count,
              background_count: term.background_count,
              study_genes: term.study_genes?.join('; ') || ''
            }))}
            filename="go_enrichment_results"
            formats={['csv', 'json', 'html']}
            csvColumns={[
              { key: 'go_id', label: 'GO ID' },
              { key: 'go_name', label: 'GO Term' },
              { key: 'namespace', label: 'Namespace' },
              { key: 'pvalue', label: 'P-value' },
              { key: 'fdr', label: 'FDR' },
              { key: 'enrichment_ratio', label: 'Enrichment Ratio' },
              { key: 'study_count', label: 'Study Count' },
              { key: 'background_count', label: 'Background Count' },
              { key: 'study_genes', label: 'Study Genes' }
            ]}
            htmlConfig={{
              title: 'GO Enrichment Results',
              metadata: {
                'Total Terms': filteredTerms.length,
                'Biological Process': filteredTerms.filter(t => t.namespace === 'biological_process').length,
                'Molecular Function': filteredTerms.filter(t => t.namespace === 'molecular_function').length,
                'Cellular Component': filteredTerms.filter(t => t.namespace === 'cellular_component').length,
                'Generated': new Date().toLocaleString()
              }
            }}
            variant="outline"
            size="sm"
          />
        )}
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="text-left p-3 font-medium">GO Term</th>
                <th className="text-left p-3 font-medium">Namespace</th>
                <th
                  className="text-right p-3 font-medium cursor-pointer hover:bg-muted/80"
                  onClick={() => toggleSort('fdr')}
                >
                  FDR {sortBy === 'fdr' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  className="text-right p-3 font-medium cursor-pointer hover:bg-muted/80"
                  onClick={() => toggleSort('pvalue')}
                >
                  P-value {sortBy === 'pvalue' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  className="text-right p-3 font-medium cursor-pointer hover:bg-muted/80"
                  onClick={() => toggleSort('ratio')}
                >
                  Enrichment {sortBy === 'ratio' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th className="text-right p-3 font-medium">Genes</th>
                <th className="text-center p-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTerms.map((term) => {
                const isExpanded = expandedRows.has(term.go_id);
                return (
                  <>
                    <tr key={term.go_id} className="border-t hover:bg-muted/50 transition-colors">
                      <td className="p-3">
                        <div className="space-y-1">
                          <div className="font-medium">{term.go_name}</div>
                          <div className="text-sm text-muted-foreground">{term.go_id}</div>
                        </div>
                      </td>
                      <td className="p-3">
                        <Badge className={`${getNamespaceBadgeColor(term.namespace)} text-white`}>
                          {getNamespaceLabel(term.namespace)}
                        </Badge>
                      </td>
                      <td className="p-3 text-right font-mono text-sm">
                        {term.fdr.toExponential(2)}
                      </td>
                      <td className="p-3 text-right font-mono text-sm">
                        {term.pvalue.toExponential(2)}
                      </td>
                      <td className="p-3 text-right font-semibold">
                        {term.enrichment_ratio.toFixed(2)}x
                      </td>
                      <td className="p-3 text-right">
                        <span className="text-sm">
                          {term.study_count} / {term.background_count}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleRowExpansion(term.go_id)}
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onTermSelect?.(term.go_id)}
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="border-t bg-muted/30">
                        <td colSpan={7} className="p-4">
                          <div className="space-y-2">
                            <div className="font-medium text-sm">
                              Genes ({term.study_count}):
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {term.study_genes.map((gene) => (
                                <div key={gene} className="inline-flex items-center gap-1">
                                  {projectId && (
                                    <BookmarkButton
                                      projectId={projectId}
                                      geneSymbol={gene}
                                      size="sm"
                                      variant="icon"
                                    />
                                  )}
                                  <Badge variant="secondary">
                                    {gene}
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {filteredTerms.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          No GO terms found matching your search.
        </div>
      )}

      {filteredTerms.length > 0 && (
        <div className="text-sm text-muted-foreground text-center">
          Showing {filteredTerms.length} of {terms.length} terms
        </div>
      )}
    </div>
  );
}
