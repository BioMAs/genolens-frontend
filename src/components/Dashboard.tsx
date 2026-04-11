'use client';

import { useState } from 'react';
import ProjectList from './ProjectList';
import CreateProjectModal from './CreateProjectModal';
import { Plus } from 'lucide-react';

export default function Dashboard() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      {/* Page header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2
            className="font-display font-bold tracking-tight"
            style={{ fontSize: '1.25rem', color: 'var(--text-primary)' }}
          >
            Projects
          </h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Manage your transcriptomics analysis projects.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all"
          style={{ background: 'var(--sl-purple)' }}
          onMouseEnter={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.background = 'var(--sl-purple-dark)')
          }
          onMouseLeave={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.background = 'var(--sl-purple)')
          }
        >
          <Plus className="h-4 w-4" />
          New Project
        </button>
      </div>

      <ProjectList onCreateClick={() => setIsModalOpen(true)} />

      <CreateProjectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          // Cache invalidation happens inside CreateProjectModal via React Query
        }}
      />
    </>
  );
}
