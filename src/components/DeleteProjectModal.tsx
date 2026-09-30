'use client';

import { useState } from 'react';
import { Trash2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
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
      setError('Deletion failed. Please try again.');
    }
  };

  const busy = deleteMutation.isPending;

  return (
    <Dialog
      open
      onClose={handleClose}
      title="Delete project"
      icon={<Trash2 className="mt-1 h-5 w-5 shrink-0 text-danger-ink" aria-hidden />}
      dismissible={!busy}
      footer={
        <>
          <Button variant="ghost" onClick={handleClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={!isConfirmed || busy}>
            {busy ? (
              <>
                <span
                  className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-pill animate-spin"
                  aria-hidden
                />
                Deleting…
              </>
            ) : (
              <>
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                Delete
              </>
            )}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-control p-3 bg-danger-soft border border-danger/30">
          <AlertTriangle className="h-4 w-4 text-danger-ink flex-shrink-0 mt-1" aria-hidden />
          <p className="text-body-sm text-danger-ink">
            This action is <strong>irreversible</strong>. All datasets, comparisons and members of this project will be permanently deleted.
          </p>
        </div>

        <div>
          <label htmlFor="delete-project-confirm" className="block text-body-sm font-medium text-primary mb-2">
            Type <span className="font-semibold text-primary">{project.name}</span> to confirm
          </label>
          <input
            id="delete-project-confirm"
            type="text"
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            placeholder={project.name}
            autoComplete="off"
            className="w-full rounded-control border border-line px-3 py-2 text-body-sm text-primary placeholder:text-muted focus:border-danger focus:outline-none focus:ring-2 focus:ring-danger/30"
            onKeyDown={(e) => e.key === 'Enter' && isConfirmed && handleDelete()}
          />
        </div>

        {error && (
          <p role="alert" className="text-body-sm text-danger-ink">{error}</p>
        )}
      </div>
    </Dialog>
  );
}
