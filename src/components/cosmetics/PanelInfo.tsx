'use client';

import { ReactNode, useEffect, useState } from 'react';
import { Info, X } from 'lucide-react';

interface PanelInfoProps {
  title: string;
  children: ReactNode;
}

/** Small info (ℹ) button that opens a modal explaining a Cosmetics panel. */
export default function PanelInfo({ title, children }: PanelInfoProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="How to read this"
        aria-label={`How to read: ${title}`}
        className="inline-flex h-6 w-6 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
      >
        <Info className="h-4 w-4" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative z-10 max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="mb-3 flex items-start justify-between gap-4">
              <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                {title}
              </h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="-mr-1 -mt-1 inline-flex h-7 w-7 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div
              className="space-y-3 text-sm leading-relaxed [&_b]:font-semibold [&_code]:rounded [&_code]:bg-gray-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[12px] [&_li]:ml-4 [&_li]:list-disc"
              style={{ color: 'var(--text-secondary)' }}
            >
              {children}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
