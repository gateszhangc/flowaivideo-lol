import { setRequestLocale, getTranslations } from 'next-intl/server';

import { getMetadata } from '@/shared/lib/seo';

import {
  FlowFaq,
  FlowFeatures,
  FlowHero,
  FlowPricingSummary,
  FlowShowcase,
  FlowStats,
  FlowSteps,
  FlowTransformations,
} from '@/shared/blocks/flow/site';
import { FlowStructuredData } from '@/shared/blocks/flow/structured-data';

export const revalidate = 3600;

export const generateMetadata = getMetadata({
  metadataKey: 'pages.index.metadata',
  canonicalUrl: '/',
});

/**
 * Flow AI Video landing page.
 *
 * The chrome (header, footer, sign-in dialog) and the reusable content blocks
 * come from the ShipAny template; the copy comes from
 * `src/config/locale/messages/en/pages/index.json`, which is generated from the
 * reference site snapshot by `scripts/flow-reference/build-content.mjs`.
 * `pnpm check:fidelity` fails if any reference line is missing here.
 */
export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('pages.index');
  const page = t.raw('page');
  const sections = page.sections;

  return (
    <main id="home" className="flow-main">
      <FlowStructuredData faq={sections.faq} />

      <FlowHero hero={sections.hero} studio={sections.studio} />
      <FlowShowcase section={sections.showcase} />
      <FlowTransformations section={sections.transformations} />
      <FlowFeatures section={sections.features} />
      <FlowSteps section={sections.how_it_works} />
      <FlowPricingSummary section={sections.pricing} />
      <FlowStats section={sections.stats} />
      <FlowFaq section={sections.faq} />

      <section className="flow-section" id={sections.cta.id}>
        <div className="flow-container">
          <div className="flow-transformation-cta">
            <h3 className="text-2xl md:text-3xl">{sections.cta.title}</h3>
            <p>{sections.cta.description}</p>
            <a className="flow-generate mx-auto mt-4 max-w-xs" href="/pricing">
              {sections.cta.buttons[0].title}
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
