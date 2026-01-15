'use client';

import { useState, useMemo } from 'react';
import { useProject, useProjectDatasets } from '@/hooks/useProjectData';
import { Dataset, DatasetType, DatasetStatus } from '@/types';
import { ArrowLeft, Upload, FileText, Database, Activity, AlertCircle, CheckCircle, Clock, Edit2, Eye, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import EditDatasetModal from './EditDatasetModal';
import PCAPlot from './PCAPlot';
import LibrarySizePlot from './LibrarySizePlot';
import QCDashboard from './QCDashboard';
import { TableSkeleton, ComparisonCardSkeleton, QCDashboardSkeleton } from './Skeletons';
import { deslugComparisonName, formatDate } from '@/utils/formatters';
import api from '@/utils/api';

interface ProjectDetailProps {
  projectId: string;
}

export default function ProjectDetailWithQuery({ projectId }: ProjectDetailProps) {
  const [activeTab, setActiveTab] = useState<'qc' | 'pca' | 'comparisons' | 'data'>('comparisons');

  // React Query hooks
  const { data: project, isLoading: projectLoading, error: projectError } = useProject(projectId);
  const { data: datasets = [], isLoading: datasetsLoading, error: datasetsError, refetch: refetchDatasets } = useProjectDatasets(projectId);

  // Edit State
  const [editingDataset, setEditingDataset] = useState<Dataset | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Upload State
  const [isUploading, setIsUploading] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    name: '',
    type: DatasetType.MATRIX,
    description: '',
    comparison_name: '',
    is_normalized: false,
    contains_all_genes: true,
    file: null as File | null
  });
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Memoized computations
  const comparisons = useMemo(() => {
    const comps: Record<string, { id: string, type: 'SINGLE' | 'GLOBAL', dataset: Dataset, hasEnrichment: boolean }> = {};

    datasets.forEach(d => {
      if (d.type === DatasetType.DEG) {
        const compName = d.dataset_metadata?.comparison_name || d.name;
        comps[compName] = {
          id: d.id,
          type: 'SINGLE',
          dataset: d,
          hasEnrichment: false
        };
      }

      if (d.dataset_metadata?.comparisons) {
        Object.keys(d.dataset_metadata.comparisons).forEach(compName => {
          comps[compName] = {
            id: d.id,
            type: 'GLOBAL',
            dataset: d,
            hasEnrichment: false
          };
        });
      }
    });

    datasets.forEach(d => {
      if (d.type === DatasetType.ENRICHMENT && d.dataset_metadata?.enrichment_comparisons) {
        d.dataset_metadata.enrichment_comparisons.forEach((compName: string) => {
          if (comps[compName]) {
            comps[compName].hasEnrichment = true;
          }
        });
      }
    });

    return comps;
  }, [datasets]);

  const originalFiles = useMemo(() => {
    return datasets.filter(d => d.raw_file_path);
  }, [datasets]);

  const matrixDataset = useMemo(() => {
    return datasets.find(d => d.type === DatasetType.MATRIX && d.status === DatasetStatus.READY);
  }, [datasets]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setUploadForm({ ...uploadForm, file: e.target.files[0] });
      setUploadError(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const validExtensions = ['.csv', '.tsv', '.txt', '.xlsx', '.xls'];
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();

      if (validExtensions.includes(fileExtension)) {
        setUploadForm({ ...uploadForm, file });
        setUploadError(null);
      } else {
        setUploadError('Invalid file type. Please upload CSV, TSV, or Excel files.');
      }
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleReprocess = async (datasetId: string) => {
    try {
      await api.post(`/datasets/${datasetId}/reprocess`);
      await refetchDatasets();
    } catch (err: any) {
      console.error('Reprocess failed:', err);
      alert('Failed to reprocess dataset');
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!uploadForm.file) {
      setUploadError('Please select a file to upload');
      return;
    }

    try {
      setIsUploading(true);
      setUploadError(null);

      const formData = new FormData();
      formData.append('file', uploadForm.file);
      formData.append('project_id', projectId);
      formData.append('name', uploadForm.name);
      formData.append('dataset_type', uploadForm.type);
      formData.append('description', uploadForm.description || '');
      formData.append('comparison_name', uploadForm.comparison_name || '');
      formData.append('is_normalized', uploadForm.is_normalized.toString());
      formData.append('contains_all_genes', uploadForm.contains_all_genes.toString());

      await api.post('/datasets/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setUploadForm({
        name: '',
        type: DatasetType.MATRIX,
        description: '',
        comparison_name: '',
        is_normalized: false,
        contains_all_genes: true,
        file: null
      });

      await refetchDatasets();
    } catch (err: any) {
      console.error('Upload failed:', err);
      setUploadError(err.response?.data?.detail || 'Failed to upload dataset');
    } finally {
      setIsUploading(false);
    }
  };

  const getStatusIcon = (status: DatasetStatus) => {
    switch (status) {
      case DatasetStatus.READY: return <CheckCircle className="h-5 w-5 text-green-500" />;
      case DatasetStatus.FAILED: return <AlertCircle className="h-5 w-5 text-red-500" />;
      case DatasetStatus.PROCESSING: return <Activity className="h-5 w-5 text-blue-500 animate-pulse" />;
      default: return <Clock className="h-5 w-5 text-gray-400" />;
    }
  };

  const loading = projectLoading || datasetsLoading;
  const error = projectError || datasetsError;

  if (loading) return <div className="p-8 text-center">Loading...</div>;
  if (error) return <div className="p-8 text-center text-red-600">Failed to load project details.</div>;
  if (!project) return <div className="p-8 text-center">Project not found</div>;

  return (
    <div className="min-h-screen bg-gray-50 py-6">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Link href="/" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-3">
            <ArrowLeft className="mr-1 h-4 w-4" /> Back to Dashboard
          </Link>
        </div>

        {/* Project Statistics Card */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
              <p className="mt-1 text-sm text-gray-600">{project.description}</p>
              <p className="mt-2 text-xs text-gray-500">Created {formatDate(project.created_at)}</p>
            </div>
            <Link
              href={`/projects/${projectId}?tab=data`}
              onClick={(e) => {
                e.preventDefault();
                setActiveTab('data');
              }}
              className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              <Database className="h-4 w-4 mr-1.5" />
              Data Management
            </Link>
          </div>

          {/* Project Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-blue-600 uppercase">Comparisons</p>
                  <p className="mt-1 text-2xl font-semibold text-gray-900">{Object.keys(comparisons).length}</p>
                </div>
                <Activity className="h-8 w-8 text-blue-600 opacity-20" />
              </div>
            </div>

            <div className="bg-green-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-green-600 uppercase">Datasets</p>
                  <p className="mt-1 text-2xl font-semibold text-gray-900">{datasets.length}</p>
                </div>
                <FileText className="h-8 w-8 text-green-600 opacity-20" />
              </div>
            </div>

            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-purple-600 uppercase">Original Files</p>
                  <p className="mt-1 text-2xl font-semibold text-gray-900">{originalFiles.length}</p>
                </div>
                <Upload className="h-8 w-8 text-purple-600 opacity-20" />
              </div>
            </div>

            <div className="bg-amber-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-amber-600 uppercase">Status</p>
                  <p className="mt-1 text-sm font-semibold text-gray-900">
                    {datasets.filter(d => d.status === DatasetStatus.PROCESSING).length > 0 ? 'Processing' : 'Ready'}
                  </p>
                </div>
                {datasets.filter(d => d.status === DatasetStatus.PROCESSING).length > 0 ? (
                  <Clock className="h-8 w-8 text-amber-600 opacity-20 animate-pulse" />
                ) : (
                  <CheckCircle className="h-8 w-8 text-amber-600 opacity-20" />
                )}
              </div>
            </div>
          </div>

          {/* Original Files List */}
          {originalFiles.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-xs font-medium text-gray-500 uppercase mb-2">Original Files</p>
              <div className="flex flex-wrap gap-2">
                {originalFiles.map(file => (
                  <span
                    key={file.id}
                    className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700"
                  >
                    <FileText className="h-3 w-3 mr-1" />
                    {file.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Tabs - Rest of the component remains the same */}
        <div className="bg-white shadow rounded-lg">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('comparisons')}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'comparisons'
                    ? 'border-brand-primary text-brand-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Comparisons
              </button>
              <button
                onClick={() => setActiveTab('qc')}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'qc'
                    ? 'border-brand-primary text-brand-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Quality Control
              </button>
              <button
                onClick={() => setActiveTab('pca')}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'pca'
                    ? 'border-brand-primary text-brand-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                PCA
              </button>
              <button
                onClick={() => setActiveTab('data')}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'data'
                    ? 'border-brand-primary text-brand-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Data Management
              </button>
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'comparisons' && (
              <ComparisonsTab
                comparisons={comparisons}
                datasetsLoading={datasetsLoading}
                projectId={projectId}
              />
            )}

            {activeTab === 'qc' && (
              <QCTab
                datasets={datasets}
                datasetsLoading={datasetsLoading}
              />
            )}

            {activeTab === 'pca' && (
              <PCATab
                datasets={datasets}
                datasetsLoading={datasetsLoading}
              />
            )}

            {activeTab === 'data' && (
              <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
                {/* Dataset list and upload form would go here - copied from original */}
                <div className="lg:col-span-2">
                  {datasetsLoading ? (
                    <TableSkeleton rows={5} />
                  ) : (
                    <div className="bg-white shadow sm:rounded-lg">
                      <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
                        <h3 className="text-lg font-medium leading-6 text-gray-900">Datasets</h3>
                      </div>
                      <ul role="list" className="divide-y divide-gray-200">
                        {datasets.length === 0 ? (
                          <li className="px-4 py-8 text-center text-gray-500">No datasets yet. Upload one to get started.</li>
                        ) : (
                          datasets.map(dataset => (
                            <li key={dataset.id} className="px-4 py-4 sm:px-6 hover:bg-gray-50">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-4 flex-1">
                                  {getStatusIcon(dataset.status)}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 truncate">{dataset.name}</p>
                                    <p className="text-sm text-gray-500">{dataset.type}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-4">
                                  <span className="text-sm text-gray-500">{dataset.status}</span>
                                  <div className="flex gap-2">
                                    {dataset.status === DatasetStatus.READY && (
                                      <>
                                        <button
                                          onClick={() => {
                                            setEditingDataset(dataset);
                                            setIsEditModalOpen(true);
                                          }}
                                          className="text-brand-primary hover:text-brand-primary/80"
                                        >
                                          <Edit2 className="h-4 w-4" />
                                        </button>
                                        <Link href={`/projects/${projectId}/datasets/${dataset.id}`} className="text-brand-primary hover:text-brand-primary/80">
                                          <Eye className="h-4 w-4" />
                                        </Link>
                                        <button
                                          onClick={() => handleReprocess(dataset.id)}
                                          className="text-gray-600 hover:text-gray-900"
                                        >
                                          <RefreshCw className="h-4 w-4" />
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </li>
                          ))
                        )}
                      </ul>
                    </div>
                  )}
                </div>
                {/* Upload form column would go here */}
              </div>
            )}
          </div>
        </div>
      </div>

      {editingDataset && (
        <EditDatasetModal
          dataset={editingDataset}
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onSuccess={refetchDatasets}
        />
      )}
    </div>
  );
}

// Tab Components (same as original)
function ComparisonsTab({
  comparisons,
  datasetsLoading,
  projectId
}: {
  comparisons: Record<string, { id: string, type: 'SINGLE' | 'GLOBAL', dataset: Dataset, hasEnrichment: boolean }>,
  datasetsLoading: boolean,
  projectId: string
}) {
  if (datasetsLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <ComparisonCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (Object.keys(comparisons).length === 0) {
    return (
      <div className="text-center py-12">
        <Activity className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">No comparisons</h3>
        <p className="mt-1 text-sm text-gray-500">Upload DEG datasets to see comparisons here.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Comparison Name
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Source
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Features
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {Object.entries(comparisons).map(([compName, info]) => (
            <tr key={compName} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center">
                  <Activity className="h-5 w-5 text-brand-primary mr-3" />
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {deslugComparisonName(compName)}
                    </div>
                    <div className="text-xs text-gray-500 font-mono">{compName}</div>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                  {info.type === 'GLOBAL' ? 'Global Analysis' : 'Individual File'}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex gap-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                    DEG
                  </span>
                  {info.hasEnrichment && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                      Enrichment
                    </span>
                  )}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <Link
                  href={info.type === 'GLOBAL'
                    ? `/projects/${projectId}/comparisons/${encodeURIComponent(compName)}?datasetId=${info.id}`
                    : `/projects/${projectId}/comparisons/${encodeURIComponent(compName)}`
                  }
                  className="text-brand-primary hover:text-brand-primary/80 inline-flex items-center"
                >
                  View Details
                  <Eye className="ml-1 h-4 w-4" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function QCTab({ datasets, datasetsLoading }: { datasets: Dataset[], datasetsLoading: boolean }) {
  if (datasetsLoading) {
    return <QCDashboardSkeleton />;
  }

  const matrixDataset = datasets.find(d => d.type === DatasetType.MATRIX && d.status === DatasetStatus.READY);

  if (!matrixDataset) {
    return (
      <div className="text-center py-12">
        <Database className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">No matrix data available</h3>
        <p className="mt-1 text-sm text-gray-500">Upload an expression matrix to see quality control metrics.</p>
      </div>
    );
  }

  return <QCDashboard datasets={datasets} />;
}

function PCATab({ datasets, datasetsLoading }: { datasets: Dataset[], datasetsLoading: boolean }) {
  if (datasetsLoading) {
    return <QCDashboardSkeleton />;
  }

  const matrixDataset = datasets.find(d => d.type === DatasetType.MATRIX && d.status === DatasetStatus.READY);
  const metadataDataset = datasets.find(d => (d.type === DatasetType.METADATA || d.type === DatasetType.METADATA_SAMPLE) && d.status === DatasetStatus.READY);

  if (!matrixDataset) {
    return (
      <div className="text-center py-12">
        <Database className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">No matrix data available</h3>
        <p className="mt-1 text-sm text-gray-500">Upload an expression matrix to see PCA analysis.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Principal Component Analysis</h3>
        <PCAPlot dataset={matrixDataset} metadataDataset={metadataDataset} />
      </div>
    </div>
  );
}
