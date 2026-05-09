'use client';

import { useEffect, useState } from 'react';
import api from '@/utils/api';
import { Key, AlertTriangle, CheckCircle, XCircle, RefreshCw, Clock, Plus, X } from 'lucide-react';

interface LicenseRecord {
  id: number;
  client_id: string;
  plan: string;
  product: string;
  expires_at: number;
  license_key: string;
  notes: string | null;
  created_at: number;
  is_expired: boolean;
  days_until_expiry: number | null;
}

interface IssueForm {
  client_id: string;
  plan: string;
  expires_at: string; // date string YYYY-MM-DD
  product: string;
  notes: string;
}

const PLANS = ['BASIC', 'PREMIUM', 'ADVANCED', 'ENTERPRISE'];

function formatDate(unix: number): string {
  return new Date(unix * 1000).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function StatusBadge({ record }: { record: LicenseRecord }) {
  if (record.is_expired) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
        <XCircle className="h-3 w-3" /> Expired
      </span>
    );
  }
  if (record.days_until_expiry !== null && record.days_until_expiry <= 30) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
        <AlertTriangle className="h-3 w-3" /> Expires in {record.days_until_expiry}d
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
      <CheckCircle className="h-3 w-3" /> Active
    </span>
  );
}

export default function LicenseManagement() {
  const [licenses, setLicenses] = useState<LicenseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showIssueForm, setShowIssueForm] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [issueError, setIssueError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // Default expiry: 1 year from today
  const defaultExpiry = new Date(Date.now() + 365 * 86400 * 1000)
    .toISOString()
    .slice(0, 10);

  const [form, setForm] = useState<IssueForm>({
    client_id: '',
    plan: 'BASIC',
    expires_at: defaultExpiry,
    product: 'genolens',
    notes: '',
  });

  const fetchLicenses = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/admin/licenses');
      setLicenses(response.data);
    } catch (err: any) {
      setError(err.response?.data?.detail ?? 'Failed to load licenses.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLicenses();
  }, []);

  const handleIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    setIssuing(true);
    setIssueError(null);
    try {
      const expiresUnix = Math.floor(new Date(form.expires_at).getTime() / 1000);
      await api.post('/admin/licenses/issue', {
        client_id: form.client_id.trim(),
        plan: form.plan,
        expires_at: expiresUnix,
        product: form.product.trim() || 'genolens',
        notes: form.notes.trim() || null,
      });
      setShowIssueForm(false);
      setForm({ client_id: '', plan: 'BASIC', expires_at: defaultExpiry, product: 'genolens', notes: '' });
      fetchLicenses();
    } catch (err: any) {
      setIssueError(err.response?.data?.detail ?? 'Failed to issue license.');
    } finally {
      setIssuing(false);
    }
  };

  const copyKey = (record: LicenseRecord) => {
    navigator.clipboard.writeText(record.license_key);
    setCopiedId(record.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const active = licenses.filter((l) => !l.is_expired);
  const expiringSoon = licenses.filter((l) => !l.is_expired && l.days_until_expiry !== null && l.days_until_expiry <= 30);
  const expired = licenses.filter((l) => l.is_expired);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-lg shadow p-5 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/3 mb-3" />
            <div className="h-3 bg-gray-200 rounded w-2/3" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <XCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
        <p className="text-red-700 font-medium">{error}</p>
        <p className="text-red-500 text-sm mt-1">
          Check that <code>LICENSE_SERVER_URL</code> and <code>LICENSE_ADMIN_API_KEY</code> are set on the backend.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div className="bg-white rounded-lg shadow p-5 flex items-center gap-4">
          <div className="p-3 bg-green-100 rounded-lg">
            <CheckCircle className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Active licenses</p>
            <p className="text-2xl font-bold text-gray-900">{active.length}</p>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-5 flex items-center gap-4">
          <div className="p-3 bg-amber-100 rounded-lg">
            <Clock className="h-6 w-6 text-amber-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Expiring in 30 days</p>
            <p className="text-2xl font-bold text-gray-900">{expiringSoon.length}</p>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-5 flex items-center gap-4">
          <div className="p-3 bg-red-100 rounded-lg">
            <XCircle className="h-6 w-6 text-red-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Expired</p>
            <p className="text-2xl font-bold text-gray-900">{expired.length}</p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Key className="h-5 w-5 text-brand-primary" />
          License Registry
        </h2>
        <div className="flex gap-2">
          <button
            onClick={fetchLicenses}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white hover:bg-gray-50 text-gray-700"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
          <button
            onClick={() => setShowIssueForm(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-brand-primary text-white rounded-md hover:bg-brand-primary/90"
          >
            <Plus className="h-4 w-4" /> Issue license
          </button>
        </div>
      </div>

      {/* Issue form modal */}
      {showIssueForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold text-gray-900">Issue a new license</h3>
              <button onClick={() => setShowIssueForm(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleIssue} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Client ID *</label>
                <input
                  required
                  type="text"
                  value={form.client_id}
                  onChange={(e) => setForm({ ...form, client_id: e.target.value })}
                  placeholder="e.g. acme-corp"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Plan *</label>
                <select
                  value={form.plan}
                  onChange={(e) => setForm({ ...form, plan: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
                >
                  {PLANS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Expiry date *</label>
                <input
                  required
                  type="date"
                  value={form.expires_at}
                  onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product</label>
                <input
                  type="text"
                  value={form.product}
                  onChange={(e) => setForm({ ...form, product: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <input
                  type="text"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Optional internal note"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
                />
              </div>
              {issueError && (
                <p className="text-sm text-red-600 bg-red-50 rounded p-2">{issueError}</p>
              )}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowIssueForm(false)}
                  className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-md text-sm hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={issuing}
                  className="flex-1 bg-brand-primary text-white py-2 rounded-md text-sm hover:bg-brand-primary/90 disabled:opacity-50"
                >
                  {issuing ? 'Issuing…' : 'Issue'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* License table */}
      {licenses.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-10 text-center text-gray-500">
          <Key className="h-10 w-10 mx-auto mb-3 text-gray-300" />
          <p className="font-medium">No licenses issued yet</p>
          <p className="text-sm mt-1">Click "Issue license" to create the first one.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Plan</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Issued</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expires</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Key</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {licenses.map((l) => (
                <tr key={l.id} className={l.is_expired ? 'opacity-50' : ''}>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {l.client_id}
                    {l.notes && (
                      <p className="text-xs text-gray-400 font-normal">{l.notes}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{l.plan}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{l.product}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{formatDate(l.created_at)}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{formatDate(l.expires_at)}</td>
                  <td className="px-4 py-3"><StatusBadge record={l} /></td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => copyKey(l)}
                      title="Copy license key"
                      className="font-mono text-xs text-gray-400 hover:text-brand-primary truncate max-w-[120px] block"
                    >
                      {copiedId === l.id ? '✓ Copied!' : `${l.license_key.slice(0, 18)}…`}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
