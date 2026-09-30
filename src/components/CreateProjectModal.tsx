'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import Link from 'next/link';
import api from '@/utils/api';
import { ArrowUpCircle } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Optional: the project list cache is invalidated here regardless. */
  onSuccess?: () => void;
}

export default function CreateProjectModal({ isOpen, onClose, onSuccess }: CreateProjectModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLimitError, setIsLimitError] = useState(false);
  const queryClient = useQueryClient();
  const router = useRouter();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setIsLimitError(false);

    try {
      const res = await api.post<{ id: string }>('/projects/', {
        name,
        description,
      });
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
      await queryClient.invalidateQueries({ queryKey: ['subscription'] });
      // La jauge de projets et la barriere de creation lisent `project_count`
      // sur /users/me, cache 5 minutes : sans cette invalidation, creer le
      // 15e projet laisse le compteur a 14 et le bouton actif, jusqu'a ce que
      // le backend refuse.
      await queryClient.invalidateQueries({ queryKey: ['userProfile'] });
      setName('');
      setDescription('');
      onSuccess?.();
      onClose();
      // Redirect to guided setup wizard
      router.push(`/projects/${res.data.id}/setup`);
    } catch (err) {
      console.error('Failed to create project:', err);
      if (axios.isAxiosError(err) && err.response?.status === 403) {
        const detail = err.response.data?.detail;
        if (detail?.error === 'project_limit_reached') {
          setIsLimitError(true);
          setError(`Project limit reached (${detail.current_count}/${detail.max_projects}). Upgrade your plan to create more projects.`);
          return;
        }
      }
      setError('Failed to create project. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title="Create New Project"
      dismissible={!loading}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" form="create-project-form" disabled={loading}>
            {loading ? 'Creating...' : 'Create Project'}
          </Button>
        </>
      }
    >
      <form id="create-project-form" onSubmit={handleSubmit}>
        {error && (
          <div
            role="alert"
            className={cn(
              'mb-4 rounded-sm p-3 text-body-sm',
              isLimitError ? 'bg-warning-soft border border-warning/30' : 'bg-danger-soft',
            )}
          >
            <p className={isLimitError ? 'text-warning-ink font-medium' : 'text-danger-ink'}>{error}</p>
            {isLimitError && (
              <Link
                href="/pricing"
                className="mt-2 inline-flex items-center gap-2 text-caption font-semibold text-on-accent rounded-sm px-3 py-1.5 bg-accent hover:bg-accent-hover"
                onClick={onClose}
              >
                <ArrowUpCircle className="h-3.5 w-3.5" aria-hidden />
                Upgrade Plan
              </Link>
            )}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-body-sm font-medium text-primary">
              Project Name
            </label>
            <input
              type="text"
              id="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full rounded-sm border border-strong px-3 py-2 shadow-sm focus:border-accent focus:outline-none focus:ring-accent sm:text-body-sm"
              placeholder="My Awesome Project"
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-body-sm font-medium text-primary">
              Description <span className="text-muted">(Optional)</span>
            </label>
            <textarea
              id="description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 block w-full rounded-sm border border-strong px-3 py-2 shadow-sm focus:border-accent focus:outline-none focus:ring-accent sm:text-body-sm"
              placeholder="Brief description of your project..."
            />
          </div>
        </div>
      </form>
    </Dialog>
  );
}
