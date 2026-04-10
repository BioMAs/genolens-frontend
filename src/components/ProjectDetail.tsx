'use client';

import { useState } from 'react';
import api from '@/utils/api';
import { Dataset, DatasetType, DatasetStatus } from '@/types';
import { useProjectSummary, useProjectDatasets, useProjectComparisons } from '@/hooks/useProjectData';
import { useProjectMembers } from '@/hooks/useProjectMembers';
import { ArrowLeft, Upload, FileText, Database, Activity, AlertCircle, CheckCircle, Clock, Edit2, Eye, RefreshCw, GitCompare, Star, List, Users } from 'lucide-react';
import Link from 'next/link';
import { usePrefetchComparisons } from '@/hooks/useComparisons';
import { usePrefetchVisualizations } from '@/hooks/useVisualizations';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import EditDatasetModal from './EditDatasetModal';
import BookmarkManager from './BookmarkManager';
import GeneListManager from './GeneListManager';
import ProjectMembersModal from './ProjectMembersModal';
import PCAPlot from './PCAPlot';
import UMAPPlot from './UMAPPlot';
import QCDashboard from './QCDashboard';
import { TableSkeleton, ComparisonCardSkeleton, QCDashboardSkeleton, ProjectDetailSkeleton } from './Skeletons';
import { deslugComparisonName, formatDate } from '@/utils/formatters';
import ProjectHistory from './ProjectHistory';
import ProjectStatsDashboard from './ProjectStatsDashboard';

interface ProjectDetailProps {
  projectId: string;
}

export default function ProjectDetail({ projectId }: ProjectDetailProps) {
  const [activeTab, setActiveTab] = useState<'qc' | 'pca' | 'comparisons' | 'data' | 'history' | 'stats'>('comparisons');

  // Get current authenticated user
  const { user: currentUser } = useCurrentUser();

  // React Query: un seul appel pour le projet + stats agrégées
  const { data: summary, isLoading: summaryLoading } = useProjectSummary(projectId);
  const project = summary?.project;

  // Derive current user's admin status on this project
  const { data: membersData } = useProjectMembers(projectId);
  const isOwner = !!project && !!currentUser && project.owner_id === currentUser.id;
  const currentMember = membersData?.members?.find((m) => m.user_id === currentUser?.id);
  const canManageData = isOwner || currentMember?.access_level === 'ADMIN';

  // React Query: datasets complets pour les onglets QC, PCA, Data Management
  const { data: datasets = [], isLoading: datasetsLoading, refetch: refetchDatasets } = useProjectDatasets(projectId);

  // Edit State
  const [editingDataset, setEditingDataset] = useState<Dataset | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Bookmark & Gene List Modals State
  const [isBookmarkModalOpen, setIsBookmarkModalOpen] = useState(false);
  const [isGeneListModalOpen, setIsGeneListModalOpen] = useState(false);
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);

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
      // Validate file extension
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
      alert(err.response?.data?.detail || 'Failed to reprocess dataset.');
    }
  };

  const handleReprocessAll = async () => {
    if (!confirm('This will regenerate all datasets in this project. This may take several minutes. Continue?')) {
      return;
    }
    
    try {
      const datasetsToReprocess = datasets.filter(ds => ds.raw_file_path && ds.status === DatasetStatus.READY);
      
      if (datasetsToReprocess.length === 0) {
        alert('No datasets available to reprocess.');
        return;
      }

      // Trigger reprocessing for all datasets
      await Promise.all(
        datasetsToReprocess.map(ds => api.post(`/datasets/${ds.id}/reprocess`))
      );
      
      alert(`Started reprocessing ${datasetsToReprocess.length} dataset(s). Please wait for completion.`);
      await refetchDatasets();
    } catch (err: any) {
      console.error('Reprocess all failed:', err);
      alert('Failed to reprocess all datasets. Some may have started successfully.');
      await refetchDatasets();
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadForm.file) {
      setUploadError('Please select a file.');
      return;
    }

    try {
      setIsUploading(true);
      setUploadError(null);

      const formData = new FormData();
      formData.append('project_id', projectId);
      formData.append('name', uploadForm.name);
      formData.append('dataset_type', uploadForm.type);
      formData.append('description', uploadForm.description);
      if (uploadForm.comparison_name) {
        formData.append('comparison_name', uploadForm.comparison_name);
      }
      formData.append('is_normalized', String(uploadForm.is_normalized));
      formData.append('contains_all_genes', String(uploadForm.contains_all_genes));
      formData.append('file', uploadForm.file);

      await api.post('/datasets/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      // Reset form and refresh list
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
      setUploadError(err.response?.data?.detail || 'Failed to upload dataset.');
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

  if (summaryLoading) return <ProjectDetailSkeleton />;
  if (!project) return <div className="p-8 text-center text-gray-500">Project not found.</div>;

  return (
    <div className="min-h-screen bg-gray-50 py-6">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* Header */}
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
            <div className="flex gap-2">
              {(summary?.stats.total_comparisons ?? 0) >= 2 && (
                <Link
                  href={`/projects/${projectId}/multi-comparison`}
                  className="inline-flex items-center px-3 py-1.5 border border-brand-primary text-sm font-medium rounded-md text-brand-primary bg-white hover:bg-brand-primary/5"
                >
                  <GitCompare className="h-4 w-4 mr-1.5" />
                  Multi-Comparison
                </Link>
              )}
              <button
                onClick={() => setIsBookmarkModalOpen(true)}
                className="inline-flex items-center px-3 py-1.5 border border-yellow-500 text-sm font-medium rounded-md text-yellow-600 bg-white hover:bg-yellow-50"
              >
                <Star className="h-4 w-4 mr-1.5" />
                My Bookmarks
              </button>
              <button
                onClick={() => setIsGeneListModalOpen(true)}
                className="inline-flex items-center px-3 py-1.5 border border-indigo-500 text-sm font-medium rounded-md text-indigo-600 bg-white hover:bg-indigo-50"
              >
                <List className="h-4 w-4 mr-1.5" />
                Gene Lists
              </button>
              <button
                onClick={() => setIsMembersModalOpen(true)}
                className="inline-flex items-center px-3 py-1.5 border border-green-500 text-sm font-medium rounded-md text-green-600 bg-white hover:bg-green-50"
              >
                <Users className="h-4 w-4 mr-1.5" />
                Members
              </button>
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
          </div>

          {/* Project Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-blue-600 uppercase">Comparisons</p>
                  <p className="mt-1 text-2xl font-semibold text-gray-900">{summary?.stats.total_comparisons ?? 0}</p>
                </div>
                <Activity className="h-8 w-8 text-blue-600 opacity-20" />
              </div>
            </div>

            <div className="bg-green-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-green-600 uppercase">Datasets</p>
                  <p className="mt-1 text-2xl font-semibold text-gray-900">{summary?.stats.total_datasets ?? 0}</p>
                </div>
                <FileText className="h-8 w-8 text-green-600 opacity-20" />
              </div>
            </div>

            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-purple-600 uppercase">Original Files</p>
                  <p className="mt-1 text-2xl font-semibold text-gray-900">{summary?.stats.original_files_count ?? 0}</p>
                </div>
                <Upload className="h-8 w-8 text-purple-600 opacity-20" />
              </div>
            </div>

            <div className="bg-amber-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-amber-600 uppercase">Status</p>
                  <p className="mt-1 text-sm font-semibold text-gray-900">
                    {(summary?.stats.processing_count ?? 0) > 0 ? 'Processing' : 'Ready'}
                  </p>
                </div>
                {(summary?.stats.processing_count ?? 0) > 0 ? (
                  <Clock className="h-8 w-8 text-amber-600 opacity-20 animate-pulse" />
                ) : (
                  <CheckCircle className="h-8 w-8 text-amber-600 opacity-20" />
                )}
              </div>
            </div>
          </div>

          {/* Original Files List */}
          {(summary?.original_files?.length ?? 0) > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-xs font-medium text-gray-500 uppercase mb-2">Original Files</p>
              <div className="flex flex-wrap gap-2">
                {(summary?.original_files ?? []).map(fileName => (
                  <span
                    key={fileName}
                    className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700"
                  >
                    <FileText className="h-3 w-3 mr-1" />
                    {fileName}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Tabs */}
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
              <button
                onClick={() => setActiveTab('history')}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'history'
                    ? 'border-brand-primary text-brand-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                History
              </button>
              <button
                onClick={() => setActiveTab('stats')}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'stats'
                    ? 'border-brand-primary text-brand-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Statistics
              </button>
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'comparisons' && (
              <ComparisonsTab projectId={projectId} />
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
            
            {/* Left Column: Datasets List */}
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
                    datasets.map((ds) => (
                        <li key={ds.id} className="px-4 py-4 sm:px-6 hover:bg-gray-50">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center">
                            <div className="flex-shrink-0">
                                {ds.type === DatasetType.MATRIX ? <Database className="h-6 w-6 text-brand-primary" /> :
                                (ds.type === DatasetType.METADATA || ds.type === DatasetType.METADATA_SAMPLE || ds.type === DatasetType.METADATA_CONTRAST) ? <FileText className="h-6 w-6 text-brand-secondary" /> :
                                <Activity className="h-6 w-6 text-brand-accent" />}
                            </div>
                            <div className="ml-4">
                                {ds.status === DatasetStatus.READY ? (
                                <Link 
                                    href={`/projects/${projectId}/datasets/${ds.id}`}
                                    className="text-sm font-medium text-brand-primary hover:text-brand-primary/80 hover:underline"
                                >
                                    {ds.name}
                                </Link>
                                ) : (
                                <h4 className="text-sm font-medium text-gray-900">{ds.name}</h4>
                                )}
                                <p className="text-xs text-gray-500">{ds.type} • {new Date(ds.created_at).toLocaleDateString()}</p>
                                {ds.error_message && (
                                <div className="mt-2 rounded-md bg-red-50 p-2 max-w-md">
                                    <div className="flex">
                                    <div className="flex-shrink-0">
                                        <AlertCircle className="h-4 w-4 text-red-400" aria-hidden="true" />
                                    </div>
                                    <div className="ml-3">
                                        <h3 className="text-xs font-medium text-red-800">Processing Error</h3>
                                        <div className="mt-1 text-xs text-red-700 break-words">
                                        <p>{ds.error_message}</p>
                                        </div>
                                    </div>
                                    </div>
                                </div>
                                )}
                            </div>
                            </div>
                            <div className="flex items-center gap-4">
                            <div className="flex items-center">
                                {getStatusIcon(ds.status)}
                                <span className="ml-2 text-sm text-gray-500 capitalize">{ds.status.toLowerCase()}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                {ds.status === DatasetStatus.READY && (
                                <Link
                                    href={`/projects/${projectId}/datasets/${ds.id}`}
                                    className="text-gray-400 hover:text-brand-primary"
                                    title="View Data"
                                >
                                    <Eye className="h-4 w-4" />
                                </Link>
                                )}
                                {canManageData && (
                                <button
                                onClick={() => handleReprocess(ds.id)}
                                className="text-gray-400 hover:text-brand-primary"
                                title="Reprocess Dataset"
                                >
                                <RefreshCw className="h-4 w-4" />
                                </button>
                                )}
                                {canManageData && (
                                <button
                                onClick={() => {
                                    setEditingDataset(ds);
                                    setIsEditModalOpen(true);
                                }}
                                className="text-gray-400 hover:text-brand-primary"
                                title="Edit Dataset"
                                >
                                <Edit2 className="h-4 w-4" />
                                </button>
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

            {/* Right Column: Upload Form */}
            {canManageData && (
            <div>
                <div className="bg-white shadow sm:rounded-lg">
                <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
                    <h3 className="text-lg font-medium leading-6 text-gray-900">Upload Dataset</h3>
                </div>
                <div className="px-4 py-5 sm:p-6">
                    <form onSubmit={handleUpload} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Name</label>
                        <input
                        type="text"
                        required
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-primary focus:ring-brand-primary sm:text-sm border p-2"
                        value={uploadForm.name}
                        onChange={(e) => setUploadForm({...uploadForm, name: e.target.value})}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Type</label>
                        <select
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-primary focus:ring-brand-primary sm:text-sm border p-2"
                        value={uploadForm.type}
                        onChange={(e) => setUploadForm({...uploadForm, type: e.target.value as DatasetType})}
                        >
                        <option value={DatasetType.MATRIX}>Expression Matrix (CSV/TSV)</option>
                        <option value={DatasetType.METADATA_SAMPLE}>Sample Metadata (Description)</option>
                        <option value={DatasetType.METADATA_CONTRAST}>Contrast Metadata</option>
                        <option value={DatasetType.DEG}>Differential Expression (DEG)</option>
                        <option value={DatasetType.ENRICHMENT}>Enrichment Results</option>
                        </select>
                    </div>

                    {(uploadForm.type === DatasetType.DEG || uploadForm.type === DatasetType.ENRICHMENT) && (
                        <div>
                        <label className="block text-sm font-medium text-gray-700">Comparison Name</label>
                        <input
                            type="text"
                            required
                            placeholder="e.g. Treated vs Control"
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-primary focus:ring-brand-primary sm:text-sm border p-2"
                            value={uploadForm.comparison_name}
                            onChange={(e) => setUploadForm({...uploadForm, comparison_name: e.target.value})}
                        />
                        <p className="mt-1 text-xs text-gray-500">Group related DEG and Enrichment files under the same comparison name.</p>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Description</label>
                        <textarea
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-primary focus:ring-brand-primary sm:text-sm border p-2"
                        rows={3}
                        value={uploadForm.description}
                        onChange={(e) => setUploadForm({...uploadForm, description: e.target.value})}
                        />
                    </div>

                    {uploadForm.type === DatasetType.MATRIX && (
                        <div className="space-y-2">
                        <div className="flex items-center">
                            <input
                            type="checkbox"
                            className="h-4 w-4 text-brand-primary focus:ring-brand-primary border-gray-300 rounded"
                            checked={uploadForm.is_normalized}
                            onChange={(e) => setUploadForm({...uploadForm, is_normalized: e.target.checked})}
                            />
                            <label className="ml-2 block text-sm text-gray-900">Data is already normalized</label>
                        </div>
                        <div className="flex items-center">
                            <input
                            type="checkbox"
                            className="h-4 w-4 text-brand-primary focus:ring-brand-primary border-gray-300 rounded"
                            checked={uploadForm.contains_all_genes}
                            onChange={(e) => setUploadForm({...uploadForm, contains_all_genes: e.target.checked})}
                            />
                            <label className="ml-2 block text-sm text-gray-900">Contains all genes (not filtered)</label>
                        </div>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700">File</label>
                        <div 
                          className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md hover:border-brand-primary transition-colors"
                          onDrop={handleDrop}
                          onDragOver={handleDragOver}
                        >
                        <div className="space-y-1 text-center">
                            <Upload className="mx-auto h-12 w-12 text-gray-400" />
                            <div className="flex text-sm text-gray-600">
                            <label className="relative cursor-pointer bg-white rounded-md font-medium text-brand-primary hover:text-brand-primary focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-brand-primary">
                                <span>Upload a file</span>
                                <input type="file" className="sr-only" onChange={handleFileChange} accept=".csv,.tsv,.txt,.xlsx,.xls" />
                            </label>
                            <p className="pl-1">or drag and drop</p>
                            </div>
                            <p className="text-xs text-gray-500">CSV, TSV, Excel up to 500MB</p>
                            {uploadForm.file && (
                            <p className="text-sm text-brand-secondary font-medium mt-2">Selected: {uploadForm.file.name}</p>
                            )}
                        </div>
                        </div>
                    </div>

                    {uploadError && (
                        <div className="rounded-md bg-red-50 p-4">
                        <div className="flex">
                            <div className="flex-shrink-0">
                            <AlertCircle className="h-5 w-5 text-red-400" aria-hidden="true" />
                            </div>
                            <div className="ml-3">
                            <h3 className="text-sm font-medium text-red-800">Upload Error</h3>
                            <div className="mt-2 text-sm text-red-700">
                                <p>{uploadError}</p>
                            </div>
                            </div>
                        </div>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isUploading}
                        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-brand-primary hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary disabled:opacity-50"
                    >
                        {isUploading ? 'Uploading...' : 'Upload Dataset'}
                    </button>
                    </form>
                </div>
                </div>
            </div>
            )}
            </div>
            )}

            {activeTab === 'history' && (
              <ProjectHistory projectId={projectId} />
            )}

            {activeTab === 'stats' && (
              <ProjectStatsDashboard projectId={projectId} />
            )}
          </div>
        </div>
      </div>

      {editingDataset && (
        <EditDatasetModal
          dataset={editingDataset}
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onSuccess={() => { refetchDatasets(); }}
        />
      )}

      {/* Bookmark Manager Modal */}
      {isBookmarkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-4xl h-[80vh] rounded-lg bg-white shadow-xl flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                <Star className="h-5 w-5 mr-2 text-yellow-500" />
                My Bookmarked Genes
              </h2>
              <button
                onClick={() => setIsBookmarkModalOpen(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <span className="sr-only">Close</span>
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <BookmarkManager projectId={projectId} />
            </div>
          </div>
        </div>
      )}

      {/* Gene List Manager Modal */}
      {isGeneListModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-4xl h-[80vh] rounded-lg bg-white shadow-xl flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                <List className="h-5 w-5 mr-2 text-indigo-600" />
                My Gene Lists
              </h2>
              <button
                onClick={() => setIsGeneListModalOpen(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <span className="sr-only">Close</span>
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <GeneListManager projectId={projectId} />
            </div>
          </div>
        </div>
      )}

      {/* Members Modal */}
      {isMembersModalOpen && project && currentUser && (
        <ProjectMembersModal
          projectId={projectId}
          projectOwnerId={project.owner_id}
          currentUserId={currentUser.id}
          isOpen={isMembersModalOpen}
          onClose={() => setIsMembersModalOpen(false)}
        />
      )}
    </div>
  );
}

// Comparisons Tab Component
const PAGE_SIZE = 20;

function ComparisonsTab({
  projectId
}: {
  projectId: string
}) {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useProjectComparisons(projectId, page, PAGE_SIZE);
  const { prefetchComparisonData } = usePrefetchComparisons();
  const { prefetchVolcano, prefetchEnrichment } = usePrefetchVisualizations();

  const comparisons = data?.comparisons ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.total_pages ?? 1;

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <ComparisonCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (total === 0) {
    return (
      <div className="text-center py-12">
        <Activity className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">No comparisons</h3>
        <p className="mt-1 text-sm text-gray-500">Upload DEG datasets to see comparisons here.</p>
      </div>
    );
  }

  const firstItem = (page - 1) * PAGE_SIZE + 1;
  const lastItem = Math.min(page * PAGE_SIZE, total);

  return (
    <div>
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
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                UP
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                DOWN
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
            {comparisons.map((comp) => (
              <tr key={comp.name} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <Activity className="h-5 w-5 text-brand-primary mr-3" />
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {deslugComparisonName(comp.name)}
                      </div>
                      <div className="text-xs text-gray-500 font-mono">{comp.name}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                    {comp.dataset_type === 'GLOBAL' ? 'Global Analysis' : 'Individual File'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-md text-sm font-semibold bg-red-100 text-red-800">
                    {comp.deg_up}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-md text-sm font-semibold bg-blue-100 text-blue-800">
                    {comp.deg_down}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex gap-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                      DEG
                    </span>
                    {comp.has_enrichment && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                        Enrichment
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <Link
                    href={comp.dataset_type === 'GLOBAL'
                      ? `/projects/${projectId}/comparisons/${encodeURIComponent(comp.name)}?datasetId=${comp.dataset_id}`
                      : `/projects/${projectId}/comparisons/${encodeURIComponent(comp.name)}`
                    }
                    onMouseEnter={() => {
                      prefetchComparisonData(comp.dataset_id, comp.name);
                      prefetchVolcano(comp.dataset_id, comp.name);
                      if (comp.has_enrichment) {
                        prefetchEnrichment(comp.dataset_id, comp.name);
                      }
                    }}
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

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 mt-2">
          <p className="text-sm text-gray-700">
            {firstItem}–{lastItem} sur {total} comparaisons
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => p - 1)}
              disabled={page <= 1}
              className="px-3 py-1.5 text-sm font-medium rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Précédent
            </button>
            <span className="px-3 py-1.5 text-sm text-gray-600">
              Page {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= totalPages}
              className="px-3 py-1.5 text-sm font-medium rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Suivant
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// QC Tab Component
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

// PCA Tab Component
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
      <div className="bg-white border border-gray-200 rounded-lg p-6 h-[600px]">
        <h3 className="text-lg font-semibold mb-4">Principal Component Analysis</h3>
        <div className="h-[calc(100%-3rem)]">
          <PCAPlot dataset={matrixDataset} metadataDataset={metadataDataset} />
        </div>
      </div>
      
      <div className="bg-white border border-gray-200 rounded-lg p-6 h-[600px]">
        <h3 className="text-lg font-semibold mb-4">UMAP Dimensionality Reduction</h3>
        <div className="h-[calc(100%-3rem)]">
          <UMAPPlot dataset={matrixDataset} metadataDataset={metadataDataset} />
        </div>
      </div>
    </div>
  );
}




