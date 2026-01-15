'use client';

import { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown, Download, Eye, TrendingUp, TrendingDown } from 'lucide-react';

interface GSEAResult {
  gene_set_name: string;
  gene_set_size: number;
  enrichment_score: number;
  normalized_enrichment_score: number;
  p_value: number;
  fdr_q_value: number;
  leading_edge_genes: string[];
  core_enrichment: string[];
}

interface GSEATableProps {
  results: GSEAResult[];
  onViewEnrichmentPlot?: (geneSetName: string) => void;
  loading?: boolean;
}

export default function GSEATable({ results, onViewEnrichmentPlot, loading }: GSEATableProps) {
  const [sortField, setSortField] = useState<keyof GSEAResult>('fdr_q_value');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [filterEnrichment, setFilterEnrichment] = useState<'all' | 'positive' | 'negative'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [searchTerm, setSearchTerm] = useState('');

  const handleSort = (field: keyof GSEAResult) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection(field === 'fdr_q_value' || field === 'p_value' ? 'asc' : 'desc');
    }
  };

  const getFilteredAndSortedData = () => {
    let filtered = results;

    // Filter by enrichment direction
    if (filterEnrichment === 'positive') {
      filtered = filtered.filter(r => r.normalized_enrichment_score > 0);
    } else if (filterEnrichment === 'negative') {
      filtered = filtered.filter(r => r.normalized_enrichment_score < 0);
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(r =>
        r.gene_set_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Sort
    return filtered.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      const multiplier = sortDirection === 'asc' ? 1 : -1;

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return (aVal - bVal) * multiplier;
      }
      return String(aVal).localeCompare(String(bVal)) * multiplier;
    });
  };

  const handleExport = () => {
    const sortedData = getFilteredAndSortedData();
    const headers = ['Gene Set', 'Size', 'ES', 'NES', 'P-value', 'FDR q-value', 'Leading Edge'];
    const rows = sortedData.map(row => [
      row.gene_set_name,
      row.gene_set_size,
      row.enrichment_score.toFixed(3),
      row.normalized_enrichment_score.toFixed(3),
      row.p_value.toExponential(2),
      row.fdr_q_value.toFixed(3),
      row.leading_edge_genes.slice(0, 5).join('; ')
    ].join(','));

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'gsea_results.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <div className="py-8 text-center text-gray-600">Running GSEA analysis...</div>;
  }

  const sortedData = getFilteredAndSortedData();
  const positiveCount = results.filter(r => r.normalized_enrichment_score > 0).length;
  const negativeCount = results.filter(r => r.normalized_enrichment_score < 0).length;

  // Pagination
  const totalPages = Math.ceil(sortedData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedData = sortedData.slice(startIndex, endIndex);

  return (
    <div className="mt-6">
      {/* Controls */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-semibold">GSEA Results</h3>
          <div className="flex gap-2 text-sm">
            <span className="px-2 py-1 bg-red-100 text-red-700 rounded inline-flex items-center">
              <TrendingUp className="h-3 w-3 mr-1" />
              {positiveCount} Enriched (Pos)
            </span>
            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded inline-flex items-center">
              <TrendingDown className="h-3 w-3 mr-1" />
              {negativeCount} Enriched (Neg)
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Search gene sets..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm w-64"
          />

          <select
            value={itemsPerPage}
            onChange={(e) => {
              setItemsPerPage(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            <option value={10}>10 per page</option>
            <option value={25}>25 per page</option>
            <option value={50}>50 per page</option>
            <option value={100}>100 per page</option>
          </select>

          <select
            value={filterEnrichment}
            onChange={(e) => {
              setFilterEnrichment(e.target.value as any);
              setCurrentPage(1);
            }}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            <option value="all">All ({results.length})</option>
            <option value="positive">Positive NES ({positiveCount})</option>
            <option value="negative">Negative NES ({negativeCount})</option>
          </select>

          <button
            onClick={handleExport}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                #
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('gene_set_name')}
              >
                <div className="flex items-center">
                  Gene Set
                  {sortField === 'gene_set_name' && (
                    sortDirection === 'asc' ? <ChevronUp className="ml-1 h-4 w-4" /> : <ChevronDown className="ml-1 h-4 w-4" />
                  )}
                </div>
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('gene_set_size')}
              >
                <div className="flex items-center">
                  Size
                  {sortField === 'gene_set_size' && (
                    sortDirection === 'asc' ? <ChevronUp className="ml-1 h-4 w-4" /> : <ChevronDown className="ml-1 h-4 w-4" />
                  )}
                </div>
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('enrichment_score')}
              >
                <div className="flex items-center">
                  ES
                  {sortField === 'enrichment_score' && (
                    sortDirection === 'asc' ? <ChevronUp className="ml-1 h-4 w-4" /> : <ChevronDown className="ml-1 h-4 w-4" />
                  )}
                </div>
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('normalized_enrichment_score')}
              >
                <div className="flex items-center">
                  NES
                  {sortField === 'normalized_enrichment_score' && (
                    sortDirection === 'asc' ? <ChevronUp className="ml-1 h-4 w-4" /> : <ChevronDown className="ml-1 h-4 w-4" />
                  )}
                </div>
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('p_value')}
              >
                <div className="flex items-center">
                  P-value
                  {sortField === 'p_value' && (
                    sortDirection === 'asc' ? <ChevronUp className="ml-1 h-4 w-4" /> : <ChevronDown className="ml-1 h-4 w-4" />
                  )}
                </div>
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('fdr_q_value')}
              >
                <div className="flex items-center">
                  FDR q-value
                  {sortField === 'fdr_q_value' && (
                    sortDirection === 'asc' ? <ChevronUp className="ml-1 h-4 w-4" /> : <ChevronDown className="ml-1 h-4 w-4" />
                  )}
                </div>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Leading Edge
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedData.map((row, idx) => {
              const globalIdx = startIndex + idx + 1;
              const isSignificant = row.fdr_q_value <= 0.25;

              return (
                <tr key={idx} className={`hover:bg-gray-50 ${isSignificant ? 'bg-green-50/30' : ''}`}>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    {globalIdx}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 max-w-md">
                    <div className="flex items-center gap-2">
                      {row.normalized_enrichment_score > 0 ? (
                        <TrendingUp className="h-4 w-4 text-red-600 flex-shrink-0" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-blue-600 flex-shrink-0" />
                      )}
                      <span className="truncate" title={row.gene_set_name}>
                        {row.gene_set_name}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                    {row.gene_set_size}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-mono">
                    <span className={row.enrichment_score > 0 ? 'text-red-600' : 'text-blue-600'}>
                      {row.enrichment_score.toFixed(3)}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-mono font-semibold">
                    <span className={row.normalized_enrichment_score > 0 ? 'text-red-600' : 'text-blue-600'}>
                      {row.normalized_enrichment_score.toFixed(3)}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-mono text-gray-700">
                    {row.p_value.toExponential(2)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-mono">
                    <span className={isSignificant ? 'text-green-700 font-semibold' : 'text-gray-700'}>
                      {row.fdr_q_value.toFixed(3)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 max-w-xs">
                    <div className="truncate" title={row.leading_edge_genes.join(', ')}>
                      {row.leading_edge_genes.slice(0, 3).join(', ')}
                      {row.leading_edge_genes.length > 3 && ` +${row.leading_edge_genes.length - 3} more`}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right text-sm">
                    {onViewEnrichmentPlot && (
                      <button
                        onClick={() => onViewEnrichmentPlot(row.gene_set_name)}
                        className="text-brand-primary hover:text-brand-primary/80 inline-flex items-center"
                        title="View enrichment plot"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <div className="text-sm text-gray-700">
            Showing {startIndex + 1} to {Math.min(endIndex, sortedData.length)} of {sortedData.length} gene sets
          </div>

          <div className="flex gap-1">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Previous
            </button>

            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }

              return (
                <button
                  key={i}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`px-3 py-1 border rounded-md text-sm ${
                    currentPage === pageNum
                      ? 'bg-brand-primary text-white border-brand-primary'
                      : 'border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}

            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Info */}
      {sortedData.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No gene sets match the current filters.
        </div>
      )}
    </div>
  );
}
