'use client';

import { useRef, useState } from 'react';
import { Upload, Trash2, Plus } from 'lucide-react';
import {
  useCustomGeneSets,
  useCreateCustomGeneSet,
  useUploadGmt,
  useDeleteCustomGeneSet,
} from '@/hooks/useGeneSets';

interface CustomGeneSetManagerProps {
  projectId: string;
}

interface ApiErrorShape {
  response?: { data?: { detail?: unknown } };
}

function errMsg(err: unknown, fallback: string): string {
  const detail = (err as ApiErrorShape)?.response?.data?.detail;
  return typeof detail === 'string' ? detail : fallback;
}

export default function CustomGeneSetManager({ projectId }: CustomGeneSetManagerProps) {
  const { data: sets, isLoading } = useCustomGeneSets(projectId);
  const createMut = useCreateCustomGeneSet(projectId);
  const uploadMut = useUploadGmt(projectId);
  const deleteMut = useDeleteCustomGeneSet(projectId);

  const [name, setName] = useState('');
  const [pasted, setPasted] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const parsedGenes = pasted.split(/[\s,;]+/).map((g) => g.trim()).filter(Boolean);

  const handleCreate = async () => {
    setError(null);
    setNotice(null);
    try {
      await createMut.mutateAsync({ name: name.trim(), genes: parsedGenes });
      setName('');
      setPasted('');
      setNotice('Gene set created.');
    } catch (err) {
      setError(errMsg(err, 'Failed to create gene set'));
    }
  };

  const handleUpload = async (file: File) => {
    setError(null);
    setNotice(null);
    try {
      const res = await uploadMut.mutateAsync(file);
      setNotice(`Imported ${res.created} new / ${res.updated} updated gene set(s).`);
    } catch (err) {
      setError(errMsg(err, 'Failed to upload GMT'));
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-600">
        Custom gene sets are scoped to this project. Use them in GSEA (pick the
        &quot;Custom&quot; database) or test them for over-representation.
      </p>

      {/* Create from paste */}
      <div className="border border-gray-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-1.5">
          <Plus className="h-4 w-4" /> Create from pasted genes
        </h3>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Gene set name (e.g. My proliferation signature)"
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm mb-2"
        />
        <textarea
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          placeholder="Paste gene symbols separated by spaces, commas, or newlines…"
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono"
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-gray-500">{parsedGenes.length} genes</span>
          <button
            onClick={handleCreate}
            disabled={createMut.isPending || !name.trim() || parsedGenes.length === 0}
            className="inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium text-white bg-brand-primary hover:bg-brand-primary/90 disabled:opacity-50"
          >
            {createMut.isPending ? 'Creating…' : 'Create gene set'}
          </button>
        </div>
      </div>

      {/* Upload GMT */}
      <div className="border border-gray-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-1.5">
          <Upload className="h-4 w-4" /> Import a GMT file
        </h3>
        <input
          ref={fileRef}
          type="file"
          accept=".gmt,.txt"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleUpload(f);
          }}
          className="block w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
        />
        <p className="mt-1 text-xs text-gray-500">
          GMT format: one set per line — name &lt;tab&gt; description &lt;tab&gt; gene1 &lt;tab&gt; gene2 …
        </p>
        {uploadMut.isPending && <p className="mt-1 text-xs text-blue-600">Uploading…</p>}
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>
      )}
      {notice && (
        <div className="p-3 bg-green-50 border border-green-200 rounded text-green-700 text-sm">{notice}</div>
      )}

      {/* Existing sets */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-2">
          Project gene sets{sets ? ` (${sets.length})` : ''}
        </h3>
        {isLoading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : !sets || sets.length === 0 ? (
          <p className="text-sm text-gray-500">No custom gene sets yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100 border border-gray-200 rounded-lg">
            {sets.map((gs) => (
              <li key={gs.id} className="flex items-center justify-between px-4 py-2.5">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">{gs.name}</div>
                  <div className="text-xs text-gray-500">{gs.size} genes</div>
                </div>
                <button
                  onClick={() => deleteMut.mutate(gs.id)}
                  disabled={deleteMut.isPending}
                  className="ml-3 p-1.5 text-gray-400 hover:text-red-600 disabled:opacity-50"
                  title="Delete gene set"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
