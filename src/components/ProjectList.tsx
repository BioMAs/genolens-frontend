'use client';

import { useEffect, useState } from 'react';
import api from '@/utils/api';
import { Project } from '@/types';
import { Folder, Plus, Calendar } from 'lucide-react';
import Link from 'next/link';

interface ProjectListProps {
  onCreateClick: () => void;
}

export default function ProjectList({ onCreateClick }: ProjectListProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const response = await api.get('/projects/');
      setProjects(response.data.items);
      setError(null);
    } catch (err: any) {
      // Ignore aborted requests (they happen during strict mode or hot reload)
      if (err.code === 'ECONNABORTED' || err.message === 'Request aborted') {
        return;
      }
      console.error('Failed to fetch projects:', err);
      setError('Failed to load projects. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const loadProjects = async () => {
      if (isMounted) {
        await fetchProjects();
      }
    };

    loadProjects();

    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-40 animate-pulse rounded-lg bg-gray-200"></div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-4">
        <div className="flex">
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">{error}</h3>
          </div>
        </div>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-lg border border-gray-200 border-dashed">
        <Folder className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-semibold text-gray-900">No projects</h3>
        <p className="mt-1 text-sm text-gray-500">Get started by creating a new project.</p>
        <div className="mt-6">
          <button
            onClick={onCreateClick}
            className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            <Plus className="-ml-0.5 mr-1.5 h-5 w-5" aria-hidden="true" />
            New Project
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map((project) => (
        <Link
          key={project.id}
          href={`/projects/${project.id}`}
          className="relative flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white p-6 hover:border-indigo-500 hover:shadow-md transition-all"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50">
                <Folder className="h-6 w-6 text-indigo-600" />
              </div>
              <h3 className="ml-4 text-base font-semibold leading-7 text-gray-900">
                {project.name}
              </h3>
            </div>
          </div>
          <p className="mt-2 text-sm text-gray-500 line-clamp-2">
            {project.description || 'No description provided.'}
          </p>
          <div className="mt-4 flex items-center text-xs text-gray-400">
            <Calendar className="mr-1.5 h-4 w-4" />
            Created {new Date(project.created_at).toLocaleDateString()}
          </div>
        </Link>
      ))}
    </div>
  );
}
