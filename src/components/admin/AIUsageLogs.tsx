'use client';

import { useEffect, useState } from 'react';
import api from '@/utils/api';
import { Bot, RefreshCw, Search, Filter } from 'lucide-react';
import { format } from 'date-fns';

interface AIUsageLog {
  id: string;
  user_id: string;
  user_email: string | null;
  dataset_id: string | null;
  comparison_name: string | null;
  action_type: string;
  model_used: string;
  tokens_used: number;
  was_free: boolean;
  created_at: string;
}

export default function AIUsageLogs() {
  const [logs, setLogs] = useState<AIUsageLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/ai-usage', {
        params: { limit: 100 }
      });
      setLogs(response.data);
      setError(null);
    } catch (err: any) {
      console.error('Failed to fetch AI logs:', err);
      setError('Failed to load usage logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter(log => 
    log.user_email?.toLowerCase().includes(filter.toLowerCase()) ||
    log.comparison_name?.toLowerCase().includes(filter.toLowerCase()) ||
    log.action_type.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-4 py-5 sm:px-6 border-b border-gray-200 flex justify-between items-center">
        <div>
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            Recent AI Activity
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            Monitor real-time AI model usage and token consumption.
          </p>
        </div>
        <button
          onClick={fetchLogs}
          className="p-2 text-gray-400 hover:text-gray-500 rounded-full hover:bg-gray-100"
          title="Refresh logs"
        >
          <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <div className="relative rounded-md shadow-sm max-w-md">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            className="block w-full rounded-md border-gray-300 pl-10 focus:border-brand-primary focus:ring-brand-primary sm:text-sm p-2"
            placeholder="Search by user or comparison..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                User
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Action
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Model / Details
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Cost Type
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Timestamp
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading && logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                  Loading logs...
                </td>
              </tr>
            ) : filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                  No logs found.
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div className="font-medium">{log.user_email || 'Unknown User'}</div>
                    <div className="text-xs text-gray-500">{log.user_id.substring(0, 8)}...</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      log.action_type === 'interpretation' 
                        ? 'bg-purple-100 text-purple-800' 
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {log.action_type === 'interpretation' ? 'Interpretation' : 'Q&A Chat'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex items-center gap-2">
                      <Bot className="h-4 w-4 text-gray-400" />
                      <span>{log.model_used}</span>
                    </div>
                    {log.comparison_name && (
                      <div className="text-xs mt-1 text-gray-400">
                        {log.comparison_name}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {log.was_free ? (
                      <span className="text-green-600 font-medium">Free Quota</span>
                    ) : (
                      <span className="text-amber-600 font-bold">Paid Token</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {format(new Date(log.created_at), 'MMM d, HH:mm:ss')}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
