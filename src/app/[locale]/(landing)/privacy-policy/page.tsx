import { setRequestLocale } from 'next-intl/server';

import { FlowLegalPage } from '@/shared/blocks/flow/legal-page';
import { getMetadata } from '@/shared/lib/seo';

export const generateMetadata = getMetadata({
  title: 'Privacy Policy',
  description:
    'How Flow AI Video collects, uses and protects your personal information.',
  canonicalUrl: '/privacy-policy',
});

export default async function PrivacyPolicyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <FlowLegalPage file="privacy-policy.mdx" />;
}
