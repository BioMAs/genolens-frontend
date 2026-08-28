import Image from 'next/image';

/**
 * GenoLens lockup for logged-out screens.
 *
 * public/logo.png is NOT transparent — it carries an opaque white matte, which
 * is why the old login wrapped it in a white pill: the pill was hiding the
 * matte, not styling it. So on any coloured ground we compose the lockup
 * ourselves from genolensLoupe.png (genuinely transparent, 1080×1080) plus
 * typeset text in the app's display face.
 */

type Tone = 'onBrand' | 'onSurface';

const SIZES = {
  sm: { mark: 28, word: 'text-[15px]', sub: 'text-[9px]', gap: 'gap-2.5' },
  md: { mark: 36, word: 'text-[19px]', sub: 'text-[10px]', gap: 'gap-3' },
} as const;

export default function BrandLockup({
  tone = 'onSurface',
  size = 'md',
  className = '',
}: {
  tone?: Tone;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const s = SIZES[size];
  const word = tone === 'onBrand' ? 'var(--auth-on-brand)' : 'var(--auth-text)';
  const sub = tone === 'onBrand' ? 'var(--auth-on-brand-2)' : 'var(--auth-muted)';

  return (
    <span className={`inline-flex items-center ${s.gap} ${className}`}>
      <Image
        src="/genolensLoupe.png"
        alt=""
        width={s.mark}
        height={s.mark}
        priority
        className="block flex-shrink-0"
      />
      <span className="flex flex-col leading-none">
        <span
          className={`font-display font-semibold ${s.word}`}
          style={{ color: word, letterSpacing: '-0.02em' }}
        >
          GenoLens
        </span>
        <span
          className={`font-semibold uppercase ${s.sub} mt-1`}
          style={{ color: sub, letterSpacing: '0.14em' }}
        >
          By SciLicium
        </span>
      </span>
      <span className="sr-only">GenoLens by SciLicium</span>
    </span>
  );
}
