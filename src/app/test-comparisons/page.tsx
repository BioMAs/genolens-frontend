'use client';

import { useState } from 'react';
import api from '@/utils/api';

export default function TestComparisonsPage() {
  const [datasetId, setDatasetId] = useState('64d46ac5-42d2-4d4f-b705-0dd81e95cbc0');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchComparisons = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log(`Fetching comparisons for dataset: ${datasetId}`);
      const response = await api.get(`/datasets/${datasetId}/comparisons`);
      console.log('Response:', response.data);
      setResult(response.data);
    } catch (err: any) {
      console.error('Error:', err);
      console.error('Error response:', err.response?.data);
      console.error('Error status:', err.response?.status);
      setError(err.response?.data?.detail || JSON.stringify(err.response?.data) || 'Failed to fetch comparisons');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Test Comparisons Endpoint</h1>

        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Dataset ID
            </label>
            <input
              type="text"
              value={datasetId}
              onChange={(e) => setDatasetId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <button
            onClick={fetchComparisons}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
          >
            {loading ? 'Loading...' : 'Fetch Comparisons'}
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {result && (
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Result</h2>
            <div className="mb-4">
              <p><strong>Dataset:</strong> {result.dataset_name}</p>
              <p><strong>Dataset ID:</strong> {result.dataset_id}</p>
            </div>
            <div className="mb-4">
              <h3 className="font-semibold mb-2">Comparisons ({result.comparisons?.length || 0}):</h3>
              <ul className="list-disc list-inside space-y-1">
                {result.comparisons?.map((comp: string) => (
                  <li key={comp} className="text-sm">{comp}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Raw JSON:</h3>
              <pre className="bg-gray-100 p-4 rounded text-xs overflow-auto max-h-96">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
