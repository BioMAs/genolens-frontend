'use client';

import { useEffect, useState } from 'react';
import api from '@/utils/api';
import { Database, Trash2, Loader2, AlertCircle, Edit2, Users, X, Plus } from 'lucide-react';

interface Project {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  owner_email: string | null;
  owner_full_name: string | null;
  created_at: string;
  updated_at: string;
}

interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  access_level: string;
  created_at: string;
  updated_at: string;
  user_email: string | null;
  user_full_name: string | null;
}

interface UserOption {
  id: string;
  email: string | null;
  full_name: string | null;
}

interface ApiError {
  response?: {
    data?: {
      detail?: string;
    };
  };
}

function getApiErrorMessage(error: unknown, fallback: string): string {
  return (error as ApiError).response?.data?.detail ?? fallback;
}

export default function ProjectManagement() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Edit Modal
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    owner_id: ''
  });

  // Members Modal
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [projectMembers, setProjectMembers] = useState<ProjectMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [allUsers, setAllUsers] = useState<UserOption[]>([]);
  const [addingMember, setAddingMember] = useState(false);
  const [newMember, setNewMember] = useState({
    user_id: '',
    access_level: 'VIEWER'
  });

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/projects');
      setProjects(response.data);
      setError(null);
    } catch (err: unknown) {
      console.error('Failed to fetch projects:', err);
      setError('Failed to load projects.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await api.get('/admin/users');
      setAllUsers(response.data);
    } catch (err) {
      console.error('Failed to fetch users', err);
    }
  };

  const handleEdit = async (project: Project) => {
    setEditingProject(project);
    setEditForm({
      name: project.name,
      description: project.description || '',
      owner_id: project.owner_id
    });
    setShowEditModal(true);
    if (allUsers.length === 0) {
      await fetchUsers();
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProject) return;

    try {
      setUpdating(true);
      await api.patch(`/admin/projects/${editingProject.id}`, editForm);
      await fetchProjects();
      setShowEditModal(false);
      setEditingProject(null);
    } catch (err: unknown) {
      console.error('Failed to update project:', err);
      alert(getApiErrorMessage(err, 'Failed to update project.'));
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async (projectId: string, projectName: string) => {
    if (!confirm(`Are you sure you want to delete the project "${projectName}"? This action cannot be undone and will delete all associated datasets.`)) {
      return;
    }

    try {
      setDeleting(projectId);
      await api.delete(`/admin/projects/${projectId}`);
      await fetchProjects();
    } catch (err: unknown) {
      console.error('Failed to delete project:', err);
      alert(getApiErrorMessage(err, 'Failed to delete project.'));
    } finally {
      setDeleting(null);
    }
  };

  const handleManageMembers = async (project: Project) => {
    setSelectedProject(project);
    setShowMembersModal(true);
    setLoadingMembers(true);

    try {
      // Fetch all users for the dropdown
      const usersResponse = await api.get('/admin/users');
      setAllUsers(usersResponse.data);

      // Fetch project members
      const membersResponse = await api.get(`/admin/projects/${project.id}/members`);
      setProjectMembers(membersResponse.data);
    } catch (err: unknown) {
      console.error('Failed to fetch members:', err);
      alert(getApiErrorMessage(err, 'Failed to load members.'));
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !newMember.user_id) return;

    try {
      setAddingMember(true);
      await api.post(`/admin/projects/${selectedProject.id}/members`, newMember);

      // Refresh members list
      const membersResponse = await api.get(`/admin/projects/${selectedProject.id}/members`);
      setProjectMembers(membersResponse.data);

      // Reset form
      setNewMember({ user_id: '', access_level: 'VIEWER' });
    } catch (err: unknown) {
      console.error('Failed to add member:', err);
      alert(getApiErrorMessage(err, 'Failed to add member.'));
    } finally {
      setAddingMember(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!selectedProject) return;

    try {
      await api.delete(`/admin/projects/${selectedProject.id}/members/${userId}`);

      // Refresh members list
      const membersResponse = await api.get(`/admin/projects/${selectedProject.id}/members`);
      setProjectMembers(membersResponse.data);
    } catch (err: unknown) {
      console.error('Failed to remove member:', err);
      alert(getApiErrorMessage(err, 'Failed to remove member.'));
    }
  };

  if (loading) {
    return (
      <div className="bg-surface shadow rounded-card p-12 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-primary mx-auto mb-4" />
        <p className="text-secondary">Loading projects...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-control p-4">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-600" />
          <p className="text-red-800">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface shadow rounded-control overflow-hidden">
      <div className="px-6 py-4 border-b border-line">
        <div className="flex items-center gap-3">
          <Database className="h-6 w-6 text-brand-primary" />
          <h2 className="text-heading text-primary">Project Management</h2>
        </div>
        <p className="mt-1 text-body-sm text-secondary">
          View and manage all projects in the system. Total projects: {projects.length}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-line">
          <thead className="bg-surface-2">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-caption font-medium text-secondary uppercase tracking-wider">
                Project Name
              </th>
              <th scope="col" className="px-6 py-3 text-left text-caption font-medium text-secondary uppercase tracking-wider">
                Description
              </th>
              <th scope="col" className="px-6 py-3 text-left text-caption font-medium text-secondary uppercase tracking-wider">
                Owner
              </th>
              <th scope="col" className="px-6 py-3 text-left text-caption font-medium text-secondary uppercase tracking-wider">
                Created
              </th>
              <th scope="col" className="px-6 py-3 text-left text-caption font-medium text-secondary uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-surface divide-y divide-line">
            {projects.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-secondary">
                  No projects found
                </td>
              </tr>
            ) : (
              projects.map((project) => (
                <tr key={project.id} className="hover:bg-hover">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-body-sm font-medium text-primary">{project.name}</div>
                    <div className="text-caption text-secondary">{project.id}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-body-sm text-secondary max-w-md truncate">
                      {project.description || '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-body-sm text-primary">
                      {project.owner_email || project.owner_full_name || '-'}
                    </div>
                    <div className="text-caption text-secondary truncate max-w-50" title={project.owner_id}>
                      ID: {project.owner_id.substring(0, 8)}...
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-body-sm text-secondary">
                    {new Date(project.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-body-sm font-medium">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleEdit(project)}
                        className="text-brand-primary hover:text-brand-primary/80"
                        title="Edit Project"
                      >
                        <Edit2 className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleManageMembers(project)}
                        className="text-blue-600 hover:text-blue-900"
                        title="Manage Members"
                      >
                        <Users className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(project.id, project.name)}
                        disabled={deleting === project.id}
                        className="text-red-600 hover:text-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Delete Project"
                      >
                        {deleting === project.id ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <Trash2 className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Edit Project Modal */}
      {showEditModal && editingProject && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-control shadow-xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-line flex items-center justify-between">
              <h3 className="text-title text-primary">Edit Project</h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-muted hover:text-secondary"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleUpdate} className="p-6 space-y-4">
              <div>
                <label className="block text-body-sm font-medium text-primary mb-1">Project Name *</label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-strong rounded-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
                  placeholder="My Project"
                />
              </div>
              <div>
                <label className="block text-body-sm font-medium text-primary mb-1">Description</label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-strong rounded-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
                  placeholder="Project description..."
                  rows={3}
                />
              </div>
              
              <div>
                <label className="block text-body-sm font-medium text-primary mb-1">Owner</label>
                <select
                  value={editForm.owner_id}
                  onChange={(e) => setEditForm({ ...editForm, owner_id: e.target.value })}
                  className="w-full px-3 py-2 border border-strong rounded-sm focus:outline-none focus:ring-2 focus:ring-brand-primary bg-surface"
                >
                  <option value="" disabled>Select project owner</option>
                  {allUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                       {user.full_name || user.email} ({user.email})
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-caption text-red-500">
                  ⚠ Warning: Changing ownership will remove the current owner&apos;s access unless they are a member.
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 px-4 py-2 border border-strong rounded-sm text-primary hover:bg-hover"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="flex-1 px-4 py-2 bg-brand-primary text-on-accent rounded-sm hover:bg-brand-primary/90 disabled:opacity-50"
                >
                  {updating ? 'Updating...' : 'Update Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manage Members Modal */}
      {showMembersModal && selectedProject && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-control shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-line flex items-center justify-between">
              <div>
                <h3 className="text-title text-primary">Manage Project Members</h3>
                <p className="text-body-sm text-secondary mt-1">{selectedProject.name}</p>
              </div>
              <button
                onClick={() => setShowMembersModal(false)}
                className="text-muted hover:text-secondary"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {/* Add Member Form */}
              <div className="mb-6 p-4 bg-surface-2 rounded-card">
                <h4 className="text-body-sm font-semibold text-primary mb-3">Add Member</h4>
                <form onSubmit={handleAddMember} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-caption font-medium text-primary mb-1">User</label>
                      <select
                        value={newMember.user_id}
                        onChange={(e) => setNewMember({ ...newMember, user_id: e.target.value })}
                        className="w-full px-3 py-2 border border-strong rounded-sm focus:outline-none focus:ring-2 focus:ring-brand-primary text-body-sm"
                        required
                      >
                        <option value="">Select user...</option>
                        {allUsers
                          .filter(u => !projectMembers.some(m => m.user_id === u.id))
                          .map((user) => (
                            <option key={user.id} value={user.id}>
                              {user.full_name || user.email || user.id}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-caption font-medium text-primary mb-1">Access Level</label>
                      <select
                        value={newMember.access_level}
                        onChange={(e) => setNewMember({ ...newMember, access_level: e.target.value })}
                        className="w-full px-3 py-2 border border-strong rounded-sm focus:outline-none focus:ring-2 focus:ring-brand-primary text-body-sm"
                      >
                        <option value="VIEWER">Viewer</option>
                        <option value="ANALYST">Analyst</option>
                        <option value="ADMIN">Admin</option>
                      </select>
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={addingMember || !newMember.user_id}
                    className="w-full px-4 py-2 bg-brand-primary text-on-accent rounded-sm hover:bg-brand-primary/90 disabled:opacity-50 text-body-sm flex items-center justify-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    {addingMember ? 'Adding...' : 'Add Member'}
                  </button>
                </form>
              </div>

              {/* Members List */}
              <div>
                <h4 className="text-body-sm font-semibold text-primary mb-3">Current Members ({projectMembers.length})</h4>
                {loadingMembers ? (
                  <div className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-brand-primary mx-auto" />
                  </div>
                ) : projectMembers.length === 0 ? (
                  <p className="text-center text-secondary py-8 text-body-sm">No members yet. Add the first member above.</p>
                ) : (
                  <div className="space-y-2">
                    {projectMembers.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between p-3 bg-surface border border-line rounded-sm hover:bg-hover"
                      >
                        <div className="flex-1">
                          <div className="text-body-sm font-medium text-primary">
                            {member.user_full_name || member.user_email || 'Unknown User'}
                          </div>
                          <div className="text-caption text-secondary">{member.user_email}</div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="px-2 py-1 text-caption font-medium bg-blue-100 text-blue-800 rounded-sm">
                            {member.access_level}
                          </span>
                          <button
                            onClick={() => handleRemoveMember(member.user_id)}
                            className="text-red-600 hover:text-red-900"
                            title="Remove member"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-line bg-surface-2">
              <button
                onClick={() => setShowMembersModal(false)}
                className="w-full px-4 py-2 bg-gray-200 text-primary rounded-sm hover:bg-gray-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
