'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Key, Plus, Copy, CheckCheck, Ban, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import api from '@/utils/api';

interface LicenseRecord {
  id: string;
  client_id: string;
  plan: string;
  product: string;
  expires_at: number;
  license_key: string;
  notes: string | null;
  is_revoked: boolean;
  is_expired: boolean;
  days_until_expiry: number | null;
  created_at: string;
  created_by: string | null;
}

interface ApiErrorShape {
  response?: {
    data?: {
      detail?: string;
    };
  };
}

function StatusBadge({ record }: { record: LicenseRecord }) {
  if (record.is_revoked) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
        <Ban className="h-3 w-3" /> Revoked
      </span>
    );
  }
  if (record.is_expired) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
        <AlertTriangle className="h-3 w-3" /> Expired
      </span>
    );
  }
  if (record.days_until_expiry !== null && record.days_until_expiry <= 30) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
        <Clock className="h-3 w-3" /> {record.days_until_expiry}d left
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
      <CheckCircle className="h-3 w-3" /> Active
    </span>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={copy}
      title="Copy key"
      className="p-1 rounded hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-700"
    >
      {copied ? <CheckCheck className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
    </button>
  );
}

const PLANS = ['starter', 'professional', 'enterprise'];

export default function LicenseManagement() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    client_id: '',
    plan: 'professional',
    expires_at_date: '',
    notes: '',
  });
  const [formError, setFormError] = useState<string | null>(null);

  const { data: licenses = [], isLoading, error } = useQuery<LicenseRecord[]>({
    queryKey: ['admin-licenses'],
    queryFn: () => api.get('/admin/licenses').then((r) => r.data),
  });

  const issueMutation = useMutation({
    mutationFn: (payload: { client_id: string; plan: string; expires_at: number; notes?: string }) =>
      api.post('/admin/licenses', payload).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-licenses'] });
      setShowModal(false);
      setForm({ client_id: '', plan: 'professional', expires_at_date: '', notes: '' });
      setFormError(null);
    },
    onError: (err: ApiErrorShape) => {
      setFormError(err.response?.data?.detail || 'Failed to generate the license key.');
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/admin/licenses/${id}/revoke`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-licenses'] }),
  });

  const handleIssue = () => {
    if (!form.client_id.trim()) {
      setFormError('The Client ID field is required.');
      return;
    }
    if (!form.expires_at_date) {
      setFormError('The expiration date is required.');
      return;
    }
    const expires_at = Math.floor(new Date(form.expires_at_date).getTime() / 1000);
    if (expires_at <= Date.now() / 1000) {
      setFormError('The expiration date must be in the future.');
      return;
    }
    setFormError(null);
    issueMutation.mutate({
      client_id: form.client_id.trim(),
      plan: form.plan,
      expires_at,
      notes: form.notes.trim() || undefined,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">On-Premise Licenses</h2>
          <p className="text-sm text-gray-500 mt-1">
            Generate and manage license keys for GenoLens on-premise deployments.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand-primary text-white text-sm font-medium rounded-lg hover:bg-brand-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New license
        </button>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading…</div>
      ) : error ? (
        <div className="text-center py-12 text-red-500">Failed to load licenses.</div>
      ) : licenses.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Key className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>No licenses issued yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Client', 'Plan', 'Expiration', 'Status', 'Key', 'Notes', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {licenses.map((lic) => (
                <tr key={lic.id} className={lic.is_revoked ? 'opacity-50' : ''}>
                  <td className="px-4 py-3 font-medium text-gray-900 max-w-[160px] truncate" title={lic.client_id}>
                    {lic.client_id}
                  </td>
                  <td className="px-4 py-3 text-gray-600 capitalize">{lic.plan}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                    {new Date(lic.expires_at * 1000).toLocaleDateString('en-US')}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge record={lic} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <code className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded max-w-[180px] truncate block" title={lic.license_key}>
                        {lic.license_key.slice(0, 24)}…
                      </code>
                      <CopyButton value={lic.license_key} />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 max-w-[160px] truncate" title={lic.notes ?? ''}>
                    {lic.notes || '—'}
                  </td>
                  <td className="px-4 py-3">
                    {!lic.is_revoked && !lic.is_expired && (
                      <button
                        onClick={() => {
                          if (confirm(`Revoke the license for "${lic.client_id}"?`)) {
                            revokeMutation.mutate(lic.id);
                          }
                        }}
                        className="text-xs text-red-500 hover:text-red-700 hover:underline"
                      >
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Issue modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Generate a new license</h3>
              <p className="text-sm text-gray-500 mt-1">
                The generated key must be set in the <code className="bg-gray-100 px-1 rounded">GENOLENS_LICENSE_KEY</code> variable of the client deployment.
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Client ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. acme-biotech or contact@acme.com"
                  value={form.client_id}
                  onChange={(e) => setForm((f) => ({ ...f, client_id: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Plan</label>
                <select
                  value={form.plan}
                  onChange={(e) => setForm((f) => ({ ...f, plan: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
                >
                  {PLANS.map((p) => (
                    <option key={p} value={p} className="capitalize">{p}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Expiration date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={form.expires_at_date}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setForm((f) => ({ ...f, expires_at_date: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                <textarea
                  rows={2}
                  placeholder="Contract #, contact, remarks…"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary resize-none"
                />
              </div>

              {formError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {formError}
                </p>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowModal(false);
                  setFormError(null);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleIssue}
                disabled={issueMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-brand-primary rounded-lg hover:bg-brand-primary/90 disabled:opacity-50 transition-colors"
              >
                {issueMutation.isPending ? 'Generating…' : 'Generate key'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
