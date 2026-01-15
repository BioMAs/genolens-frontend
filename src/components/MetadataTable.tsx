'use client';

import { useState, useEffect } from 'react';
import api from '@/utils/api';
import { Dataset } from '@/types';

interface MetadataTableProps {
  dataset: Dataset;
}

export default function MetadataTable({ dataset }: MetadataTableProps) {
  const [data, setData] = useState<any[]>([]);
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

  if (loading) return <div className="p-4 text-gray-500">Loading metadata...</div>;
  if (error) return <div className="p-4 text-red-500">{error}</div>;
  if (!data.length) return <div className="p-4 text-gray-500">No metadata available.</div>;

  return (
    <div className="bg-white shadow sm:rounded-lg overflow-hidden">
      <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
        <h3 className="text-lg leading-6 font-medium text-gray-900">Sample Metadata</h3>
        <p className="mt-1 max-w-2xl text-sm text-gray-500">
            {data.length} samples found.
        </p>
      </div>
      <div className="overflow-x-auto max-h-[500px]">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              {columns.map((col) => (
                <th
                  key={col}
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((row, idx) => (
              <tr key={idx} className="hover:bg-gray-50">
                {columns.map((col) => (
                  <td key={`${idx}-${col}`} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {row[col]}
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
