/**
 * The spine of the reading: five questions, each with its one-line answer, each a link to the part
 * that proves it.
 *
 * jsdom applies no stylesheet, so the look (slate mention, quieter placeholder) is asserted on the
 * classes that carry it; what the spine DOES (order, links, the mention only for the model) is
 * asserted on roles and text.
 */
import { render, screen, within } from '@testing-library/react';
import ReadingSpine from '@/components/reading/ReadingSpine';
import type { Answer, AnswerKey } from '@/components/reading/answers';
import type { ReadingPart } from '@/components/reading/readingRoutes';

const QUESTIONS = [
  'How many genes change?',
  'Which genes matter most?',
  'Which processes move?',
  'What does it mean biologically?',
  'What can you apply it to?',
];

const MENTION = 'Written by the model from answers 1 to 3';

const answers = (over: Partial<Record<AnswerKey, Answer>> = {}): Record<AnswerKey, Answer> => ({
  counts: { text: '274 up and 181 down, of 20000 genes tested', by: 'data' },
  genes: { text: 'IL6 and PTGS2 rise most; KRT1 falls most', by: 'data' },
  processes: { text: 'Inflammatory response rises; epidermis development falls', by: 'data' },
  meaning: { text: 'Inflammation rises while the barrier falls.', by: 'model' },
  applications: { text: 'Barrier claim supported', by: 'data' },
  ...over,
});

const hrefFor = (part: ReadingPart) => `#part-${part}`;

const renderSpine = (over: Partial<Record<AnswerKey, Answer>> = {}) =>
  render(<ReadingSpine answers={answers(over)} hrefFor={hrefFor} />);

const items = () => within(screen.getByRole('list')).getAllByRole('listitem');

describe('ReadingSpine — the five questions', () => {
  it('is an ordered list of five items', () => {
    renderSpine();
    expect(screen.getByRole('list').tagName).toBe('OL');
    expect(items()).toHaveLength(5);
  });

  it('asks the five questions, verbatim, in order', () => {
    renderSpine();
    items().forEach((item, i) => expect(item).toHaveTextContent(QUESTIONS[i]));
  });

  it('shows the answer of each question inside its item', () => {
    renderSpine();
    const a = answers();
    const order: AnswerKey[] = ['counts', 'genes', 'processes', 'meaning', 'applications'];
    order.forEach((key, i) => expect(items()[i]).toHaveTextContent(a[key].text));
  });

  it('links each item to its part, in the order counts, genes, processes, meaning, applications', () => {
    renderSpine();
    const hrefs = items().map((item) => within(item).getByRole('link').getAttribute('href'));
    expect(hrefs).toEqual([
      '#part-counts',
      '#part-genes',
      '#part-processes',
      '#part-meaning',
      '#part-applications',
    ]);
  });

  it('puts the question and the answer in the same link', () => {
    renderSpine();
    const link = screen.getByRole('link', { name: /What does it mean biologically\?/ });
    expect(link).toHaveTextContent('Inflammation rises while the barrier falls.');
  });

  it('numbers each question decoratively, so the link name is the text alone', () => {
    renderSpine();
    const first = items()[0];
    expect(within(first).getByText('1')).toHaveAttribute('aria-hidden', 'true');
    expect(within(first).getByRole('link', { name: /^How many genes change\?/ })).toBeInTheDocument();
  });

  it('asks hrefFor for the part of each question, nothing else', () => {
    const calls: ReadingPart[] = [];
    render(
      <ReadingSpine
        answers={answers()}
        hrefFor={(part) => {
          calls.push(part);
          return `#${part}`;
        }}
      />
    );
    expect(Array.from(new Set(calls))).toEqual([
      'counts',
      'genes',
      'processes',
      'meaning',
      'applications',
    ]);
  });
});

describe('ReadingSpine — who wrote the answer', () => {
  it('says the model wrote answer 4, under it, when it did', () => {
    renderSpine();
    const mention = screen.getByText(MENTION);
    expect(items()[3]).toContainElement(mention);
  });

  it('shows the mention in slate', () => {
    renderSpine();
    expect(screen.getByText(MENTION)).toHaveClass('text-ai');
  });

  it('shows the mention once, and only on the fourth item', () => {
    renderSpine();
    expect(screen.getAllByText(MENTION)).toHaveLength(1);
    items().forEach((item, i) => {
      if (i !== 3) expect(item).not.toHaveTextContent(MENTION);
    });
  });

  it('leaves the mention out while answer 4 is still to be written', () => {
    renderSpine({
      meaning: { text: 'Not written yet: open question 4 to write it', by: 'pending' },
    });
    expect(screen.queryByText(MENTION)).not.toBeInTheDocument();
    expect(items()[3]).toHaveTextContent('Not written yet: open question 4 to write it');
  });

  it('leaves the mention out when answer 4 comes from data', () => {
    renderSpine({ meaning: { text: 'Something computed.', by: 'data' } });
    expect(screen.queryByText(MENTION)).not.toBeInTheDocument();
  });

  it('does not put the mention under the other answers, whatever their source', () => {
    renderSpine({ counts: { text: 'Counting genes…', by: 'pending' } });
    expect(screen.getAllByText(MENTION)).toHaveLength(1);
  });

  it('reads a pending answer quieter than a written one', () => {
    renderSpine({ counts: { text: 'Counting genes…', by: 'pending' } });
    expect(screen.getByText('Counting genes…')).toHaveClass('text-muted');
    expect(screen.getByText('IL6 and PTGS2 rise most; KRT1 falls most')).toHaveClass('text-primary');
  });
});
