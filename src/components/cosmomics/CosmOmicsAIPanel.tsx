'use client';

import { useState } from 'react';
import { Loader2, ShieldCheck, Sparkles } from 'lucide-react';
import { useCosmOmicsInterpretation } from '@/hooks/useCosmOmicsNova';
import AIMarkdown from '@/components/ui/AIMarkdown';
import { AI_QUOTA_COPY, aiQuotaMessage, apiErrorMessage, isAiQuotaExhausted } from '@/utils/plan';

interface Props {
  datasetId?: string;
  comparisonName?: string;
  disabled?: boolean;
}

/**
 * AI cosmetic reading of the nova. The model receives the nova itself — claims,
 * pathways for and against, not-linked pathways — never the raw data.
 */
export default function CosmOmicsAIPanel({ datasetId, comparisonName, disabled }: Props) {
  const mutation = useCosmOmicsInterpretation(datasetId, comparisonName);
  const [text, setText] = useState<string | null>(null);

  const generate = (force: boolean) =>
    mutation.mutate(force, {
      onSuccess: (data) => setText(data.interpretation),
    });

  const quotaExhausted = isAiQuotaExhausted(mutation.error);
  const errMsg = mutation.error
    ? quotaExhausted
      ? aiQuotaMessage(mutation.error)
      : apiErrorMessage(mutation.error)
    : null;

  return (
    <div className="gl-card p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-body-sm font-semibold text-primary">
          <Sparkles className="h-4 w-4" style={{ color: '#34B596' }} />
          AI cosmetic reading
        </h3>
        <button
          type="button"
          onClick={() => generate(!!text)}
          disabled={disabled || mutation.isPending}
          className="flex items-center gap-2 rounded-control px-3 py-1.5 text-caption font-medium text-on-accent disabled:opacity-50"
          style={{ background: 'var(--sl-teal-dark, #0f766e)' }}
        >
          {mutation.isPending ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating…
            </>
          ) : text ? (
            'Regenerate'
          ) : (
            'Generate interpretation'
          )}
        </button>
      </div>

      {mutation.isPending && (
        <p className="text-caption text-secondary">
          The AI is reading the pathways for and against each claim — this can take 15–60 seconds.
        </p>
      )}
      {errMsg && quotaExhausted && (
        <p className="text-body-sm text-warning-ink">
          <span className="font-semibold">{AI_QUOTA_COPY.title}.</span> {errMsg}
        </p>
      )}
      {errMsg && !quotaExhausted && <p className="text-body-sm text-danger-ink">{errMsg}</p>}

      {text ? (
        <AIMarkdown text={text} />
      ) : (
        !mutation.isPending && (
          <p className="text-body-sm text-secondary">
            A drafting aid: claim-by-claim narrative, executive summary and regulatory note, grounded on the
            pathways of the nova.
          </p>
        )
      )}

      <div className="mt-4 flex items-start gap-2 border-t border-subtle pt-3 text-micro text-secondary">
        <ShieldCheck className="mt-1 h-3.5 w-3.5 shrink-0" />
        Cosmetic effects only — not medical or therapeutic claims. AI-generated; review before use in communication.
      </div>
    </div>
  );
}
