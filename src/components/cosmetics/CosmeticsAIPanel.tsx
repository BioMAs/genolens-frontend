'use client';

import { useState } from 'react';
import { Sparkles, Loader2, ShieldCheck } from 'lucide-react';
import { useCosmeticsInterpretation } from '@/hooks/useCosmetics';

/** Minimal markdown renderer: ## headings, **bold**, paragraphs. */
function Markdown({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <div className="space-y-3 text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>
      {blocks.map((block, i) => {
        if (block.startsWith('## ')) {
          return (
            <h4 key={i} className="text-sm font-bold mt-2" style={{ color: 'var(--sl-teal-dark, #0f766e)' }}>
              {block.replace(/^##\s+/, '')}
            </h4>
          );
        }
        const html = block.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        return <p key={i} dangerouslySetInnerHTML={{ __html: html }} />;
      })}
    </div>
  );
}

interface Props {
  datasetId?: string;
  comparisonName?: string;
  /** When provided (locked teaser), render this text instead of calling the API. */
  demoText?: string;
  disabled?: boolean;
}

export default function CosmeticsAIPanel({ datasetId, comparisonName, demoText, disabled }: Props) {
  const mutation = useCosmeticsInterpretation(datasetId, comparisonName);
  const [text, setText] = useState<string | null>(demoText ?? null);

  const handleGenerate = () => {
    mutation.mutate(false, {
      onSuccess: (data) => setText(data.interpretation),
    });
  };

  const errMsg =
    mutation.error && typeof mutation.error === 'object' && 'response' in mutation.error
      ? // @ts-expect-error axios error shape
        mutation.error.response?.data?.detail
      : null;

  return (
    <div className="gl-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          <Sparkles className="h-4 w-4" style={{ color: '#db2777' }} />
          AI cosmetic interpretation
        </h3>
        {!demoText && (
          <button
            onClick={handleGenerate}
            disabled={disabled || mutation.isPending}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
            style={{ background: 'var(--sl-teal-dark, #0f766e)' }}
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating…
              </>
            ) : (
              <>{text ? 'Regenerate' : 'Generate interpretation'}</>
            )}
          </button>
        )}
      </div>

      {mutation.isPending && (
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          The AI is analyzing the claim profile — this can take 15–60 seconds.
        </p>
      )}

      {errMsg && (
        <p className="text-sm text-red-600">{String(errMsg)}</p>
      )}

      {text ? (
        <Markdown text={text} />
      ) : (
        !mutation.isPending && (
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Generate an AI-written, marketing-oriented summary of this comparison&apos;s effect on the skin.
          </p>
        )
      )}

      <div className="mt-4 flex items-start gap-1.5 border-t pt-3 text-[11px]" style={{ color: 'var(--text-secondary)', borderColor: 'var(--border-subtle, #e5e7eb)' }}>
        <ShieldCheck className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        Cosmetic effects only — not medical or therapeutic claims. AI-generated; review before use in communication.
      </div>
    </div>
  );
}
