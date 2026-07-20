'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useDatasetQuery } from '@/hooks/useDatasets';
import { DatasetType } from '@/types';
import api from '@/utils/api';
import {
  Plus, Trash2, ArrowRight, AlertCircle, Clock, CheckCircle, Wand2,
} from 'lucide-react';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';

// Column-name aliases used to auto-detect the grouping (condition) column and to
// skip obvious sample-identifier columns. Kept in sync with the R pipeline's
// condition aliases (run_multimethod_pipeline.R).
const CONDITION_ALIASES = ['condition', 'group', 'groupe', 'treatment', 'genotype'];
const SAMPLE_ID_ALIASES = ['sample', 'sample_id', 'sampleid', 'id', 'name'];

interface ComparisonRow {
  id: string;
  condition1: string; // test / numerator
  condition2: string; // reference / denominator
  name: string;
  nameEdited: boolean;
}

interface ContrastBuilderProps {
  projectId: string;
  /** Sample-sheet dataset id (METADATA_SAMPLE). */
  samplesDatasetId: string | null;
  /** Whether the sample sheet has finished processing (READY). */
  samplesReady: boolean;
  /** Called with the id of the freshly created METADATA_CONTRAST dataset. */
  onBuilt: (datasetId: string) => void;
}

let _rowSeq = 0;
const nextRowId = () => `cmp-${Date.now()}-${_rowSeq++}`;

/** Sanitise a TSV field: strip tabs/newlines that would break column parsing. */
function tsvField(value: string): string {
  return value.replace(/[\t\r\n]+/g, ' ').trim();
}

export default function ContrastBuilder({
  projectId,
  samplesDatasetId,
  samplesReady,
  onBuilt,
}: ContrastBuilderProps) {
  const enabled = !!samplesDatasetId && samplesReady;
  const { data, isLoading, isError } = useDatasetQuery(samplesDatasetId ?? '', 10000, enabled);

  const columns = useMemo(() => data?.columns ?? [], [data]);
  const rows = useMemo(() => data?.data ?? [], [data]);

  const [conditionColumn, setConditionColumn] = useState<string>('');
  const [comparisons, setComparisons] = useState<ComparisonRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Auto-detect the condition column once columns are known (user can override).
  useEffect(() => {
    if (!columns.length || conditionColumn) return;
    const byAlias = columns.find((c) => CONDITION_ALIASES.includes(c.toLowerCase()));
    const nonId = columns.find((c) => !SAMPLE_ID_ALIASES.includes(c.toLowerCase()));
    setConditionColumn(byAlias ?? nonId ?? columns[0]);
  }, [columns, conditionColumn]);

  // Unique, non-empty condition values (order preserved, case untouched — must match R).
  const conditionValues = useMemo(() => {
    if (!conditionColumn) return [] as string[];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const row of rows) {
      const raw = row[conditionColumn];
      if (raw === null || raw === undefined) continue;
      const v = String(raw).trim();
      if (!v || seen.has(v)) continue;
      seen.add(v);
      out.push(v);
    }
    return out;
  }, [rows, conditionColumn]);

  // Seed a first empty comparison row once condition values are available; reset when
  // the user switches condition column (previous selections are no longer valid).
  useEffect(() => {
    setComparisons([{ id: nextRowId(), condition1: '', condition2: '', name: '', nameEdited: false }]);
  }, [conditionColumn]);

  const patchRow = (id: string, patch: Partial<ComparisonRow>) => {
    setComparisons((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const next = { ...r, ...patch };
        // Auto-suggest the comparison name from the two conditions until the user
        // edits it manually.
        if (!next.nameEdited && next.condition1 && next.condition2) {
          next.name = `${next.condition1}_vs_${next.condition2}`;
        }
        return next;
      })
    );
  };

  const addRow = () =>
    setComparisons((prev) => [
      ...prev,
      { id: nextRowId(), condition1: '', condition2: '', name: '', nameEdited: false },
    ]);

  const removeRow = (id: string) =>
    setComparisons((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));

  // ── Validation ────────────────────────────────────────────────────────────
  const validationError = useMemo(() => {
    const filled = comparisons.filter((r) => r.condition1 || r.condition2 || r.name);
    if (filled.length === 0) return 'Add at least one comparison.';
    const names = new Set<string>();
    for (const r of comparisons) {
      if (!r.condition1 || !r.condition2) return 'Each comparison needs a test and a reference condition.';
      if (r.condition1 === r.condition2) return 'Test and reference conditions must differ.';
      const name = r.name.trim();
      if (!name) return 'Each comparison needs a name.';
      if (names.has(name)) return `Duplicate comparison name: "${name}".`;
      names.add(name);
    }
    return null;
  }, [comparisons]);

  const handleConfirm = async () => {
    if (validationError || !samplesDatasetId) return;
    setUploadError(null);
    setUploading(true);
    try {
      // TSV — the R DEA pipeline reads inputs with read_tsv; commas commonly
      // appear inside GEO condition values (e.g. "SARS-CoV-2, MOI = 1.0").
      const header = 'comparison\tcondition1\tcondition2';
      const lines = comparisons.map(
        (r) => `${tsvField(r.name.trim())}\t${tsvField(r.condition1)}\t${tsvField(r.condition2)}`
      );
      const tsv = [header, ...lines].join('\n') + '\n';
      const file = new File([tsv], 'contrasts.tsv', { type: 'text/tab-separated-values' });

      const form = new FormData();
      form.append('file', file);
      form.append('name', 'Contrast File');
      form.append('dataset_type', DatasetType.METADATA_CONTRAST);
      form.append('project_id', projectId);

      const res = await api.post<{ dataset_id: string }>('/datasets/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onBuilt(res.data.dataset_id);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
      const msg = Array.isArray(detail)
        ? detail.map((d: { msg?: string }) => d.msg ?? JSON.stringify(d)).join('; ')
        : typeof detail === 'string'
          ? detail
          : 'Could not create the comparison file. Please try again.';
      setUploadError(msg);
    } finally {
      setUploading(false);
    }
  };

  // ── States before the builder is usable ─────────────────────────────────────
  if (!enabled) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
        Upload and process the <span className="font-medium">Sample Metadata</span> file first —
        its conditions will populate the comparison builder.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-6 text-sm text-gray-500">
        <Clock className="h-4 w-4 animate-spin text-indigo-400" />
        Reading conditions from the sample sheet…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
        <AlertCircle className="h-4 w-4 shrink-0" />
        Could not read the sample sheet. Try re-uploading it, or upload a contrast file instead.
      </div>
    );
  }

  if (conditionValues.length < 2) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
        <div>
          <p>
            The column <span className="font-medium">{conditionColumn || '—'}</span> has fewer than
            two distinct conditions, so no comparison can be built.
          </p>
          {columns.length > 1 && (
            <div className="mt-3 max-w-xs">
              <label className="block text-xs font-medium text-amber-800 mb-1">Grouping column</label>
              <Select value={conditionColumn} onValueChange={setConditionColumn}>
                <SelectTrigger><SelectValue placeholder="Choose a column" /></SelectTrigger>
                <SelectContent>
                  {columns.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Builder ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <Wand2 className="h-4 w-4 text-indigo-500" />
        <h3 className="text-sm font-semibold text-gray-800">Build comparisons from conditions</h3>
      </div>

      {/* Grouping column selector */}
      <div className="max-w-xs">
        <label className="block text-xs font-medium text-gray-600 mb-1">Grouping (condition) column</label>
        <Select value={conditionColumn} onValueChange={setConditionColumn}>
          <SelectTrigger><SelectValue placeholder="Choose a column" /></SelectTrigger>
          <SelectContent>
            {columns.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <p className="mt-1 text-[11px] text-gray-400">
          {conditionValues.length} conditions detected: {conditionValues.join(', ')}
        </p>
      </div>

      {/* Comparison rows */}
      <div className="space-y-3">
        {/* Header (desktop) */}
        <div className="hidden sm:grid grid-cols-[1fr_auto_1fr_1.2fr_auto] items-center gap-2 px-1 text-[11px] font-medium uppercase tracking-wide text-gray-400">
          <span>Test condition</span>
          <span className="px-2" />
          <span>Reference condition</span>
          <span>Comparison name</span>
          <span />
        </div>

        {comparisons.map((row) => (
          <div
            key={row.id}
            className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr_1.2fr_auto] items-center gap-2 rounded-md border border-gray-100 bg-gray-50/60 p-2 sm:border-0 sm:bg-transparent sm:p-0"
          >
            <Select value={row.condition1} onValueChange={(v) => patchRow(row.id, { condition1: v })}>
              <SelectTrigger><SelectValue placeholder="Test…" /></SelectTrigger>
              <SelectContent>
                {conditionValues.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
              </SelectContent>
            </Select>

            <span className="hidden sm:flex justify-center text-gray-400">
              <ArrowRight className="h-4 w-4" />
            </span>

            <Select value={row.condition2} onValueChange={(v) => patchRow(row.id, { condition2: v })}>
              <SelectTrigger><SelectValue placeholder="Reference…" /></SelectTrigger>
              <SelectContent>
                {conditionValues.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
              </SelectContent>
            </Select>

            <input
              type="text"
              value={row.name}
              placeholder="Comparison name"
              onChange={(e) => patchRow(row.id, { name: e.target.value, nameEdited: true })}
              className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-1"
            />

            <button
              type="button"
              onClick={() => removeRow(row.id)}
              disabled={comparisons.length === 1}
              className="justify-self-end rounded-md p-2 text-gray-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Remove comparison"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addRow}
        className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-indigo-300 hover:text-indigo-600"
      >
        <Plus className="h-3.5 w-3.5" />
        Add a comparison
      </button>

      {/* Errors + confirm */}
      <div className="flex items-center justify-between gap-3 pt-1">
        <p className="text-xs text-red-600">{uploadError ?? ''}</p>
        <div className="flex items-center gap-3">
          {validationError && (
            <span className="text-[11px] text-gray-400">{validationError}</span>
          )}
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!!validationError || uploading}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {uploading ? (
              <><Clock className="h-4 w-4 animate-spin" /> Creating…</>
            ) : (
              <><CheckCircle className="h-4 w-4" /> Use these comparisons</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
