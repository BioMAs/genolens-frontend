'use client';

import { useState } from 'react';
import { X, Trash2, AlertTriangle } from 'lucide-react';
import { useDeleteProject } from '@/hooks/useProjects';
import { Project } from '@/types';

interface DeleteProjectModalProps {
  project: Project | null;
  onClose: () => void;
}

export default function DeleteProjectModal({ project, onClose }: DeleteProjectModalProps) {
  const [confirmName, setConfirmName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const deleteMutation = useDeleteProject();

  if (!project) return null;

  const isConfirmed = confirmName === project.name;

  const handleClose = () => {
    setConfirmName('');
    setError(null);
    onClose();
  };

  const handleDelete = async () => {
    if (!isConfirmed) return;
    setError(null);
    try {
      await deleteMutation.mutateAsync(project.id);
      handleClose();
    } catch {
      setError('La suppression a échoué. Veuillez réessayer.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-2xl ring-1 ring-gray-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-red-500" />
            <h2 className="text-lg font-semibold text-gray-900">Supprimer le projet</h2>
          </div>
          <button
            onClick={handleClose}
            className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-500"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <div className="flex items-start gap-3 rounded-lg p-3 bg-red-50 border border-red-100">
            <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">
              Cette action est <strong>irréversible</strong>. Tous les datasets, comparaisons et membres associés seront définitivement supprimés.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Tapez <span className="font-semibold text-gray-900">{project.name}</span> pour confirmer
            </label>
            <input
              type="text"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={project.name}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-100"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && isConfirmed && handleDelete()}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-6 py-4">
          <button
            onClick={handleClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleDelete}
            disabled={!isConfirmed || deleteMutation.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: isConfirmed && !deleteMutation.isPending ? '#ef4444' : '#ef4444' }}
          >
            {deleteMutation.isPending ? (
              <>
                <span className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Suppression…
              </>
            ) : (
              <>
                <Trash2 className="h-3.5 w-3.5" />
                Supprimer
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
