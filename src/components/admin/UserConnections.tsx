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
import { CHART_AXIS, CHART_GRID, CHART_TOOLTIP_CURSOR, ChartTooltip } from '@/components/charts/rechartsDefaults';
import { CHART_VARS } from '@/utils/chartTheme';
import { cn } from '@/lib/cn';

const PERIOD_OPTIONS = [
  { label: '7 days', value: 7 },
  { label: '30 days', value: 30 },
  { label: '90 days', value: 90 },
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
            <div key={i} className="bg-surface overflow-hidden shadow rounded-control animate-pulse">
              <div className="p-5">
                <div className="h-4 bg-hover rounded-sm w-1/2 mb-3" />
                <div className="h-9 bg-hover rounded-sm w-1/3" />
              </div>
            </div>
          ))}
        </div>
        {/* Chart skeleton */}
        <div className="bg-surface shadow rounded-card p-6 animate-pulse">
          <div className="h-48 bg-hover rounded-sm" />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="bg-danger-soft border border-danger/30 rounded-control p-4">
        <p className="text-danger-ink">Failed to load connection statistics.</p>
      </div>
    );
  }

  const kpis = [
    {
      label: 'Active today',
      value: data.active_today,
      icon: Activity,
    },
    {
      label: 'Active last 7 days',
      value: data.active_7_days,
      icon: Calendar,
    },
    {
      label: 'Active last 30 days',
      value: data.active_30_days,
      icon: Users,
    },
  ];

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="bg-surface overflow-hidden shadow rounded-control">
            <div className="p-5">
              <div className="flex items-center">
                <div className="shrink-0 rounded-sm bg-surface-2 p-3">
                  <kpi.icon className="h-6 w-6 text-secondary" />
                </div>
                <div className="ml-5">
                  <p className="text-body-sm font-medium text-secondary truncate">{kpi.label}</p>
                  <p className="mt-1 text-display text-primary">{kpi.value}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-surface shadow rounded-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-title font-medium text-primary">Daily connections</h2>
          <div className="flex gap-2">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setDays(opt.value)}
                className={cn(
                  'px-3 py-1 rounded-sm text-body-sm font-medium transition-colors',
                  days === opt.value ? 'bg-accent text-on-accent' : 'bg-surface-2 text-secondary hover:bg-hover',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data.daily_counts} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid {...CHART_GRID} />
            <XAxis
              dataKey="date"
              {...CHART_AXIS}
              tickFormatter={(v: string) => {
                const d = new Date(v);
                return `${d.getDate()}/${d.getMonth() + 1}`;
              }}
              interval="preserveStartEnd"
            />
            <YAxis {...CHART_AXIS} allowDecimals={false} />
            <Tooltip content={<ChartTooltip />} cursor={CHART_TOOLTIP_CURSOR} formatter={(value: number | undefined) => [value ?? 0, 'Connections']} labelFormatter={(label: string) =>
                new Date(label).toLocaleDateString('en-US', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                })
              } />
            <Line
              type="monotone"
              dataKey="count"
              stroke={CHART_VARS.accent}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Recent connections table */}
      <div className="bg-surface shadow rounded-control overflow-hidden">
        <div className="px-6 py-4 border-b border-line">
          <h2 className="text-title font-medium text-primary">Recent connections</h2>
          <p className="text-body-sm text-secondary mt-0.5">Last 50 entries</p>
        </div>

        <div className="overflow-x-auto">
          <table className="data-table">
            <thead className="bg-surface-2">
              <tr>
                <th>
                  User
                </th>
                <th>
                  Email
                </th>
                <th>
                  Date &amp; time
                </th>
              </tr>
            </thead>
            <tbody className="bg-surface divide-y divide-line">
              {data.recent_events.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-body-sm text-secondary">
                    No connections recorded yet.
                  </td>
                </tr>
              ) : (
                data.recent_events.map((event, idx) => (
                  <tr key={`${event.user_id}-${event.created_at}-${idx}`} className="hover:bg-hover">
                    <td className="whitespace-nowrap text-body-sm font-medium">
                      {event.full_name ?? (
                        <span className="text-muted italic">Unknown</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap text-body-sm text-secondary">
                      {event.email ?? (
                        <span className="text-muted font-mono text-caption">
                          {event.user_id.slice(0, 8)}…
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap text-body-sm text-secondary">
                      {new Date(event.created_at).toLocaleString('en-US', {
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
