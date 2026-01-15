'use client';

import { useEffect, useState } from 'react';
import api from '@/utils/api';
import { Users, Edit2, Shield, Trash2, Plus, X, Loader2, Coins, Crown, Zap } from 'lucide-react';

interface User {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  role: string;
  subscription_plan?: string;
  ai_interpretations_used?: number;
  ai_interpretations_remaining?: number;
  ai_tokens_purchased?: number;
  ai_tokens_used?: number;
  created_at: string;
  updated_at: string;
  last_sign_in_at: string | null;
  confirmed_at: string | null;
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
  const [editForm, setEditForm] = useState({
    full_name: '',
    role: '',
    subscription_plan: ''
  });

  // Token Modal
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [tokenUser, setTokenUser] = useState<User | null>(null);
  const [tokenAmount, setTokenAmount] = useState(10);
  const [addingTokens, setAddingTokens] = useState(false);

  // Delete
  const [deleting, setDeleting] = useState<string | null>(null);

  const roles = ['admin', 'user', 'analyst', 'viewer'];
  const plans = ['BASIC', 'PREMIUM', 'ADVANCED'];


  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/users');
      setUsers(response.data);
      setError(null);
    } catch (err: any) {
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
    } catch (err: any) {
      console.error('Failed to create user:', err);
      alert(err.response?.data?.detail || 'Failed to create user.');
    } finally {
      setCreating(false);
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
    } catch (err: any) {
      console.error('Failed to update user:', err);
      // alert(err.response?.data?.detail || 'Failed to update user.');
    } finally {
      setUpdating(false);
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
    } catch (err: any) {
      console.error('Failed to add tokens:', err);
      alert('Failed to add tokens');
    } finally {
      setAddingTokens(false);
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
    } catch (err: any) {
      console.error('Failed to delete user:', err);
      alert(err.response?.data?.detail || 'Failed to delete user.');
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
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center px-4 py-2 bg-brand-primary text-white rounded-md hover:bg-brand-primary/90 transition-colors gap-2"
          >
            <Plus className="h-5 w-5" />
            Add User
          </button>
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
                        <img className="h-10 w-10 rounded-full" src={user.avatar_url} alt="" />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-brand-primary flex items-center justify-center">
                          <span className="text-white font-medium text-sm">
                            {user.full_name?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase() || '?'}
                          </span>
                        </div>
                      )}
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {user.full_name || 'Unnamed User'}
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
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
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
