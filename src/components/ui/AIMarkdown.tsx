import * as React from 'react';

/**
 * AIMarkdown — minimal, dependency-free renderer for AI-generated text.
 * Supports: `##`/`###` headings, `**bold**`, `*italic*`, `` `code` ``,
 * unordered lists (`-`/`*`), and paragraphs. Styled entirely via design
 * tokens so it adapts to light/dark mode.
 *
 * Shared by the AI interpretation/dialogue surfaces (AIInterpretationPanel,
 * AIChartAssistant, CosmeticsAIPanel).
 */

/** Render inline spans: **bold**, *italic*, `code`. */
function renderInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*|`([^`]+?)`|\*(.+?)\*)/g;
  let lastIndex = 0;
  let key = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    if (match[2] !== undefined) {
      nodes.push(<strong key={key++}>{match[2]}</strong>);
    } else if (match[3] !== undefined) {
      nodes.push(
        <code key={key++} className="gene-symbol">
          {match[3]}
        </code>
      );
    } else if (match[4] !== undefined) {
      nodes.push(<em key={key++}>{match[4]}</em>);
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }
  return nodes;
}

interface AIMarkdownProps {
  text: string;
  className?: string;
}

export default function AIMarkdown({ text, className = '' }: AIMarkdownProps) {
  const lines = text.split('\n');
  const blocks: React.ReactNode[] = [];
  let listItems: string[] = [];
  let paragraph: string[] = [];
  let key = 0;

  const flushList = () => {
    if (listItems.length === 0) return;
    const items = listItems;
    listItems = [];
    blocks.push(
      <ul key={key++} className="list-disc space-y-1 pl-5">
        {items.map((item, i) => (
          <li key={i}>{renderInline(item)}</li>
        ))}
      </ul>
    );
  };

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    const content = paragraph.join(' ');
    paragraph = [];
    blocks.push(<p key={key++}>{renderInline(content)}</p>);
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (trimmed === '') {
      flushParagraph();
      flushList();
      continue;
    }

    const headingMatch = /^(#{2,3})\s+(.*)$/.exec(trimmed);
    if (headingMatch) {
      flushParagraph();
      flushList();
      const level = headingMatch[1].length;
      const content = headingMatch[2];
      blocks.push(
        level === 2 ? (
          <h4
            key={key++}
            className="mt-2 text-sm font-semibold"
            style={{ color: 'var(--text-primary)' }}
          >
            {renderInline(content)}
          </h4>
        ) : (
          <h5
            key={key++}
            className="mt-1 text-[13px] font-semibold"
            style={{ color: 'var(--text-primary)' }}
          >
            {renderInline(content)}
          </h5>
        )
      );
      continue;
    }

    const listMatch = /^[-*]\s+(.*)$/.exec(trimmed);
    if (listMatch) {
      flushParagraph();
      listItems.push(listMatch[1]);
      continue;
    }

    // Regular text line — accumulate into the current paragraph.
    flushList();
    paragraph.push(trimmed);
  }

  flushParagraph();
  flushList();

  return (
    <div
      className={`space-y-3 text-sm leading-relaxed ${className}`}
      style={{ color: 'var(--text-primary)' }}
    >
      {blocks}
    </div>
  );
}
