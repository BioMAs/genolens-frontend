'use client';

import { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Users, Activity, Calendar } from 'lucide-react';
import { useLoginStats } from '@/hooks/useLoginStats';

const PERIOD_OPTIONS = [
  { label: '7 jours', value: 7 },
  { label: '30 jours', value: 30 },
  { label: '90 jours', value: 90 },
];

export default function UserConnections() {
  const [days, setDays] = useState(30);
  const { data, isLoading, isError } = useLoginStats(days);

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* KPI skeleton */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white overflow-hidden shadow rounded-lg animate-pulse">
              <div className="p-5">
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-3" />
                <div className="h-8 bg-gray-200 rounded w-1/3" />
              </div>
            </div>
          ))}
        </div>
        {/* Chart skeleton */}
        <div className="bg-white shadow rounded-lg p-6 animate-pulse">
          <div className="h-48 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">Impossible de charger les statistiques de connexion.</p>
      </div>
    );
  }

  const kpis = [
    {
      label: "Actifs aujourd'hui",
      value: data.active_today,
      icon: Activity,
      color: 'bg-green-500',
    },
    {
      label: 'Actifs 7 derniers jours',
      value: data.active_7_days,
      icon: Calendar,
      color: 'bg-blue-500',
    },
    {
      label: 'Actifs 30 derniers jours',
      value: data.active_30_days,
      icon: Users,
      color: 'bg-indigo-500',
    },
  ];

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className={`shrink-0 ${kpi.color} rounded-md p-3`}>
                  <kpi.icon className="h-6 w-6 text-white" />
                </div>
                <div className="ml-5">
                  <p className="text-sm font-medium text-gray-500 truncate">{kpi.label}</p>
                  <p className="mt-1 text-3xl font-semibold text-gray-900">{kpi.value}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-gray-900">Connexions par jour</h2>
          <div className="flex gap-2">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setDays(opt.value)}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  days === opt.value
                    ? 'bg-brand-primary text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data.daily_counts} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11 }}
              tickFormatter={(v: string) => {
                const d = new Date(v);
                return `${d.getDate()}/${d.getMonth() + 1}`;
              }}
              interval="preserveStartEnd"
            />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip
                formatter={(value: number | undefined) => [value ?? 0, 'Connexions']}
              labelFormatter={(label: string) =>
                new Date(label).toLocaleDateString('fr-FR', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                })
              }
            />
            <Line
              type="monotone"
              dataKey="count"
              stroke="var(--brand-primary, #6366f1)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Recent connections table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Connexions récentes</h2>
          <p className="text-sm text-gray-500 mt-0.5">50 dernières entrées</p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Utilisateur
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date &amp; heure
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data.recent_events.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-sm text-gray-500">
                    Aucune connexion enregistrée pour le moment.
                  </td>
                </tr>
              ) : (
                data.recent_events.map((event, idx) => (
                  <tr key={`${event.user_id}-${event.created_at}-${idx}`} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {event.full_name ?? (
                        <span className="text-gray-400 italic">Inconnu</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {event.email ?? (
                        <span className="text-gray-400 font-mono text-xs">
                          {event.user_id.slice(0, 8)}…
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(event.created_at).toLocaleString('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
