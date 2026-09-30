import { getTranslations, setRequestLocale } from 'next-intl/server';

import { getMetadata } from '@/shared/lib/seo';
import { getCurrentSubscription } from '@/shared/models/subscription';
import { getUserInfo } from '@/shared/models/user';
import { Faq } from '@/themes/default/blocks/faq';
import { Pricing } from '@/themes/default/blocks/pricing';
import {
  FlowPricingHero,
  FlowSupportCta,
} from '@/shared/blocks/flow/site';

export const revalidate = 3600;

export const generateMetadata = getMetadata({
  metadataKey: 'pages.pricing.metadata',
  canonicalUrl: '/pricing',
});

/**
 * Pricing page.
 *
 * The plan table, the payment dialog and the FAQ block are the template's own
 * components; the copy is the reference site's (Basic / Professional /
 * Enterprise, monthly, annual and one-time credit packs) so the page reads the
 * same as the landing page.
 */
export default async function PricingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  let currentSubscription;
  try {
    const user = await getUserInfo();
    if (user) {
      currentSubscription = await getCurrentSubscription(user.id);
    }
  } catch (error) {
    console.log('getting current subscription failed:', error);
  }

  const t = await getTranslations('pages.pricing');
  const pricing = t.raw('page.sections.pricing');
  const faq = t.raw('page.sections.faq');

  return (
    <main className="flow-main pt-10">
      <h1 className="sr-only">{pricing.title}</h1>
      <div className="flow-container mb-6 flex flex-wrap items-center justify-center gap-2">
        {['Text to Video', 'Image to Video', 'Reference to Video'].map((tab) => (
          <a className="flow-eyebrow" href="/#studio" key={tab}>
            {tab}
          </a>
        ))}
      </div>
      <FlowPricingHero section={pricing} />
      <Pricing section={pricing} currentSubscription={currentSubscription} />
      <Faq section={faq} />
      <section className="flow-section pt-0">
        <div className="flow-container">
          <p className="flow-notice">
            Pay safely and securely with Stripe · Cancel subscription, please
            contact the support email: support@flowaivideo.lol
          </p>
          <FlowSupportCta
            title="Have more questions? We're here to help"
            description="Can't find the answer you're looking for? Our support team is ready to assist you."
          />
        </div>
      </section>
    </main>
  );
}
