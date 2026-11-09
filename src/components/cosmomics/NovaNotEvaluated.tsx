import { NOT_EVALUATED_TEXT } from './novaText';

/**
 * The claims of the referential that have no significant term in this comparison.
 * They are not "unsupported": nothing was evaluated for them, and the list says so.
 */
export default function NovaNotEvaluated({ names }: { names?: string[] }) {
  if (!names?.length) return null;
  return (
    <section aria-label="Claims not evaluated" className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--nova-ink-subtle)]">Not evaluated</p>
      <ul className="flex flex-wrap gap-2">
        {names.map((name) => (
          <li
            key={name}
            className="rounded-pill border border-dashed border-[var(--nova-line)] px-2.5 py-1 text-[12px] text-[var(--nova-ink-muted)]"
          >
            {name}
          </li>
        ))}
      </ul>
      <p className="text-[11.5px] leading-snug text-[var(--nova-ink-subtle)]">{NOT_EVALUATED_TEXT}</p>
    </section>
  );
}
