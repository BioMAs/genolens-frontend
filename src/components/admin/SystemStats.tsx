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

interface ApiErrorWithMessage {
  message?: string;
}

interface StatCard {
  name: string;
  value: number;
  icon: typeof Users;
  color: string;
  isMoney?: boolean;
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
      } catch (err: unknown) {
        const apiError = err as ApiErrorWithMessage;
        console.error('Failed to fetch stats:', err);
        setError(apiError.message || 'Failed to load statistics.');
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
          <div key={i} className="bg-surface overflow-hidden shadow rounded-control animate-pulse">
            <div className="p-5">
              <div className="h-8 bg-gray-200 rounded-sm w-1/2 mb-4"></div>
              <div className="h-10 bg-gray-200 rounded-sm w-3/4"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="bg-danger-soft border border-danger/30 rounded-control p-4">
        <p className="text-danger-ink">{error || 'Failed to load statistics'}</p>
      </div>
    );
  }

  const statCards: StatCard[] = [
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
          <div key={stat.name} className="bg-surface overflow-hidden shadow rounded-control hover:shadow-lg transition-shadow">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className={`${stat.color} rounded-sm p-3`}>
                    <stat.icon className="h-6 w-6 text-on-accent" aria-hidden="true" />
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-body-sm font-medium text-secondary truncate">{stat.name}</dt>
                    <dd className="flex items-baseline">
                      <div className="text-heading text-primary">
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

      <div className="bg-surface shadow rounded-card p-6">
        <h3 className="text-title font-medium leading-6 text-primary mb-4">User Distribution by Plan</h3>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          {Object.entries(stats.users_by_plan).map(([plan, count]) => (
            <div key={plan} className="bg-surface-2 overflow-hidden rounded-card p-4">
               <dt className="text-body-sm font-medium text-secondary truncate">{plan}</dt>
               <dd className="mt-1 text-heading text-primary">{count}</dd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
