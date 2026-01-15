'use client';

import { useState } from 'react';
import ProjectList from './ProjectList';
import CreateProjectModal from './CreateProjectModal';
import { Plus } from 'lucide-react';

export default function Dashboard() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleProjectCreated = () => {
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
            Projects
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Manage your transcriptomics analysis projects.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >
          <Plus className="-ml-0.5 mr-1.5 h-5 w-5" aria-hidden="true" />
          New Project
        </button>
      </div>

      <ProjectList key={refreshKey} onCreateClick={() => setIsModalOpen(true)} />

      <CreateProjectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleProjectCreated}
      />
    </>
  );
}
