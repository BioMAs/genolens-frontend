'use client';

import { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import api from '@/utils/api';
import { Dataset } from '@/types';

interface LibrarySizePlotProps {
  dataset: Dataset;
}

interface LibrarySizeResult {
  sample: string;
  reads: number;
}

export default function LibrarySizePlot({ dataset }: LibrarySizePlotProps) {
  const [data, setData] = useState<LibrarySizeResult[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const resp = await api.get(`/datasets/${dataset.id}/library_size`);
        setData(resp.data);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch library size:', err);
        setError('Failed to calculate library size.');
      } finally {
        setLoading(false);
      }
    };

    if (dataset.status === 'READY') {
      fetchData();
    }
  }, [dataset.id, dataset.status]);

  if (loading) return <div className="h-64 flex items-center justify-center text-gray-500">Calculating Library Size...</div>;
  if (error) return <div className="h-64 flex items-center justify-center text-red-500 text-sm p-4 text-center">{error}</div>;
  if (!data) return null;

  return (
    <div className="bg-white p-4 rounded-lg shadow h-full flex flex-col">
      <h3 className="text-lg font-medium mb-4">Library Size (Total Reads)</h3>
      <div className="flex-grow min-h-[400px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="sample" />
            <YAxis tickFormatter={(value) => `${(value / 1e6).toFixed(1)}M`} />
            <Tooltip formatter={(value: any) => [`${Number(value).toLocaleString()} reads`, 'Library Size']} />
            <Legend />
            <Bar dataKey="reads" fill="#00BFA5" name="Reads" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
