import { readFileSync } from 'node:fs';
import path from 'node:path';

import { FlowMarkdown } from '@/shared/blocks/flow/markdown';

/**
 * Renders one of the bundled legal documents (`content/pages/*.mdx`) with the
 * site chrome and the brand substituted for the template placeholders.
 */
export function FlowLegalPage({ file }: { file: string }) {
  const source = readFileSync(
    path.join(process.cwd(), 'content/pages', file),
    'utf8'
  )
    .replaceAll('YourAppName', 'Flow AI Video')
    .replaceAll('your-domain.com', 'flowaivideo.lol')
    .replaceAll('support@your-domain.com', 'support@flowaivideo.lol');

  return (
    <main className="flow-main">
      <div className="flow-container flow-legal">
        <FlowMarkdown source={source} />
      </div>
    </main>
  );
}
