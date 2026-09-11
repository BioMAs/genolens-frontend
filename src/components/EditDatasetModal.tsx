'use client';

import { useState, useEffect } from 'react';
import { Dataset, DatasetType } from '@/types';
import api from '@/utils/api';
import { X, Trash2 } from 'lucide-react';

interface EditDatasetModalProps {
  dataset: Dataset;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface UpdateDatasetPayload {
  name: string;
  description: string;
  type: DatasetType;
  dataset_metadata: Record<string, boolean>;
}

export default function EditDatasetModal({ dataset, isOpen, onClose, onSuccess }: EditDatasetModalProps) {
  const getBool = (value: unknown, defaultValue: boolean): boolean =>
    typeof value === 'boolean' ? value : defaultValue;

  const [name, setName] = useState(dataset.name);
  const [description, setDescription] = useState(dataset.description || '');
  const [type, setType] = useState<DatasetType>(dataset.type);
  const [isNormalized, setIsNormalized] = useState<boolean>(getBool(dataset.dataset_metadata?.is_normalized, false));
  const [containsAllGenes, setContainsAllGenes] = useState<boolean>(
    getBool(dataset.dataset_metadata?.contains_all_genes, true)
  );
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setName(dataset.name);
      setDescription(dataset.description || '');
      setType(dataset.type);
      setIsNormalized(getBool(dataset.dataset_metadata?.is_normalized, false));
      setContainsAllGenes(getBool(dataset.dataset_metadata?.contains_all_genes, true));
      setShowDeleteConfirm(false);
      setError(null);
    }
  }, [isOpen, dataset]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const updateData: UpdateDatasetPayload = {
        name,
        description,
        type,
        dataset_metadata: {}
      };

      if (type === DatasetType.MATRIX) {
        updateData.dataset_metadata = {
            is_normalized: isNormalized,
            contains_all_genes: containsAllGenes
        };
      }

      await api.patch(`/datasets/${dataset.id}`, updateData);
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Failed to update dataset:', err);
      setError('Failed to update dataset. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);

    try {
      await api.delete(`/datasets/${dataset.id}`);
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Failed to delete dataset:', err);
      setError('Failed to delete dataset. Please try again.');
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-md rounded-lg bg-surface p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-title text-primary">Edit Dataset</h2>
          <button onClick={onClose} className="text-muted hover:text-secondary">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-body-sm font-medium text-primary">Name</label>
            <input
              type="text"
              required
              className="mt-1 block w-full rounded-md border border-strong p-2 shadow-sm focus:border-brand-primary focus:ring-brand-primary sm:text-body-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-body-sm font-medium text-primary">Type</label>
            <select
              className="mt-1 block w-full rounded-md border border-strong p-2 shadow-sm focus:border-brand-primary focus:ring-brand-primary sm:text-body-sm"
              value={type}
              onChange={(e) => setType(e.target.value as DatasetType)}
            >
              <option value={DatasetType.MATRIX}>Expression Matrix (CSV/TSV)</option>
              <option value={DatasetType.METADATA_SAMPLE}>Sample Metadata (Description)</option>
              <option value={DatasetType.METADATA_CONTRAST}>Contrast Metadata</option>
              <option value={DatasetType.DEG}>Differential Expression (DEG)</option>
              <option value={DatasetType.ENRICHMENT}>Enrichment Results</option>
            </select>
          </div>

          <div>
            <label className="block text-body-sm font-medium text-primary">Description</label>
            <textarea
              className="mt-1 block w-full rounded-md border border-strong p-2 shadow-sm focus:border-brand-primary focus:ring-brand-primary sm:text-body-sm"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {type === DatasetType.MATRIX && (
            <div className="space-y-2">
              <div className="flex items-center">
                <input
                  id="edit_is_normalized"
                  type="checkbox"
                  className="h-4 w-4 rounded border-strong text-brand-primary focus:ring-brand-primary"
                  checked={isNormalized}
                  onChange={(e) => setIsNormalized(e.target.checked)}
                />
                <label htmlFor="edit_is_normalized" className="ml-2 block text-body-sm text-primary">
                  Data is normalized (e.g. TPM, FPKM)
                </label>
              </div>
              <div className="flex items-center">
                <input
                  id="edit_contains_all_genes"
                  type="checkbox"
                  className="h-4 w-4 rounded border-strong text-brand-primary focus:ring-brand-primary"
                  checked={containsAllGenes}
                  onChange={(e) => setContainsAllGenes(e.target.checked)}
                />
                <label htmlFor="edit_contains_all_genes" className="ml-2 block text-body-sm text-primary">
                  Contains all genes (Full Genome)
                </label>
              </div>
            </div>
          )}

          {error && <div className="text-body-sm text-red-600">{error}</div>}

          {/* Delete Confirmation */}
          {showDeleteConfirm && (
            <div className="rounded-md bg-red-50 p-4 border border-red-200">
              <div className="flex">
                <div className="flex-1">
                  <h3 className="text-body-sm font-medium text-red-800">Delete Dataset</h3>
                  <div className="mt-2 text-body-sm text-red-700">
                    <p>
                      Are you sure you want to delete this dataset? This action cannot be undone.
                      All associated files and data will be permanently deleted.
                    </p>
                  </div>
                  <div className="mt-4 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(false)}
                      disabled={deleting}
                      className="rounded-md border border-red-300 bg-surface px-3 py-2 text-body-sm font-medium text-red-700 shadow-sm hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={deleting}
                      className="inline-flex items-center gap-2 rounded-md border border-transparent bg-red-600 px-3 py-2 text-body-sm font-medium text-on-accent shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" />
                      {deleting ? 'Deleting...' : 'Delete Dataset'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="mt-6 flex justify-between gap-3">
            {/* Delete button on the left */}
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={loading || deleting || showDeleteConfirm}
              className="inline-flex items-center gap-2 rounded-md border border-red-300 bg-surface px-4 py-2 text-body-sm font-medium text-red-700 shadow-sm hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>

            {/* Action buttons on the right */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={deleting}
                className="rounded-md border border-strong bg-surface px-4 py-2 text-body-sm font-medium text-primary shadow-sm hover:bg-hover focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || deleting || showDeleteConfirm}
                className="inline-flex justify-center rounded-md border border-transparent bg-brand-primary px-4 py-2 text-body-sm font-medium text-on-accent shadow-sm hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
