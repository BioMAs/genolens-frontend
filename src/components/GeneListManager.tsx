/**
 * GeneListManager: Component to create and manage custom gene lists
 */
'use client';

import { useState } from 'react';
import { List, Plus, Trash2, Edit2, X, Save, Users, Lock } from 'lucide-react';
import {
  useGeneLists,
  useCreateGeneList,
  useUpdateGeneList,
  useDeleteGeneList,
} from '@/hooks/useBookmarks';
import { GeneList } from '@/types/bookmark';
import ExportMenu from '@/components/ExportMenu';

interface GeneListManagerProps {
  projectId: string;
  onClose?: () => void;
}

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308',
  '#84cc16', '#22c55e', '#10b981', '#14b8a6',
  '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
  '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
];

export default function GeneListManager({ projectId, onClose }: GeneListManagerProps) {
  const { data: geneLists, isLoading } = useGeneLists(projectId, true);
  const createList = useCreateGeneList();
  const updateList = useUpdateGeneList();
  const deleteList = useDeleteGeneList();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Create form state
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newGenes, setNewGenes] = useState('');
  const [newColor, setNewColor] = useState<string>();
  const [newIsPublic, setNewIsPublic] = useState(false);

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editColor, setEditColor] = useState<string | undefined>();
  const [editIsPublic, setEditIsPublic] = useState(false);

  const resetCreateForm = () => {
    setNewName('');
    setNewDescription('');
    setNewGenes('');
    setNewColor(undefined);
    setNewIsPublic(false);
    setShowCreateForm(false);
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;

    const genes = newGenes
      .split(/[\n,;]/)
      .map((g) => g.trim())
      .filter((g) => g.length > 0);

    try {
      await createList.mutateAsync({
        projectId,
        data: {
          name: newName,
          description: newDescription || undefined,
          genes,
          color: newColor,
          is_public: newIsPublic,
        },
      });
      resetCreateForm();
    } catch (error) {
      console.error('Failed to create gene list:', error);
    }
  };

  const startEdit = (list: GeneList) => {
    setEditingId(list.id);
    setEditName(list.name);
    setEditDescription(list.description || '');
    setEditColor(list.color);
    setEditIsPublic(list.is_public);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditDescription('');
    setEditColor(undefined);
    setEditIsPublic(false);
  };

  const saveEdit = async (listId: string) => {
    try {
      await updateList.mutateAsync({
        listId,
        data: {
          name: editName,
          description: editDescription || undefined,
          color: editColor,
          is_public: editIsPublic,
        },
      });
      cancelEdit();
    } catch (error) {
      console.error('Failed to update gene list:', error);
    }
  };

  const handleDelete = async (listId: string, listName: string) => {
    if (confirm(`Delete list "${listName}"?`)) {
      try {
        await deleteList.mutateAsync(listId);
      } catch (error) {
        console.error('Failed to delete gene list:', error);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="h-8 w-8 animate-spin rounded-pill border-4 border-line border-t-indigo-600" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-line px-6 py-4">
        <div>
          <h2 className="text-title text-primary">Gene Lists</h2>
          <p className="mt-1 text-body-sm text-secondary">
            {geneLists?.length || 0} custom lists
          </p>
        </div>
        <div className="flex items-center gap-2">
          {geneLists && geneLists.length > 0 && (
            <ExportMenu
              data={geneLists.map(list => ({
                name: list.name,
                description: list.description || '',
                genes: list.genes?.join('; ') || '',
                gene_count: list.genes?.length || 0,
                color: list.color || '',
                is_public: list.is_public ? 'Yes' : 'No',
                created_at: new Date(list.created_at).toLocaleString()
              }))}
              filename={`gene_lists_project_${projectId}`}
              formats={['csv', 'json']}
              csvColumns={[
                { key: 'name', label: 'List Name' },
                { key: 'description', label: 'Description' },
                { key: 'gene_count', label: 'Gene Count' },
                { key: 'genes', label: 'Genes (semicolon separated)' },
                { key: 'color', label: 'Color' },
                { key: 'is_public', label: 'Public' },
                { key: 'created_at', label: 'Created At' }
              ]}
              variant="outline"
              size="sm"
            />
          )}
          <button
            onClick={() => setShowCreateForm(true)}
            className="inline-flex items-center gap-2 rounded-sm bg-accent px-4 py-2 text-body-sm font-medium text-on-accent hover:bg-accent-hover"
          >
            <Plus className="h-4 w-4" />
            New List
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="rounded-pill p-1 text-muted hover:bg-hover hover:text-secondary"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Create form */}
        {showCreateForm && (
          <div className="mb-6 rounded-control border-2 border-accent-ring bg-accent-soft p-4">
            <h3 className="mb-3 text-title font-medium text-primary">Create New Gene List</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-body-sm font-medium text-primary">Name *</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g., Cancer markers"
                  className="mt-1 w-full rounded-sm border border-strong px-3 py-2 text-body-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>

              <div>
                <label className="block text-body-sm font-medium text-primary">Description</label>
                <input
                  type="text"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Optional description"
                  className="mt-1 w-full rounded-sm border border-strong px-3 py-2 text-body-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>

              <div>
                <label className="block text-body-sm font-medium text-primary">
                  Genes (one per line, or comma/semicolon separated)
                </label>
                <textarea
                  value={newGenes}
                  onChange={(e) => setNewGenes(e.target.value)}
                  placeholder="TP53&#10;BRCA1&#10;MYC"
                  className="mt-1 w-full rounded-sm border border-strong px-3 py-2 font-mono text-body-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                  rows={5}
                />
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <label className="text-body-sm font-medium text-primary">Color</label>
                  <div className="flex gap-1">
                    {PRESET_COLORS.slice(0, 8).map((color) => (
                      <button
                        key={color}
                        onClick={() => setNewColor(color)}
                        className={`h-6 w-6 rounded-sm border-2 ${
                          newColor === color ? 'border-strong' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>

                <label className="flex items-center gap-2 text-body-sm">
                  <input
                    type="checkbox"
                    checked={newIsPublic}
                    onChange={(e) => setNewIsPublic(e.target.checked)}
                    className="h-4 w-4 rounded-sm border-strong text-accent-ink focus:ring-accent"
                  />
                  Make public
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={resetCreateForm}
                  className="rounded-sm border border-strong px-4 py-2 text-body-sm font-medium text-primary hover:bg-hover"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!newName.trim() || createList.isPending}
                  className="rounded-sm bg-accent px-4 py-2 text-body-sm font-medium text-on-accent hover:bg-accent-hover disabled:opacity-50"
                >
                  Create List
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Gene lists */}
        {!geneLists || geneLists.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <List className="mb-4 h-12 w-12 text-gray-300" />
            <p className="text-title font-medium text-primary">No gene lists yet</p>
            <p className="mt-1 text-body-sm text-secondary">
              Create custom lists to organize genes by theme or function
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {geneLists.map((list) => {
              const isEditing = editingId === list.id;

              return (
                <div
                  key={list.id}
                  className="rounded-card bg-surface p-4 shadow-sm"
                  style={list.color ? { borderLeftColor: list.color, borderLeftWidth: '4px' } : {}}
                >
                  {/* List header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <List className="mt-1 h-5 w-5 text-muted" />
                      <div>
                        {isEditing ? (
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="rounded-sm border border-strong px-2 py-1 font-semibold"
                          />
                        ) : (
                          <>
                            <h3 className="text-title text-primary">{list.name}</h3>
                            {list.description && (
                              <p className="mt-1 text-body-sm text-secondary">{list.description}</p>
                            )}
                          </>
                        )}
                        <div className="mt-2 flex items-center gap-3 text-caption text-secondary">
                          <span>{list.gene_count} genes</span>
                          {list.is_public ? (
                            <span className="inline-flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              Public
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1">
                              <Lock className="h-3 w-3" />
                              Private
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-1">
                      {isEditing ? (
                        <>
                          <button
                            onClick={cancelEdit}
                            className="rounded-pill p-1 text-muted hover:bg-hover hover:text-secondary"
                          >
                            <X className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => saveEdit(list.id)}
                            className="rounded-pill p-1 text-green-600 hover:bg-green-100"
                          >
                            <Save className="h-4 w-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => startEdit(list)}
                            className="rounded-pill p-1 text-muted hover:bg-hover hover:text-secondary"
                            title="Edit"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(list.id, list.name)}
                            className="rounded-pill p-1 text-muted hover:bg-red-100 hover:text-red-600"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Genes preview */}
                  {list.genes.length > 0 && (
                    <div className="mt-3 rounded-sm bg-surface-2 p-3">
                      <p className="text-caption font-medium text-primary">Genes:</p>
                      <p className="mt-1 font-mono text-caption text-secondary">
                        {list.genes.slice(0, 10).join(', ')}
                        {list.genes.length > 10 && ` ... +${list.genes.length - 10} more`}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
