import { envConfigs } from '@/config';

/**
 * JSON-LD for the landing page: Organization, WebSite, SoftwareApplication and
 * the FAQ answers that are rendered further down the page. Mirrors the
 * structured data the reference site publishes.
 */
export function FlowStructuredData({
  faq,
}: {
  faq: { items: { question: string; answer: string }[] };
}) {
  const appUrl = (envConfigs.app_url || 'https://flowaivideo.lol').replace(/\/$/, '');
  const name = envConfigs.app_name || 'Flow AI Video';

  const data = [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name,
      url: appUrl,
      logo: `${appUrl}/logo.png`,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name,
      url: appUrl,
      potentialAction: {
        '@type': 'SearchAction',
        target: `${appUrl}/?q={search_term_string}`,
        'query-input': 'required name=search_term_string',
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name,
      applicationCategory: 'MultimediaApplication',
      operatingSystem: 'Web',
      url: appUrl,
      offers: {
        '@type': 'Offer',
        price: '9.9',
        priceCurrency: 'USD',
        url: `${appUrl}/pricing`,
      },
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: '4.9',
        ratingCount: '1280',
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: (faq?.items ?? []).map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: { '@type': 'Answer', text: item.answer },
      })),
    },
  ];

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
