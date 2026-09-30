import { ReactNode } from 'react';

/**
 * Tiny markdown renderer for the bundled legal pages.
 *
 * The template ships `content/pages/*.mdx` with headings, paragraphs, bullet
 * and numbered lists plus bold/links. Pulling in a full markdown toolchain for
 * that would add a dependency to the runtime image, so the subset is rendered
 * here into the same design tokens as the rest of the site.
 */
function inline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;
  let lastIndex = 0;
  let index = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('**')) {
      nodes.push(
        <strong key={`${keyPrefix}-b-${index}`}>
          {token.slice(2, token.length - 2)}
        </strong>
      );
    } else {
      const linkMatch = /\[([^\]]+)\]\(([^)]+)\)/.exec(token);
      nodes.push(
        <a key={`${keyPrefix}-a-${index}`} href={linkMatch?.[2] ?? '#'}>
          {linkMatch?.[1] ?? token}
        </a>
      );
    }
    lastIndex = match.index + token.length;
    index += 1;
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

export function FlowMarkdown({ source }: { source: string }) {
  const body = source.replace(/^---[\s\S]*?---\n/, '');
  const blocks: ReactNode[] = [];
  const paragraph: string[] = [];
  const list: { ordered: boolean; items: string[] } = {
    ordered: false,
    items: [],
  };

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    const text = paragraph.join(' ');
    blocks.push(<p key={`p-${blocks.length}`}>{inline(text, `p-${blocks.length}`)}</p>);
    paragraph.length = 0;
  };

  const flushList = () => {
    if (list.items.length === 0) return;
    const items = list.items.map((item, index) => (
      <li key={`li-${blocks.length}-${index}`}>{inline(item, `li-${index}`)}</li>
    ));
    blocks.push(
      list.ordered ? (
        <ol key={`ol-${blocks.length}`}>{items}</ol>
      ) : (
        <ul key={`ul-${blocks.length}`}>{items}</ul>
      )
    );
    list.items = [];
  };

  for (const raw of body.split('\n')) {
    const line = raw.trim();
    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }
    if (line.startsWith('## ')) {
      flushParagraph();
      flushList();
      blocks.push(<h2 key={`h2-${blocks.length}`}>{line.slice(3)}</h2>);
      continue;
    }
    if (line.startsWith('### ')) {
      flushParagraph();
      flushList();
      blocks.push(<h3 key={`h3-${blocks.length}`}>{line.slice(4)}</h3>);
      continue;
    }
    const bullet = /^[-*]\s+(.*)$/.exec(line);
    if (bullet) {
      flushParagraph();
      if (list.ordered) flushList();
      list.ordered = false;
      list.items.push(bullet[1]);
      continue;
    }
    const numbered = /^\d+\.\s+(.*)$/.exec(line);
    if (numbered) {
      flushParagraph();
      if (!list.ordered) flushList();
      list.ordered = true;
      list.items.push(numbered[1]);
      continue;
    }
    flushList();
    paragraph.push(line);
  }
  flushParagraph();
  flushList();

  return <div className="flow-legal-copy">{blocks}</div>;
}
