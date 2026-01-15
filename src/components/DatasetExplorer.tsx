'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Download, Filter, ChevronLeft, ChevronRight, BarChart2, Table as TableIcon, GitMerge, Grid } from 'lucide-react';
import api from '@/utils/api';
import { Dataset, DatasetQueryResponse } from '@/types';
import DatasetVisualizer from './DatasetVisualizer';

interface DatasetExplorerProps {
  projectId: string;
  datasetId: string;
}

export default function DatasetExplorer({ projectId, datasetId }: DatasetExplorerProps) {
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [data, setData] = useState<DatasetQueryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('table');
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const [showColumnSelector, setShowColumnSelector] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 50;

  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const resp = await api.get(`/datasets/${datasetId}`);
        setDataset(resp.data);
      } catch (err) {
        console.error('Failed to fetch dataset metadata:', err);
        setError('Failed to load dataset metadata.');
      }
    };
    fetchMetadata();
  }, [datasetId]);

  // Initial fetch to get columns
  useEffect(() => {
    if (!dataset || availableColumns.length > 0) return;

    const fetchColumns = async () => {
      try {
        const resp = await api.post(`/datasets/${datasetId}/query`, {
          limit: 1,
          offset: 0
        });
        setAvailableColumns(resp.data.columns);
        setSelectedColumns(resp.data.columns);
      } catch (err) {
        console.error('Failed to fetch initial columns:', err);
      }
    };
    fetchColumns();
  }, [dataset, datasetId, availableColumns.length]);

  useEffect(() => {
    const fetchData = async () => {
      if (!dataset) return;
      
      try {
        setLoading(true);
        const offset = (page - 1) * pageSize;
        
        const params: any = {
          limit: pageSize,
          offset: offset
        };

        if (searchQuery.trim()) {
          // Split by comma or space and clean up
          const ids = searchQuery.split(/[\s,]+/).filter(Boolean);
          if (ids.length > 0) {
            params.gene_ids = ids;
          }
        }

        if (selectedColumns.length > 0 && selectedColumns.length < availableColumns.length) {
          params.sample_ids = selectedColumns;
        }

        const resp = await api.post(`/datasets/${datasetId}/query`, params);
        
        setData(resp.data);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch data:', err);
        setError('Failed to load data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    // Debounce search
    const timeoutId = setTimeout(() => {
      if (dataset) {
        fetchData();
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [datasetId, dataset, page, searchQuery, selectedColumns, availableColumns.length]);

  const toggleColumn = (col: string) => {
    setSelectedColumns(prev => 
      prev.includes(col) 
        ? prev.filter(c => c !== col)
        : [...prev, col]
    );
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-md bg-red-50 p-4">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{error}</p>
                </div>
                <div className="mt-4">
                  <Link
                    href={`/projects/${projectId}`}
                    className="text-sm font-medium text-red-800 hover:text-red-900"
                  >
                    &larr; Back to Project
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm z-10">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link 
              href={`/projects/${projectId}`}
              className="text-gray-500 hover:text-gray-700"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                {dataset?.name || 'Loading...'}
              </h1>
              <p className="text-sm text-gray-500">Dataset Explorer</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative rounded-md shadow-sm">
              <input
                type="text"
                className="focus:ring-brand-primary focus:border-brand-primary block w-full sm:text-sm border-gray-300 rounded-md"
                placeholder="Search IDs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Column Selector */}
            <div className="relative">
              <button
                onClick={() => setShowColumnSelector(!showColumnSelector)}
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary"
              >
                <Filter className="h-4 w-4 mr-2" />
                Columns ({selectedColumns.length})
              </button>
              
              {showColumnSelector && (
                <div className="origin-top-right absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50 max-h-96 overflow-y-auto">
                  <div className="py-1" role="menu" aria-orientation="vertical">
                    <div className="px-4 py-2 border-b border-gray-100">
                      <button 
                        className="text-xs text-brand-primary hover:text-brand-primary/80"
                        onClick={() => setSelectedColumns(availableColumns)}
                      >
                        Select All
                      </button>
                      <span className="mx-2 text-gray-300">|</span>
                      <button 
                        className="text-xs text-brand-primary hover:text-brand-primary/80"
                        onClick={() => setSelectedColumns([])}
                      >
                        Clear
                      </button>
                    </div>
                    {availableColumns.map((col) => (
                      <label key={col} className="flex items-center px-4 py-2 hover:bg-gray-100 cursor-pointer">
                        <input
                          type="checkbox"
                          className="h-4 w-4 text-brand-primary focus:ring-brand-primary border-gray-300 rounded"
                          checked={selectedColumns.includes(col)}
                          onChange={() => toggleColumn(col)}
                        />
                        <span className="ml-2 text-sm text-gray-700 truncate" title={col}>
                          {col}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary">
              <Download className="h-4 w-4 mr-2" />
              Export
            </button>
          </div>
        </div>
        
        {/* View Mode Switcher */}
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-4">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8" aria-label="Tabs">
              <button
                onClick={() => setViewMode('table')}
                className={`${
                  viewMode === 'table'
                    ? 'border-brand-primary text-brand-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
              >
                <TableIcon className="h-4 w-4 mr-2" />
                Table View
              </button>
              <button
                onClick={() => setViewMode('chart')}
                className={`${
                  viewMode === 'chart'
                    ? 'border-brand-primary text-brand-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
              >
                <BarChart2 className="h-4 w-4 mr-2" />
                Visualization
              </button>

              {dataset?.type === 'MATRIX' && (
                <Link
                  href={`/projects/${projectId}/datasets/${datasetId}/clustering`}
                  className="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center"
                >
                  <GitMerge className="h-4 w-4 mr-2" />
                  Clustering
                </Link>
              )}

              <Link
                href={`/projects/${projectId}/datasets/${datasetId}/enrichment`}
                className="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center"
              >
                <Grid className="h-4 w-4 mr-2" />
                Enrichment
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
          {viewMode === 'table' ? (
            <div className="bg-white shadow rounded-lg overflow-hidden border border-gray-200">
              {loading && !data ? (
                <div className="p-12 text-center text-gray-500">Loading data...</div>
              ) : data ? (
                <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {data.columns.map((col) => (
                        <th
                          key={col}
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap"
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {data.data.map((row, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        {data.columns.map((col) => (
                          <td
                            key={`${idx}-${col}`}
                            className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                          >
                            {typeof row[col] === 'number' 
                              ? row[col].toLocaleString(undefined, { maximumFractionDigits: 4 }) 
                              : String(row[col])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-12 text-center text-gray-500">No data available</div>
            )}
          </div>
          ) : (
            <div className="h-full">
              {dataset && data ? (
                <DatasetVisualizer dataset={dataset} data={data} />
              ) : (
                <div className="p-12 text-center text-gray-500">Loading visualization...</div>
              )}
            </div>
          )}
        </div>

        {/* Footer / Pagination */}
        {viewMode === 'table' && data && (
          <div className="bg-white border-t border-gray-200 px-4 py-3 flex items-center justify-between sm:px-6">
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Showing <span className="font-medium">{(page - 1) * pageSize + 1}</span> to{' '}
                  <span className="font-medium">
                    {Math.min(page * pageSize, data.total_rows)}
                  </span>{' '}
                  of <span className="font-medium">{data.total_rows}</span> results
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <span className="sr-only">Previous</span>
                    <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                  </button>
                  <button
                    onClick={() => setPage(p => p + 1)}
                    disabled={page * pageSize >= data.total_rows}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <span className="sr-only">Next</span>
                    <ChevronRight className="h-5 w-5" aria-hidden="true" />
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
