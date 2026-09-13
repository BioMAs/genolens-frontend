'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/utils/api';
import { Users, Database, Activity, BarChart3, AlertCircle, Bot, LogIn, Key } from 'lucide-react';
import UserManagement from '@/components/admin/UserManagement';
import SystemStats from '@/components/admin/SystemStats';
import ProjectManagement from '@/components/admin/ProjectManagement';
import AIUsageLogs from '@/components/admin/AIUsageLogs';
import UserConnections from '@/components/admin/UserConnections';
import LicenseManagement from '@/components/admin/LicenseManagement';
import { PageHeader } from '@/components/ui/page-header';
import { cn } from '@/lib/cn';

interface ApiErrorShape {
  response?: {
    status?: number;
  };
}

export default function AdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'stats' | 'users' | 'projects' | 'ai' | 'connections' | 'licenses'>('stats');
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    // Check if user has admin access by trying to fetch stats
    const checkAccess = async () => {
      try {
        await api.get('/admin/stats');
        setHasAccess(true);
        setLoading(false);
      } catch (err: unknown) {
        const apiError = err as ApiErrorShape;
        if (apiError.response?.status === 403) {
          setError('Access denied. Admin privileges required.');
        } else if (apiError.response?.status === 401) {
          router.push('/');
        } else {
          setError('Failed to verify admin access.');
        }
        setLoading(false);
      }
    };

    checkAccess();
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center">
        <div className="text-center">
          <Activity className="h-12 w-12 text-brand-primary animate-pulse mx-auto mb-4" />
          <p className="text-secondary">Verifying admin access...</p>
        </div>
      </div>
    );
  }

  if (error || !hasAccess) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-surface shadow-lg rounded-card p-8">
          <div className="flex items-center justify-center w-16 h-16 bg-red-100 rounded-pill mx-auto mb-4">
            <AlertCircle className="h-8 w-8 text-red-600" />
          </div>
          <h2 className="text-heading text-primary text-center mb-2">
            Access Denied
          </h2>
          <p className="text-secondary text-center mb-6">
            {error || 'You do not have permission to access this page.'}
          </p>
          <button
            onClick={() => router.push('/dashboard')}
            className="w-full bg-brand-primary text-on-accent py-2 px-4 rounded-sm hover:bg-brand-primary/90 transition-colors"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  /**
   * Les six onglets repetaient chacun le meme bloc de classes de cinq lignes —
   * six copies a maintenir ensemble, donc six occasions de divergence. Ils
   * signalaient de plus leur selection avec le teal de MARQUE : la regle
   * reserve un seul accent interactif.
   */
  const TABS = [
    { key: 'stats' as const, label: 'Statistics', Icon: BarChart3 },
    { key: 'users' as const, label: 'User Management', Icon: Users },
    { key: 'projects' as const, label: 'All Projects', Icon: Database },
    { key: 'ai' as const, label: 'AI Activity', Icon: Bot },
    { key: 'connections' as const, label: 'Connexions', Icon: LogIn },
    { key: 'licenses' as const, label: 'Licences', Icon: Key },
  ];

  return (
    <div className="page-container">
      <PageHeader
        eyebrow="Workspace"
        title="Administration"
        description="Manage users, view system statistics, and monitor platform activity."
        crumbs={[{ label: 'Administration' }]}
        tabs={
          <nav className="-mb-px flex gap-8 border-b border-line" aria-label="Admin sections">
            {TABS.map(({ key, label, Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key)}
                aria-current={activeTab === key ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-2 whitespace-nowrap border-b-2 px-1 py-4 text-body-sm font-medium transition-colors',
                  activeTab === key
                    ? 'border-accent text-accent-ink'
                    : 'border-transparent text-secondary hover:border-strong hover:text-primary',
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </nav>
        }
      />

      {/* Content */}
      <div className="mt-6">
        {activeTab === 'stats' && <SystemStats />}
        {activeTab === 'users' && <UserManagement />}
        {activeTab === 'projects' && <ProjectManagement />}
        {activeTab === 'ai' && <AIUsageLogs />}
        {activeTab === 'connections' && <UserConnections />}
        {activeTab === 'licenses' && <LicenseManagement />}
      </div>
    </div>
  );
}
