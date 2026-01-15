'use client';

import { useEffect, useState } from 'react';
import api from '@/utils/api';
import { Dataset } from '@/types';
import { ChevronUp, ChevronDown, Download, Settings, Filter } from 'lucide-react';
import AdvancedFilterBuilder, { AdvancedFilter } from './AdvancedFilterBuilder';
import { useSavedFilters } from '@/hooks/useSavedFilters';

interface DEGTableWithAdvancedFiltersProps {
  dataset: Dataset;
  comparisonName: string;
  projectId?: string;
}

interface DEGRow {
  gene_id: string;
  logFC: number;
  padj: number;
  regulation: 'up' | 'down';
  gene_name?: string;
}

export default function DEGTableWithAdvancedFilters({
  dataset,
  comparisonName,
  projectId
}: DEGTableWithAdvancedFiltersProps) {
  const [data, setData] = useState<DEGRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<'gene_id' | 'logFC' | 'padj'>('padj');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [filterRegulation, setFilterRegulation] = useState<'all' | 'up' | 'down'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [totalGenes, setTotalGenes] = useState(0);
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [activeFilter, setActiveFilter] = useState<AdvancedFilter | null>(null);
  const [filterActive, setFilterActive] = useState(false);

  const { savedFilters, saveFilter, deleteFilter } = useSavedFilters(projectId);

  const [visibleColumns, setVisibleColumns] = useState({
    gene_id: true,
    logFC: true,
    padj: true,
    regulation: true,
    gene_name: true
  });

  useEffect(() => {
    fetchData();
  }, [dataset, comparisonName, currentPage, itemsPerPage, filterRegulation, activeFilter, filterActive]);

  const fetchData = async () => {
    try {
      setLoading(true);

      if (filterActive && activeFilter) {
        // Use advanced filter API
        const response = await api.post(`/datasets/${dataset.id}/advanced-filter`, {
          filter_data: activeFilter,
          comparison_name: comparisonName,
          page: currentPage,
          page_size: itemsPerPage
        });

        const genes = response.data.genes || [];
        setData(transformGenes(genes));
        setTotalGenes(response.data.pagination?.total || 0);
      } else {
        // Use standard API
        const response = await api.get(
          `/datasets/${dataset.id}/deg-genes/${encodeURIComponent(comparisonName)}`,
          {
            params: {
              page: currentPage,
              page_size: itemsPerPage,
              padj_max: 0.05,
              logfc_min: 0.58,
              sort_by: sortField === 'logFC' ? 'log_fc' : sortField,
              sort_order: sortDirection
            }
          }
        );

        const genes = response.data.genes || [];
        setData(transformGenes(genes));
        setTotalGenes(response.data.pagination?.total || 0);
      }
    } catch (err) {
      console.error('Failed to fetch DEG data:', err);
      setError('Failed to load data.');
    } finally {
      setLoading(false);
    }
  };

  const transformGenes = (genes: any[]): DEGRow[] => {
    return genes.map((gene: any) => ({
      gene_id: gene.gene_id,
      logFC: gene.log_fc,
      padj: gene.padj,
      regulation: gene.regulation?.toLowerCase() === 'up' ? 'up' : 'down',
      gene_name: gene.gene_name
    }));
  };

  const handleSort = (field: 'gene_id' | 'logFC' | 'padj') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection(field === 'padj' ? 'asc' : 'desc');
    }
    setCurrentPage(1);
  };

  const handleApplyFilter = (filter: AdvancedFilter) => {
    setActiveFilter(filter);
    setFilterActive(true);
    setCurrentPage(1);
    setShowAdvancedFilters(false);
  };

  const handleClearFilter = () => {
    setActiveFilter(null);
    setFilterActive(false);
    setCurrentPage(1);
  };

  const handleExport = () => {
    const headers = [];
    if (visibleColumns.gene_id) headers.push('Gene ID');
    if (visibleColumns.logFC) headers.push('Log2 Fold Change');
    if (visibleColumns.padj) headers.push('Adjusted P-value');
    if (visibleColumns.regulation) headers.push('Regulation');
    if (visibleColumns.gene_name) headers.push('Gene Name');

    const rows = data.map(row => {
      const values = [];
      if (visibleColumns.gene_id) values.push(row.gene_id);
      if (visibleColumns.logFC) values.push(row.logFC.toFixed(3));
      if (visibleColumns.padj) values.push(row.padj.toExponential(2));
      if (visibleColumns.regulation) values.push(row.regulation);
      if (visibleColumns.gene_name) values.push(row.gene_name || '');
      return values.join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${comparisonName}_filtered_DEGs.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading && !data.length) return <div className="py-4">Loading DEG table...</div>;
  if (error) return <div className="text-red-500 py-4">{error}</div>;

  const filteredData = filterRegulation !== 'all'
    ? data.filter(row => row.regulation === filterRegulation)
    : data;

  const upCount = data.filter(d => d.regulation === 'up').length;
  const downCount = data.filter(d => d.regulation === 'down').length;

  const totalPages = Math.ceil(totalGenes / itemsPerPage);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push(-1);
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push(-1);
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push(-1);
        pages.push(currentPage - 1);
        pages.push(currentPage);
        pages.push(currentPage + 1);
        pages.push(-1);
        pages.push(totalPages);
      }
    }

    return pages;
  };

  return (
    <div className="mt-6">
      {/* Advanced Filters Toggle */}
      <div className="mb-4">
        <button
          onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
          className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-md ${
            filterActive
              ? 'bg-brand-primary text-white'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          <Filter className="h-4 w-4 mr-2" />
          {filterActive ? 'Advanced Filters Active' : 'Advanced Filters'}
          {filterActive && activeFilter && (
            <span className="ml-2 px-2 py-0.5 bg-white/20 rounded text-xs">
              {activeFilter.groups.length} group(s)
            </span>
          )}
        </button>
        {filterActive && (
          <button
            onClick={handleClearFilter}
            className="ml-2 text-sm text-red-600 hover:text-red-800"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Advanced Filter Builder */}
      {showAdvancedFilters && (
        <div className="mb-6">
          <AdvancedFilterBuilder
            onApplyFilter={handleApplyFilter}
            onClearFilter={handleClearFilter}
            savedFilters={savedFilters}
            onSaveFilter={saveFilter}
            onLoadFilter={handleApplyFilter}
            onDeleteFilter={deleteFilter}
          />
        </div>
      )}

      {/* Table Header */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-semibold">Differentially Expressed Genes</h3>
          <div className="flex gap-2 text-sm">
            <span className="px-2 py-1 bg-red-100 text-red-700 rounded">
              ↑ {upCount} Up-regulated
            </span>
            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">
              ↓ {downCount} Down-regulated
            </span>
            <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded">
              Total: {totalGenes}
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          <select
            value={itemsPerPage}
            onChange={(e) => {
              setItemsPerPage(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            <option value={25}>25 per page</option>
            <option value={50}>50 per page</option>
            <option value={100}>100 per page</option>
            <option value={200}>200 per page</option>
          </select>

          <select
            value={filterRegulation}
            onChange={(e) => {
              setFilterRegulation(e.target.value as any);
              setCurrentPage(1);
            }}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            <option value="all">All ({totalGenes})</option>
            <option value="up">Up-regulated ({upCount})</option>
            <option value="down">Down-regulated ({downCount})</option>
          </select>

          <div className="relative">
            <button
              onClick={() => setShowColumnSelector(!showColumnSelector)}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              <Settings className="mr-2 h-4 w-4" />
              Columns
            </button>

            {showColumnSelector && (
              <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-md shadow-lg z-10 p-3">
                <div className="text-xs font-semibold text-gray-700 mb-2">Show/Hide Columns</div>
                <div className="space-y-2">
                  {Object.entries({
                    gene_id: 'Gene ID',
                    logFC: 'Log2 Fold Change',
                    padj: 'Adjusted P-value',
                    regulation: 'Regulation',
                    gene_name: 'Gene Name'
                  }).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                      <input
                        type="checkbox"
                        checked={visibleColumns[key as keyof typeof visibleColumns]}
                        onChange={(e) => setVisibleColumns({
                          ...visibleColumns,
                          [key]: e.target.checked
                        })}
                        className="rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
                      />
                      <span className="text-sm">{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

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
              {visibleColumns.gene_id && (
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('gene_id')}
                >
                  <div className="flex items-center">
                    Gene ID
                    {sortField === 'gene_id' && (
                      sortDirection === 'asc' ? <ChevronUp className="ml-1 h-4 w-4" /> : <ChevronDown className="ml-1 h-4 w-4" />
                    )}
                  </div>
                </th>
              )}
              {visibleColumns.gene_name && (
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Gene Name
                </th>
              )}
              {visibleColumns.logFC && (
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('logFC')}
                >
                  <div className="flex items-center">
                    Log2FC
                    {sortField === 'logFC' && (
                      sortDirection === 'asc' ? <ChevronUp className="ml-1 h-4 w-4" /> : <ChevronDown className="ml-1 h-4 w-4" />
                    )}
                  </div>
                </th>
              )}
              {visibleColumns.padj && (
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('padj')}
                >
                  <div className="flex items-center">
                    Padj
                    {sortField === 'padj' && (
                      sortDirection === 'asc' ? <ChevronUp className="ml-1 h-4 w-4" /> : <ChevronDown className="ml-1 h-4 w-4" />
                    )}
                  </div>
                </th>
              )}
              {visibleColumns.regulation && (
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Regulation
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredData.map((row, idx) => (
              <tr key={idx} className="hover:bg-gray-50">
                {visibleColumns.gene_id && (
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                    {row.gene_id}
                  </td>
                )}
                {visibleColumns.gene_name && (
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                    {row.gene_name || '-'}
                  </td>
                )}
                {visibleColumns.logFC && (
                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                    <span className={`font-mono ${row.logFC > 0 ? 'text-red-600' : 'text-blue-600'}`}>
                      {row.logFC > 0 ? '+' : ''}{row.logFC.toFixed(2)}
                    </span>
                  </td>
                )}
                {visibleColumns.padj && (
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-mono text-gray-700">
                    {row.padj.toExponential(2)}
                  </td>
                )}
                {visibleColumns.regulation && (
                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                    <span className={`px-2 py-1 text-xs font-semibold rounded ${
                      row.regulation === 'up'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {row.regulation === 'up' ? '↑ Up' : '↓ Down'}
                    </span>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <div className="text-sm text-gray-700">
            Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, totalGenes)} of {totalGenes} genes
          </div>

          <div className="flex gap-1">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Previous
            </button>

            {getPageNumbers().map((page, idx) => (
              page === -1 ? (
                <span key={`ellipsis-${idx}`} className="px-3 py-1 text-gray-500">...</span>
              ) : (
                <button
                  key={page}
                  onClick={() => handlePageChange(page)}
                  className={`px-3 py-1 border rounded-md text-sm ${
                    currentPage === page
                      ? 'bg-brand-primary text-white border-brand-primary'
                      : 'border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {page}
                </button>
              )
            ))}

            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
