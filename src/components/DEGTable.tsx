'use client';

import { useEffect, useState } from 'react';
import api from '@/utils/api';
import { Dataset } from '@/types';
import { ChevronUp, ChevronDown, Download, Settings } from 'lucide-react';

interface DEGTableProps {
  dataset: Dataset;
  comparisonName: string;
}

interface DEGRow {
  gene_id: string;
  logFC: number;
  padj: number;
  regulation: 'up' | 'down';
  gene_name?: string;
  biological_process?: string;
  pathways?: string;
}

export default function DEGTable({ dataset, comparisonName }: DEGTableProps) {
  const [data, setData] = useState<DEGRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<'gene_id' | 'logFC' | 'padj'>('padj');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [filterRegulation, setFilterRegulation] = useState<'all' | 'up' | 'down'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  
  // Total counts from backend (actual database totals)
  const [totalUpCount, setTotalUpCount] = useState(0);
  const [totalDownCount, setTotalDownCount] = useState(0);
  const [totalGenes, setTotalGenes] = useState(0);
  
  // Filter options
  const [logFCThreshold, setLogFCThreshold] = useState(0.58); // Default to match original analysis
  const [padjThreshold, setPadjThreshold] = useState(0.05); // Default standard threshold

  const [visibleColumns, setVisibleColumns] = useState({
    gene_id: true,
    logFC: true,
    padj: true,
    regulation: true
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        console.log('[DEGTable] Comparison name:', comparisonName);
        console.log('[DEGTable] Dataset ID:', dataset.id);

        // Build query parameters based on filter settings
        const padjMax = padjThreshold; // Use dynamic threshold
        const logfcMin = logFCThreshold;

        console.log('[DEGTable] Fetching from database API with filters:', {
          padj_max: padjMax,
          logfc_min: logfcMin
        });

        // Fetch DEG data from database (much faster than loading Parquet)
        const response = await api.get(
          `/datasets/${dataset.id}/deg-genes/${encodeURIComponent(comparisonName)}`,
          {
            params: {
              page: 1,
              page_size: 1000, // Maximum allowed by backend
              padj_max: padjMax,
              logfc_min: logfcMin,
              sort_by: 'padj',
              sort_order: 'asc'
            }
          }
        );

        const genes = response.data.genes || [];
        const total = response.data.pagination?.total || 0;
        const backendUpCount = response.data.total_up || 0;
        const backendDownCount = response.data.total_down || 0;

        console.log('[DEGTable] Fetched from database:', genes.length, 'genes');
        console.log('[DEGTable] Total matching genes:', total);
        console.log('[DEGTable] Backend totals - Up:', backendUpCount, 'Down:', backendDownCount);

        // Transform database format to component format
        const degs: DEGRow[] = genes.map((gene: any) => ({
          gene_id: gene.gene_id,
          logFC: gene.log_fc,
          padj: gene.padj,
          regulation: gene.regulation?.toLowerCase() === 'up' ? 'up' : 'down',
          gene_name: gene.gene_name,
          biological_process: undefined, // These columns are not in deg_genes table yet
          pathways: undefined
        }));

        console.log('[DEGTable] Processed DEGs:', degs.length);
        console.log('[DEGTable] First 5 DEGs:', degs.slice(0, 5));

        // Store backend totals (actual database counts)
        setTotalUpCount(backendUpCount);
        setTotalDownCount(backendDownCount);
        setTotalGenes(total);
        setData(degs);
      } catch (err) {
        console.error('Failed to fetch DEG data:', err);
        setError('Failed to load data.');
      } finally {
        setLoading(false);
      }
    };

    if (dataset && comparisonName) {
      fetchData();
    }
  }, [dataset, comparisonName, logFCThreshold, padjThreshold]);

  const handleSort = (field: 'gene_id' | 'logFC' | 'padj') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection(field === 'padj' ? 'asc' : 'desc');
    }
  };

  const handleExport = () => {
    const filteredData = getFilteredAndSortedData();
    const headers = [];
    if (visibleColumns.gene_id) headers.push('Gene ID');
    if (visibleColumns.logFC) headers.push('Log2 Fold Change');
    if (visibleColumns.padj) headers.push('Adjusted P-value');
    if (visibleColumns.regulation) headers.push('Regulation');
    
    const rows = filteredData.map(row => {
      const values = [];
      if (visibleColumns.gene_id) values.push(row.gene_id);
      if (visibleColumns.logFC) values.push(row.logFC.toFixed(3));
      if (visibleColumns.padj) values.push(row.padj.toExponential(2));
      if (visibleColumns.regulation) values.push(row.regulation);
      return values.join(',');
    });
    
    const csv = [headers.join(','), ...rows].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${comparisonName}_DEGs.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getFilteredAndSortedData = () => {
    let filtered = data;
    
    if (filterRegulation !== 'all') {
      filtered = filtered.filter(row => row.regulation === filterRegulation);
    }
    
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

  if (loading) return <div className="py-4">Loading DEG table...</div>;
  if (error) return <div className="text-red-500 py-4">{error}</div>;

  const sortedData = getFilteredAndSortedData();
  // Use backend totals (actual database counts) instead of counting local data
  const upCount = totalUpCount;
  const downCount = totalDownCount;
  
  // Pagination
  const totalPages = Math.ceil(sortedData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedData = sortedData.slice(startIndex, endIndex);
  
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
        pages.push(-1); // ellipsis
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
      {/* Compact Filter Bar */}
      <div className="flex justify-between items-center mb-4 gap-3">
        <div className="flex items-center gap-3">
          {/* Regulation Filter */}
          <select
            value={filterRegulation}
            onChange={(e) => {
              setFilterRegulation(e.target.value as any);
              setCurrentPage(1);
            }}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            <option value="all">All</option>
            <option value="up">UP</option>
            <option value="down">DOWN</option>
          </select>
          
          {/* LogFC Filter */}
          <div className="flex items-center gap-2">
            <label htmlFor="logfc-threshold" className="text-sm text-gray-600">
              |FC| &gt;
            </label>
            <select
              id="logfc-threshold"
              value={logFCThreshold}
              onChange={(e) => setLogFCThreshold(parseFloat(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="0">0</option>
              <option value="0.25">0.25</option>
              <option value="0.5">0.5</option>
              <option value="0.58">0.58</option>
              <option value="1">1.0</option>
              <option value="1.5">1.5</option>
              <option value="2">2.0</option>
            </select>
          </div>

          {/* Padj Filter */}
          <div className="flex items-center gap-2">
            <label htmlFor="padj-threshold" className="text-sm text-gray-600">
              padj &lt;
            </label>
            <input
              type="number"
              id="padj-threshold"
              min="0.001"
              max="0.1"
              step="0.001"
              value={padjThreshold}
              onChange={(e) => setPadjThreshold(parseFloat(e.target.value))}
              className="w-24 px-2 py-2 border border-gray-300 rounded-md text-sm"
            />
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
                    regulation: 'Regulation'
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
            {paginatedData.map((row, idx) => (
              <tr key={idx} className="hover:bg-gray-50">
                {visibleColumns.gene_id && (
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                    {row.gene_id}
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
            Showing {startIndex + 1} to {Math.min(endIndex, sortedData.length)} of {sortedData.length} genes
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
