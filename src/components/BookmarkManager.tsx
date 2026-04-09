/**
 * BookmarkManager: Panel to view and manage all bookmarked genes
 */
'use client';

import { useState } from 'react';
import { Star, Trash2, Edit2, X, Save, Tag, Palette } from 'lucide-react';
import { useBookmarks, useUpdateBookmark, useDeleteBookmark } from '@/hooks/useBookmarks';
import { GeneBookmark } from '@/types/bookmark';
import ExportMenu from './ExportMenu';

interface BookmarkManagerProps {
  projectId: string;
  onClose?: () => void;
}

const PRESET_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#eab308', // yellow
  '#84cc16', // lime
  '#22c55e', // green
  '#10b981', // emerald
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#0ea5e9', // sky
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#a855f7', // purple
  '#d946ef', // fuchsia
  '#ec4899', // pink
];

export default function BookmarkManager({ projectId, onClose }: BookmarkManagerProps) {
  const { data: bookmarks, isLoading } = useBookmarks(projectId);
  const updateBookmark = useUpdateBookmark();
  const deleteBookmark = useDeleteBookmark();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNotes, setEditNotes] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editColor, setEditColor] = useState<string | undefined>();
  const [newTag, setNewTag] = useState('');
  const [showColorPicker, setShowColorPicker] = useState(false);

  const startEdit = (bookmark: GeneBookmark) => {
    setEditingId(bookmark.id);
    setEditNotes(bookmark.notes || '');
    setEditTags(bookmark.tags || []);
    setEditColor(bookmark.color);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditNotes('');
    setEditTags([]);
    setEditColor(undefined);
    setNewTag('');
    setShowColorPicker(false);
  };

  const saveEdit = async (bookmarkId: string) => {
    try {
      await updateBookmark.mutateAsync({
        bookmarkId,
        data: {
          notes: editNotes || undefined,
          tags: editTags,
          color: editColor,
        },
      });
      cancelEdit();
    } catch (error) {
      console.error('Failed to update bookmark:', error);
    }
  };

  const handleDelete = async (bookmarkId: string, geneSymbol: string) => {
    if (confirm(`Remove bookmark for ${geneSymbol}?`)) {
      try {
        await deleteBookmark.mutateAsync(bookmarkId);
      } catch (error) {
        console.error('Failed to delete bookmark:', error);
      }
    }
  };

  const addTag = () => {
    if (newTag && !editTags.includes(newTag)) {
      setEditTags([...editTags, newTag]);
      setNewTag('');
    }
  };

  const removeTag = (tag: string) => {
    setEditTags(editTags.filter((t) => t !== tag));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-indigo-600" />
      </div>
    );
  }

  if (!bookmarks || bookmarks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <Star className="mb-4 h-12 w-12 text-gray-300" />
        <p className="text-lg font-medium text-gray-900">No bookmarks yet</p>
        <p className="mt-1 text-sm text-gray-500">
          Click the star icon next to genes to bookmark them
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Bookmarked Genes</h2>
          <p className="mt-1 text-sm text-gray-500">{bookmarks.length} genes</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportMenu
            data={bookmarks.map(b => ({
              gene_symbol: b.gene_symbol,
              comparison: b.extra_data?.comparison || 'N/A',
              notes: b.notes || '',
              tags: (b.tags || []).join(', '),
              color: b.color || '',
              created_at: new Date(b.created_at).toLocaleString(),
            }))}
            filename="my_bookmarks"
            formats={['csv', 'json']}
            csvColumns={[
              { key: 'gene_symbol', label: 'Gene Symbol' },
              { key: 'comparison', label: 'Comparison' },
              { key: 'notes', label: 'Notes' },
              { key: 'tags', label: 'Tags' },
              { key: 'created_at', label: 'Created At' }
            ]}
            variant="outline"
            size="sm"
          />
          {onClose && (
            <button
              onClick={onClose}
              className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-500"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* Bookmarks list */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="space-y-4">
          {bookmarks.map((bookmark) => {
            const isEditing = editingId === bookmark.id;

            return (
              <div
                key={bookmark.id}
                className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
                style={bookmark.color ? { borderLeftColor: bookmark.color, borderLeftWidth: '4px' } : {}}
              >
                {/* Gene header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                    <div>
                      <h3 className="font-mono text-lg font-semibold text-gray-900">
                        {bookmark.gene_symbol}
                      </h3>
                      {bookmark.gene_id && (
                        <p className="text-xs text-gray-500">{bookmark.gene_id}</p>
                      )}
                    </div>
                  </div>

                  {!isEditing && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => startEdit(bookmark)}
                        className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                        title="Edit"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(bookmark.id, bookmark.gene_symbol)}
                        className="rounded-full p-1 text-gray-400 hover:bg-red-100 hover:text-red-600"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Content */}
                {isEditing ? (
                  <div className="mt-4 space-y-3">
                    {/* Notes */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Notes</label>
                      <textarea
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        placeholder="Add notes about this gene..."
                        className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        rows={3}
                      />
                    </div>

                    {/* Tags */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Tags</label>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {editTags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-3 py-1 text-sm text-indigo-700"
                          >
                            {tag}
                            <button
                              onClick={() => removeTag(tag)}
                              className="hover:text-indigo-900"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                      <div className="mt-2 flex gap-2">
                        <input
                          type="text"
                          value={newTag}
                          onChange={(e) => setNewTag(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && addTag()}
                          placeholder="Add tag..."
                          className="flex-1 rounded-md border border-gray-300 px-3 py-1 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                        <button
                          onClick={addTag}
                          className="rounded-md bg-gray-100 px-3 py-1 text-sm text-gray-700 hover:bg-gray-200"
                        >
                          Add
                        </button>
                      </div>
                    </div>

                    {/* Color */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Color</label>
                      <div className="mt-1 flex items-center gap-2">
                        <button
                          onClick={() => setShowColorPicker(!showColorPicker)}
                          className="flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
                        >
                          <Palette className="h-4 w-4" />
                          {editColor ? (
                            <span
                              className="h-4 w-8 rounded border border-gray-300"
                              style={{ backgroundColor: editColor }}
                            />
                          ) : (
                            'Select color'
                          )}
                        </button>
                        {editColor && (
                          <button
                            onClick={() => setEditColor(undefined)}
                            className="text-sm text-gray-500 hover:text-gray-700"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                      {showColorPicker && (
                        <div className="mt-2 grid grid-cols-8 gap-1">
                          {PRESET_COLORS.map((color) => (
                            <button
                              key={color}
                              onClick={() => {
                                setEditColor(color);
                                setShowColorPicker(false);
                              }}
                              className="h-8 w-8 rounded border-2 border-transparent hover:border-gray-400"
                              style={{ backgroundColor: color }}
                              title={color}
                            />
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        onClick={cancelEdit}
                        className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => saveEdit(bookmark.id)}
                        disabled={updateBookmark.isPending}
                        className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                      >
                        <Save className="h-4 w-4" />
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 space-y-2">
                    {bookmark.notes && (
                      <p className="text-sm text-gray-700">{bookmark.notes}</p>
                    )}
                    {bookmark.tags && bookmark.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {bookmark.tags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700"
                          >
                            <Tag className="h-3 w-3" />
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-gray-400">
                      Added {new Date(bookmark.created_at).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
