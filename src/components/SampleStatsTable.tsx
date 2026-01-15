'use client';

import { useState, useEffect } from 'react';
import api from '@/utils/api';
import { Dataset } from '@/types';

interface SampleStatsTableProps {
  dataset: Dataset;
}

interface LibrarySizeResult {
  sample: string;
  reads: number;
  genes_detected: number;
}

export default function SampleStatsTable({ dataset }: SampleStatsTableProps) {
  const [data, setData] = useState<LibrarySizeResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const resp = await api.get(`/datasets/${dataset.id}/library_size`);
        console.log('[SampleStatsTable] API Response:', resp.data);
        console.log('[SampleStatsTable] First sample:', resp.data[0]);
        setData(resp.data);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch library size:', err);
        setError('Failed to load sample statistics.');
      } finally {
        setLoading(false);
      }
    };

    if (dataset.status === 'READY') {
      fetchData();
    }
  }, [dataset.id, dataset.status]);

  if (loading) return <div className="p-4 text-gray-500">Loading statistics...</div>;
  if (error) return <div className="p-4 text-red-500">{error}</div>;
  if (!data.length) return <div className="p-4 text-gray-500">No data available.</div>;

  return (
    <div className="bg-white shadow sm:rounded-lg overflow-hidden">
      <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
        <h3 className="text-lg leading-6 font-medium text-gray-900">Sample Statistics</h3>
        <p className="mt-1 max-w-2xl text-sm text-gray-500">
            Read counts for {data.length} samples.
        </p>
      </div>
      <div className="overflow-x-auto max-h-[500px]">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Sample ID
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Total Reads
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Genes Detected
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((row, idx) => (
              <tr key={idx} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {row.sample}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {row.reads.toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-medium">
                  {row.genes_detected?.toLocaleString() || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
