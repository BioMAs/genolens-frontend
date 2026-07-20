'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import api from '@/utils/api';
import { Users, Edit2, Shield, Trash2, Plus, X, Loader2, Coins, Crown, Zap, FlaskConical } from 'lucide-react';
import ModuleSelector, { ModuleId } from '@/components/modules/ModuleSelector';

interface User {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  role: string;
  status?: string;
  subscription_plan?: string;
  ai_interpretations_used?: number;
  ai_interpretations_remaining?: number;
  ai_tokens_purchased?: number;
  ai_tokens_used?: number;
  created_at: string;
  updated_at: string;
  last_sign_in_at: string | null;
  confirmed_at: string | null;
  has_cosmetics_module?: boolean;
  has_report_customization?: boolean;
}

interface ValidationDetail {
  loc?: Array<string | number>;
  msg?: string;
}

interface ApiError {
  response?: {
    status?: number;
    data?: {
      detail?: string | ValidationDetail[];
    };
  };
}

function getApiErrorDetail(error: unknown): string | ValidationDetail[] | undefined {
  return (error as ApiError).response?.data?.detail;
}

function getApiErrorMessage(error: unknown, fallback: string): string {
  const detail = getApiErrorDetail(error);
  if (typeof detail === 'string') {
    return detail;
  }
  return fallback;
}

function StatusBadge({ status }: { status?: string }) {
  const styles: Record<string, string> = {
    active:    "bg-green-100 text-green-700",
    pending:   "bg-yellow-100 text-yellow-700",
    suspended: "bg-orange-100 text-orange-700",
    cancelled: "bg-red-100 text-red-700",
  };
  const s = status ?? "active";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${styles[s] ?? "bg-gray-100 text-gray-700"}`}>
      {s}
    </span>
  );
}

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'user'
  });

  // Edit Modal
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [moduleBusy, setModuleBusy] = useState<ModuleId | null>(null);
  const [editForm, setEditForm] = useState({
    full_name: '',
    role: '',
    subscription_plan: ''
  });

  // Invite Modal
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    email: '',
    full_name: '',
    plan: 'BASIC',
    subscription_ends_at: '',
  });

  // Token Modal
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [tokenUser, setTokenUser] = useState<User | null>(null);
  const [tokenAmount, setTokenAmount] = useState(10);
  const [addingTokens, setAddingTokens] = useState(false);

  // Delete
  const [deleting, setDeleting] = useState<string | null>(null);

  // Assign demo
  const [assigningDemo, setAssigningDemo] = useState<string | null>(null);

  const roles = ['admin', 'user', 'analyst', 'viewer'];
  const plans = ['BASIC', 'PREMIUM', 'ADVANCED'];


  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/users');
      setUsers(response.data);
      setError(null);
    } catch (err: unknown) {
      console.error('Failed to fetch users:', err);
      setError('Failed to load users.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setCreating(true);
      await api.post('/admin/users', createForm);
      await fetchUsers();
      setShowCreateModal(false);
      setCreateForm({ email: '', password: '', full_name: '', role: 'user' });
    } catch (err: unknown) {
      console.error('Failed to create user:', err);
      alert(getApiErrorMessage(err, 'Failed to create user.'));
    } finally {
      setCreating(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setInviting(true);
      // Convert date-only string (YYYY-MM-DD) to full ISO datetime expected by the backend
      const endsAt = inviteForm.subscription_ends_at
        ? new Date(inviteForm.subscription_ends_at).toISOString()
        : undefined;

      await api.post('/admin/users/invite', {
        email: inviteForm.email,
        full_name: inviteForm.full_name || undefined,
        plan: inviteForm.plan,
        subscription_ends_at: endsAt,
      });
      await fetchUsers();
      setShowInviteModal(false);
      setInviteForm({ email: '', full_name: '', plan: 'BASIC', subscription_ends_at: '' });
    } catch (err: unknown) {
      const detail = getApiErrorDetail(err);
      const message = Array.isArray(detail)
        ? detail.map((e) => `${e.loc?.slice(-1)[0]}: ${e.msg}`).join('\n')
        : detail ?? 'Failed to send invitation.';
      alert(message);
    } finally {
      setInviting(false);
    }
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setEditForm({
      full_name: user.full_name || '',
      role: user.role,
      subscription_plan: user.subscription_plan || 'BASIC'
    });
    setShowEditModal(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      setUpdating(true);
      
      // Update basic info if changed
      if (editForm.full_name !== editingUser.full_name) {
        await api.patch(`/admin/users/${editingUser.id}`, {
          full_name: editForm.full_name
        });
      }
      
      // Update role if changed
      if (editForm.role !== editingUser.role) {
        await api.patch(`/admin/users/${editingUser.id}/role`, {
          role: editForm.role
        });
      }
      
      // Update subscription if changed
      if (editForm.subscription_plan !== editingUser.subscription_plan) {
        await api.patch(`/admin/users/${editingUser.id}/subscription`, {
          plan: editForm.subscription_plan
        });
      }
      
      await fetchUsers();
      setShowEditModal(false);
      setEditingUser(null);
    } catch (err: unknown) {
      console.error('Failed to update user:', err);
      // alert(err.response?.data?.detail || 'Failed to update user.');
    } finally {
      setUpdating(false);
    }
  };

  const handleToggleModule = async (userId: string, id: ModuleId, enabled: boolean) => {
    const endpoint = id === 'claim' ? 'cosmetics-module' : 'report-customization-module';
    try {
      setModuleBusy(id);
      const res = await api.patch(`/admin/users/${userId}/${endpoint}`, { enabled });
      const updated = {
        has_cosmetics_module: res.data?.has_cosmetics_module,
        has_report_customization: res.data?.has_report_customization,
      };
      setEditingUser((prev) => (prev && prev.id === userId ? { ...prev, ...updated } : prev));
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, ...updated } : u)));
    } catch (err: unknown) {
      console.error('Failed to update module:', err);
      alert(getApiErrorMessage(err, 'Failed to update module. The user must exist in the local database (update subscription first).'));
    } finally {
      setModuleBusy(null);
    }
  };

  const handleAddTokens = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenUser) return;
    
    try {
      setAddingTokens(true);
      await api.post(`/admin/users/${tokenUser.id}/tokens`, {
        tokens: tokenAmount
      });
      await fetchUsers();
      setShowTokenModal(false);
      setTokenUser(null);
    } catch (err: unknown) {
      console.error('Failed to add tokens:', err);
      alert('Failed to add tokens');
    } finally {
      setAddingTokens(false);
    }
  };

  const handleAssignDemo = async (userId: string, userName: string) => {
    if (!confirm(`Assign demo data to "${userName || userId}"?\n\nThis will create a project with 2 synthetic DEG comparisons (KO_vs_WT and Treatment_vs_Control).`)) {
      return;
    }

    try {
      setAssigningDemo(userId);
      const response = await api.post(`/admin/users/${userId}/assign-demo`, {});
      alert(`✓ ${response.data.message}`);
    } catch (err: unknown) {
      const status = (err as ApiError).response?.status;
      if (status === 409) {
        alert('This user already has a demo project. Delete it first to re-assign.');
      } else {
        alert(getApiErrorMessage(err, 'Failed to assign demo data.'));
      }
    } finally {
      setAssigningDemo(null);
    }
  };

  const handleDelete = async (userId: string, userName: string) => {
    if (!confirm(`Are you sure you want to delete the user "${userName || userId}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setDeleting(userId);
      await api.delete(`/admin/users/${userId}`);
      await fetchUsers();
    } catch (err: unknown) {
      console.error('Failed to delete user:', err);
      alert(getApiErrorMessage(err, 'Failed to delete user.'));
    } finally {
      setDeleting(null);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role.toLowerCase()) {
      case 'admin':
        return 'bg-red-100 text-red-800';
      case 'analyst':
        return 'bg-blue-100 text-blue-800';
      case 'user':
        return 'bg-green-100 text-green-800';
      case 'viewer':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="bg-white shadow rounded-lg p-12 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-primary mx-auto mb-4" />
        <p className="text-gray-600">Loading users...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">{error}</p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <Users className="h-6 w-6 text-brand-primary" />
              <h2 className="text-xl font-semibold text-gray-900">User Management</h2>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              Manage user roles and permissions. Total users: {users.length}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowInviteModal(true)}
              className="inline-flex items-center px-4 py-2 border border-brand-primary text-brand-primary rounded-md hover:bg-brand-primary/5 transition-colors gap-2"
            >
              <Plus className="h-5 w-5" />
              Invite User
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center px-4 py-2 bg-brand-primary text-white rounded-md hover:bg-brand-primary/90 transition-colors gap-2"
            >
              <Plus className="h-5 w-5" />
              Add User
            </button>
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
                  Subscription
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  AI Usage
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Sign In
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {user.avatar_url ? (
                        <Image className="h-10 w-10 rounded-full" src={user.avatar_url} alt="" width={40} height={40} />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-brand-primary flex items-center justify-center">
                          <span className="text-white font-medium text-sm">
                            {user.full_name?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase() || '?'}
                          </span>
                        </div>
                      )}
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {user.full_name || user.email || 'Unnamed User'}
                        </div>
                        <div className="text-xs text-gray-400 truncate max-w-[150px]" title={user.id}>
                          {user.id.substring(0, 8)}...
                        </div>
                        <div className="text-xs text-gray-500">{user.email || '-'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      user.subscription_plan === 'ADVANCED' ? 'bg-purple-100 text-purple-800' :
                      user.subscription_plan === 'PREMIUM' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {user.subscription_plan === 'ADVANCED' && <Crown className="h-3 w-3 mr-1" />}
                      {user.subscription_plan === 'PREMIUM' && <Zap className="h-3 w-3 mr-1" />}
                      {user.subscription_plan || 'BASIC'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex flex-col gap-1">
                      <div>Used: {user.ai_interpretations_used} ({user.ai_tokens_used} paid)</div>
                      <div className="text-xs">
                        Remaining: {user.ai_interpretations_remaining === -1 ? 'Unlimited' : user.ai_interpretations_remaining}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <StatusBadge status={user.status} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(user.role)}`}>
                      {user.role === 'admin' && <Shield className="h-3 w-3 mr-1" />}
                      {user.role.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {user.last_sign_in_at
                      ? new Date(user.last_sign_in_at).toLocaleDateString()
                      : 'Never'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center gap-2">
                      {user.status === "pending" ? (
                        <button
                          onClick={async () => {
                            try {
                              await api.post(`/admin/users/${user.id}/resend-invite`);
                              alert(`Invitation resent to ${user.email}`);
                            } catch (e) {
                              console.error("Resend invite failed", e);
                              alert("Failed to resend invitation. Please try again.");
                            }
                          }}
                          className="text-xs text-yellow-600 hover:text-yellow-800 underline"
                        >
                          Resend invite
                        </button>
                      ) : (
                        <button
                          onClick={async () => {
                            const newStatus = user.status === "active" ? "suspended" : "active";
                            try {
                              await api.patch(`/admin/users/${user.id}/status`, { status: newStatus });
                              await fetchUsers();
                            } catch (e) {
                              console.error("Status update failed", e);
                              alert(`Failed to ${newStatus === "suspended" ? "suspend" : "activate"} user. Please try again.`);
                            }
                          }}
                          className="text-xs text-gray-500 hover:text-gray-800 underline"
                        >
                          {user.status === "active" ? "Suspend" : "Activate"}
                        </button>
                      )}
                      <button
                        onClick={() => handleAssignDemo(user.id, user.full_name || user.email || '')}
                        disabled={assigningDemo === user.id}
                        className="text-emerald-600 hover:text-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Assign Demo Data"
                      >
                        {assigningDemo === user.id ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <FlaskConical className="h-5 w-5" />
                        )}
                      </button>
                       <button
                        onClick={() => {
                          setTokenUser(user);
                          setTokenAmount(10);
                          setShowTokenModal(true);
                        }}
                        className="text-yellow-600 hover:text-yellow-800"
                        title="Add AI Tokens"
                      >
                        <Coins className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleEdit(user)}
                        className="text-brand-primary hover:text-brand-primary/80"
                        title="Edit User"
                      >
                        <Edit2 className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(user.id, user.full_name || '')}
                        disabled={deleting === user.id}
                        className="text-red-600 hover:text-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Delete User"
                      >
                        {deleting === user.id ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <Trash2 className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invite User Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Invite User</h3>
                <p className="text-xs text-gray-500 mt-0.5">Creates a pending account and sends an invitation email.</p>
              </div>
              <button onClick={() => setShowInviteModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleInvite} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input
                  type="email"
                  required
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary"
                  placeholder="user@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={inviteForm.full_name}
                  onChange={(e) => setInviteForm({ ...inviteForm, full_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary"
                  placeholder="Jane Doe"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Plan</label>
                <select
                  value={inviteForm.plan}
                  onChange={(e) => setInviteForm({ ...inviteForm, plan: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary"
                >
                  {plans.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Access expires on <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="date"
                  value={inviteForm.subscription_ends_at}
                  onChange={(e) => setInviteForm({ ...inviteForm, subscription_ends_at: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviting}
                  className="flex-1 px-4 py-2 bg-brand-primary text-white rounded-md hover:bg-brand-primary/90 disabled:opacity-50"
                >
                  {inviting ? 'Sending...' : 'Send Invitation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Create New User</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input
                  type="email"
                  required
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary"
                  placeholder="user@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary"
                  placeholder="Minimum 6 characters"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={createForm.full_name}
                  onChange={(e) => setCreateForm({ ...createForm, full_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary"
                  placeholder="John Doe"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
                <select
                  value={createForm.role}
                  onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary"
                >
                  {roles.map((role) => (
                    <option key={role} value={role}>
                      {role.charAt(0).toUpperCase() + role.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 px-4 py-2 bg-brand-primary text-white rounded-md hover:bg-brand-primary/90 disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && editingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Edit User</h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleUpdate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={editForm.full_name}
                  onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary"
                  placeholder="John Doe"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary"
                >
                  {roles.map((role) => (
                    <option key={role} value={role}>
                      {role.charAt(0).toUpperCase() + role.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subscription Plan</label>
                <select
                  value={editForm.subscription_plan}
                  onChange={(e) => setEditForm({ ...editForm, subscription_plan: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary"
                >
                  {plans.map((plan) => (
                    <option key={plan} value={plan}>
                      {plan}
                    </option>
                  ))}
                </select>
              </div>

              {/* Add-on modules */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Add-on modules</label>
                <p className="mb-3 text-xs text-gray-500">Toggle to enable instantly — no need to save.</p>
                <ModuleSelector
                  value={{
                    claim: !!editingUser.has_cosmetics_module,
                    reporting: !!editingUser.has_report_customization,
                  }}
                  busy={moduleBusy}
                  onToggle={(id, enabled) => handleToggleModule(editingUser.id, id, enabled)}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="flex-1 px-4 py-2 bg-brand-primary text-white rounded-md hover:bg-brand-primary/90 disabled:opacity-50"
                >
                  {updating ? 'Updating...' : 'Update User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Token Modal */}
      {showTokenModal && tokenUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Add AI Tokens</h3>
              <button
                onClick={() => setShowTokenModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleAddTokens} className="p-6 space-y-4">
              <div className="bg-yellow-50 p-4 rounded-lg flex items-start gap-3">
                 <Coins className="h-6 w-6 text-yellow-600 mt-1" />
                 <div>
                   <p className="text-sm font-medium text-yellow-800">
                     Adding tokens to {tokenUser.full_name || tokenUser.email}
                   </p>
                   <p className="text-xs text-yellow-700 mt-1">
                     Current purchased balance: {tokenUser.ai_tokens_purchased || 0}
                   </p>
                 </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount to Add</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={tokenAmount}
                  onChange={(e) => setTokenAmount(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowTokenModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingTokens}
                  className="flex-1 px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 disabled:opacity-50"
                >
                  {addingTokens ? 'Adding...' : 'Add Tokens'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
