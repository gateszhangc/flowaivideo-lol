import { setRequestLocale } from 'next-intl/server';

import { FlowLegalPage } from '@/shared/blocks/flow/legal-page';
import { getMetadata } from '@/shared/lib/seo';

export const generateMetadata = getMetadata({
  title: 'Terms of Service',
  description:
    'The terms that govern your use of Flow AI Video and its video generation tools.',
  canonicalUrl: '/terms-of-service',
});

export default async function TermsOfServicePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <FlowLegalPage file="terms-of-service.mdx" />;
}
