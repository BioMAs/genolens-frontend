import Link from 'next/link';
import { cn } from '@/lib/cn';
import type { Answer, AnswerKey } from './answers';
import type { ReadingPart } from './readingRoutes';

interface ReadingSpineProps {
  answers: Record<AnswerKey, Answer>;
  /** Où mène la partie : un fragment de la page de lecture, ou un chemin complet. */
  hrefFor: (part: ReadingPart) => string;
}

/** Les cinq questions, dans l'ordre de la lecture ; chacune ouvre la partie qui la démontre. */
const QUESTIONS: ReadonlyArray<{ part: AnswerKey; number: number; question: string }> = [
  { part: 'counts', number: 1, question: 'How many genes change?' },
  { part: 'genes', number: 2, question: 'Which genes matter most?' },
  { part: 'processes', number: 3, question: 'Which processes move?' },
  { part: 'meaning', number: 4, question: 'What does it mean biologically?' },
  { part: 'applications', number: 5, question: 'What can you apply it to?' },
];

const MODEL_MENTION = 'Written by the model from answers 1 to 3';

/**
 * La colonne vertébrale de la lecture : cinq questions, la réponse en une ligne sous chacune.
 *
 * Chaque ligne est un seul lien, question et réponse ensemble, vers la partie qui la démontre : la
 * réponse est lue d'abord, la preuve est à un clic. La question reste petite et discrète, la
 * réponse prend la taille d'un titre mais garde la police du corps (Newsreader est réservée aux
 * h1 / h2).
 *
 * Une réponse `pending` est une phrase de remplacement (« Not written yet… ») : elle se lit plus
 * bas, en gris. Seule la réponse 4 peut venir du modèle ; quand c'est le cas, une mention en
 * ardoise le dit sous elle — l'ardoise est ce que GenoLens a écrit, jamais une réponse de plus.
 * Le numéro est décoratif (`aria-hidden`) : la liste ordonnée le porte déjà pour les lecteurs
 * d'écran, et le nom du lien reste la question suivie de la réponse.
 */
export default function ReadingSpine({ answers, hrefFor }: ReadingSpineProps) {
  return (
    <ol className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
      {QUESTIONS.map(({ part, number, question }) => {
        const answer = answers[part];
        return (
          <li key={part}>
            <Link
              href={hrefFor(part)}
              className="block px-5 py-4 transition-colors hover:bg-surface-2 motion-reduce:transition-none"
            >
              <span className="flex items-baseline gap-2 text-caption text-secondary">
                <span aria-hidden className="w-3 shrink-0 text-center font-mono text-micro tabular-nums">
                  {number}
                </span>
                <span>{question}</span>
              </span>
              <span
                className={cn(
                  'mt-1 block text-heading',
                  answer.by === 'pending' ? 'text-muted' : 'text-primary',
                )}
              >
                {answer.text}
              </span>
              {part === 'meaning' && answer.by === 'model' && (
                <span className="mt-1 block text-caption text-ai">{MODEL_MENTION}</span>
              )}
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
