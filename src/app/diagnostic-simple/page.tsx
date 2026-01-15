'use client';

import { useState, useEffect } from 'react';
import api from '@/utils/api';
import { Loader2, Database } from 'lucide-react';

interface Dataset {
  id: string;
  name: string;
  dataset_type: string;
  dataset_metadata?: {
    columns_info?: {
      comparisons?: Record<string, any>;
    };
  };
}

interface Project {
  id: string;
  name: string;
  datasets: Dataset[];
}

export default function DiagnosticSimplePage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setLoading(true);
        const response = await api.get('/projects');

        console.log('Projects API response:', response.data);

        // Handle both array and object responses
        const projectsData = Array.isArray(response.data)
          ? response.data
          : response.data.items || response.data.projects || [];

        console.log('Projects data:', projectsData);
        console.log('Projects count:', projectsData.length);

        if (projectsData.length === 0) {
          setProjects([]);
          setLoading(false);
          return;
        }

        // Fetch datasets for each project
        const projectsWithDatasets = await Promise.all(
          projectsData.map(async (project: any) => {
            try {
              console.log(`Fetching datasets for project ${project.id} (${project.name})`);
              const datasetsResponse = await api.get(`/datasets/project/${project.id}`);
              console.log(`Datasets for ${project.name}:`, datasetsResponse.data);
              return {
                ...project,
                datasets: datasetsResponse.data || []
              };
            } catch (err) {
              console.error(`Failed to fetch datasets for project ${project.id}:`, err);
              return {
                ...project,
                datasets: []
              };
            }
          })
        );

        console.log('Projects with datasets:', projectsWithDatasets);
        setProjects(projectsWithDatasets);
      } catch (err: any) {
        console.error('Failed to fetch projects:', err);
        setError(err.response?.data?.detail || 'Failed to load projects');
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-brand-primary mx-auto mb-4" />
          <p className="text-gray-600">Loading your datasets...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-700">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Find Dataset with M1_pos_24h_vs_M1_neg_24h</h1>

        <div className="space-y-6">
          {projects.map((project) => (
            <div key={project.id} className="bg-white shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Database className="h-5 w-5" />
                {project.name}
              </h2>

              {project.datasets && project.datasets.length > 0 ? (
                <div className="space-y-4">
                  {project.datasets.map((dataset) => {
                    const comparisons = dataset.dataset_metadata?.columns_info?.comparisons || {};
                    const targetComparison = 'M1_pos_24h_vs_M1_neg_24h';

                    // Check for exact match or prefix pattern (with :, _, or .)
                    const hasTargetComparison = targetComparison in comparisons ||
                      Object.keys(comparisons).some(key =>
                        key.endsWith(`:${targetComparison}`) ||
                        key.endsWith(`_${targetComparison}`) ||
                        key.endsWith(`.${targetComparison}`) ||
                        key.toLowerCase().includes(targetComparison.toLowerCase())
                      );

                    return (
                      <div
                        key={dataset.id}
                        className={`border rounded-lg p-4 ${
                          hasTargetComparison ? 'border-green-500 bg-green-50' : 'border-gray-200'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h3 className="font-semibold text-gray-900">{dataset.name}</h3>
                            <p className="text-sm text-gray-500">Type: {dataset.dataset_type}</p>
                            <p className="text-xs text-gray-400 font-mono mt-1">ID: {dataset.id}</p>
                          </div>
                          {hasTargetComparison && (
                            <span className="px-3 py-1 bg-green-600 text-white text-xs font-semibold rounded-full">
                              FOUND!
                            </span>
                          )}
                        </div>

                        {Object.keys(comparisons).length > 0 ? (
                          <div className="mt-3">
                            <p className="text-sm font-medium text-gray-700 mb-2">
                              Comparisons ({Object.keys(comparisons).length}):
                            </p>
                            <ul className="list-disc list-inside space-y-1">
                              {Object.keys(comparisons).map((compName) => {
                                const isTarget = compName === targetComparison ||
                                  compName.endsWith(`:${targetComparison}`) ||
                                  compName.endsWith(`_${targetComparison}`) ||
                                  compName.endsWith(`.${targetComparison}`) ||
                                  compName.toLowerCase().includes(targetComparison.toLowerCase());

                                return (
                                  <li
                                    key={compName}
                                    className={`text-sm ${
                                      isTarget
                                        ? 'text-green-700 font-semibold'
                                        : 'text-gray-600'
                                    }`}
                                  >
                                    {compName}
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500 mt-2">No comparisons found in metadata</p>
                        )}

                        {hasTargetComparison && (
                          <div className="mt-4 p-3 bg-white border border-green-300 rounded">
                            <p className="text-sm font-semibold text-gray-900 mb-2">
                              Use this Dataset ID for diagnostic:
                            </p>
                            <code className="block p-2 bg-gray-100 rounded text-xs font-mono break-all">
                              {dataset.id}
                            </code>
                            <a
                              href={`/diagnostic?dataset=${dataset.id}&comparison=M1_pos_24h_vs_M1_neg_24h`}
                              className="mt-3 inline-block px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
                            >
                              Run Diagnostic for this Dataset
                            </a>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No datasets in this project</p>
              )}
            </div>
          ))}

          {projects.length === 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
              <p className="text-yellow-800">No projects found. Please create a project and upload datasets first.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
