'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/utils/api';
import { Users, Database, Activity, BarChart3, Shield, AlertCircle, Bot, LogIn, Key } from 'lucide-react';
import UserManagement from '@/components/admin/UserManagement';
import SystemStats from '@/components/admin/SystemStats';
import ProjectManagement from '@/components/admin/ProjectManagement';
import AIUsageLogs from '@/components/admin/AIUsageLogs';
import UserConnections from '@/components/admin/UserConnections';
import LicenseManagement from '@/components/admin/LicenseManagement';

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
      <div className="min-h-screen bg-surface-2 flex items-center justify-center">
        <div className="text-center">
          <Activity className="h-12 w-12 text-brand-primary animate-pulse mx-auto mb-4" />
          <p className="text-secondary">Verifying admin access...</p>
        </div>
      </div>
    );
  }

  if (error || !hasAccess) {
    return (
      <div className="min-h-screen bg-surface-2 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-surface shadow-lg rounded-lg p-8">
          <div className="flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mx-auto mb-4">
            <AlertCircle className="h-8 w-8 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-primary text-center mb-2">
            Access Denied
          </h2>
          <p className="text-secondary text-center mb-6">
            {error || 'You do not have permission to access this page.'}
          </p>
          <button
            onClick={() => router.push('/dashboard')}
            className="w-full bg-brand-primary text-on-accent py-2 px-4 rounded-md hover:bg-brand-primary/90 transition-colors"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-2 py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-brand-primary rounded-lg">
              <Shield className="h-6 w-6 text-on-accent" />
            </div>
            <h1 className="text-3xl font-bold text-primary">Administration</h1>
          </div>
          <p className="text-secondary">Manage users, view system statistics, and monitor platform activity.</p>
        </div>

        {/* Tabs */}
        <div className="border-b border-line mb-6">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('stats')}
              className={`${
                activeTab === 'stats'
                  ? 'border-brand-primary text-brand-primary'
                  : 'border-transparent text-secondary hover:text-primary hover:border-strong'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
            >
              <BarChart3 className="h-5 w-5" />
              Statistics
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`${
                activeTab === 'users'
                  ? 'border-brand-primary text-brand-primary'
                  : 'border-transparent text-secondary hover:text-primary hover:border-strong'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
            >
              <Users className="h-5 w-5" />
              User Management
            </button>
            <button
              onClick={() => setActiveTab('projects')}
              className={`${
                activeTab === 'projects'
                  ? 'border-brand-primary text-brand-primary'
                  : 'border-transparent text-secondary hover:text-primary hover:border-strong'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
            >
              <Database className="h-5 w-5" />
              All Projects
            </button>
            <button
              onClick={() => setActiveTab('ai')}
              className={`${
                activeTab === 'ai'
                  ? 'border-brand-primary text-brand-primary'
                  : 'border-transparent text-secondary hover:text-primary hover:border-strong'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
            >
              <Bot className="h-5 w-5" />
              AI Activity
            </button>
            <button
              onClick={() => setActiveTab('connections')}
              className={`${
                activeTab === 'connections'
                  ? 'border-brand-primary text-brand-primary'
                  : 'border-transparent text-secondary hover:text-primary hover:border-strong'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
            >
              <LogIn className="h-5 w-5" />
              Connexions
            </button>
            <button
              onClick={() => setActiveTab('licenses')}
              className={`${
                activeTab === 'licenses'
                  ? 'border-brand-primary text-brand-primary'
                  : 'border-transparent text-secondary hover:text-primary hover:border-strong'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
            >
              <Key className="h-5 w-5" />
              Licences
            </button>
          </nav>
        </div>

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
    </div>
  );
}
