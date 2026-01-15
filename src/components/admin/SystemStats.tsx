'use client';

import { useEffect, useState } from 'react';
import api from '@/utils/api';
import { Users, Database, Activity, TrendingUp } from 'lucide-react';

interface Stats {
  total_users: number;
  total_projects: number;
  total_datasets: number;
  active_users: number;
  users_by_plan: { [key: string]: number };
  estimated_revenue: number;
}

export default function SystemStats() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await api.get('/admin/stats');
        setStats(response.data);
        setError(null);
      } catch (err: any) {
        console.error('Failed to fetch stats:', err);
        setError('Failed to load statistics.');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();

    // Refresh every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white overflow-hidden shadow rounded-lg animate-pulse">
            <div className="p-5">
              <div className="h-8 bg-gray-200 rounded w-1/2 mb-4"></div>
              <div className="h-10 bg-gray-200 rounded w-3/4"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">{error || 'Failed to load statistics'}</p>
      </div>
    );
  }

  const statCards = [
    {
      name: 'Total Users',
      value: stats.total_users,
      icon: Users,
      color: 'bg-blue-500',
    },
    {
      name: 'Active Users',
      value: stats.active_users,
      icon: TrendingUp,
      color: 'bg-green-500',
    },
    {
      name: 'Total Projects',
      value: stats.total_projects,
      icon: Database,
      color: 'bg-purple-500',
    },
    {
      name: 'Total Datasets',
      value: stats.total_datasets,
      icon: Activity,
      color: 'bg-orange-500',
    },
    {
      name: 'Est. Revenue',
      value: stats.estimated_revenue,
      isMoney: true,
      icon: TrendingUp,
      color: 'bg-emerald-600',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <div key={stat.name} className="bg-white overflow-hidden shadow rounded-lg hover:shadow-lg transition-shadow">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className={`${stat.color} rounded-md p-3`}>
                    <stat.icon className="h-6 w-6 text-white" aria-hidden="true" />
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">{stat.name}</dt>
                    <dd className="flex items-baseline">
                      <div className="text-2xl font-semibold text-gray-900">
                        {/* @ts-ignore */}
                        {stat.isMoney ? `$${stat.value.toLocaleString()}` : stat.value.toLocaleString()}
                      </div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">User Distribution by Plan</h3>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          {Object.entries(stats.users_by_plan).map(([plan, count]) => (
            <div key={plan} className="bg-gray-50 overflow-hidden rounded-lg p-4 border border-gray-200">
               <dt className="text-sm font-medium text-gray-500 truncate">{plan}</dt>
               <dd className="mt-1 text-2xl font-semibold text-gray-900">{count}</dd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
