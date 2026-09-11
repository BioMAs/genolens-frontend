'use client';

import { useState, useEffect } from 'react';
import api from '@/utils/api';
import { Dataset } from '@/types';

interface MetadataTableProps {
  dataset: Dataset;
}

type MetadataRow = Record<string, unknown>;

export default function MetadataTable({ dataset }: MetadataTableProps) {
  const [data, setData] = useState<MetadataRow[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const resp = await api.post(`/datasets/${dataset.id}/query`, {
          limit: 1000 // Fetch reasonable amount of samples
        });
        setData(resp.data.data);
        // Filter out 'File' column
        const filteredColumns = resp.data.columns.filter((col: string) => col.toLowerCase() !== 'file');
        setColumns(filteredColumns);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch metadata:', err);
        setError('Failed to load metadata.');
      } finally {
        setLoading(false);
      }
    };

    if (dataset.status === 'READY') {
      fetchData();
    }
  }, [dataset.id, dataset.status]);

  if (loading) return <div className="p-4 text-secondary">Loading metadata...</div>;
  if (error) return <div className="p-4 text-red-500">{error}</div>;
  if (!data.length) return <div className="p-4 text-secondary">No metadata available.</div>;

  const formatCellValue = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  };

  return (
    <div className="bg-surface shadow sm:rounded-control overflow-hidden">
      <div className="px-4 py-5 sm:px-6 border-b border-line">
        <h3 className="text-title leading-6 font-medium text-primary">Sample Metadata</h3>
        <p className="mt-1 max-w-2xl text-body-sm text-secondary">
            {data.length} samples found.
        </p>
      </div>
      <div className="overflow-x-auto max-h-[500px]">
        <table className="min-w-full divide-y divide-line">
          <thead className="bg-surface-2 sticky top-0 z-10">
            <tr>
              {columns.map((col) => (
                <th
                  key={col}
                  scope="col"
                  className="px-6 py-3 text-left text-caption font-medium text-secondary uppercase tracking-wider"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-surface divide-y divide-line">
            {data.map((row, idx) => (
              <tr key={idx} className="hover:bg-hover">
                {columns.map((col) => (
                  <td key={`${idx}-${col}`} className="px-6 py-4 whitespace-nowrap text-body-sm text-secondary">
                    {formatCellValue(row[col])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
