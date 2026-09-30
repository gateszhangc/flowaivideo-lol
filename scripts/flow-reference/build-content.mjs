#!/usr/bin/env node
/**
 * Turn the imported reference snapshot into the app's locale content.
 *
 * `content/flow/home.messages.json` and `content/flow/pricing.messages.json`
 * are the reference app's own next-intl dictionaries (captured by
 * `import.mjs`), so the generated pages keep the reference wording verbatim.
 *
 *   node scripts/flow-reference/build-content.mjs
 *
 * Writes:
 *   src/config/locale/messages/en/pages/index.json
 *   src/config/locale/messages/en/pages/pricing.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

const read = (file) => JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
const write = (file, value) => {
  const target = path.join(ROOT, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
};

const home = read('content/flow/home.messages.json');
const pricingMessages = read('content/flow/pricing.messages.json');
const assets = read('content/flow/assets.json');
const snapshot = read('content/flow/home.json');

const clean = (value) => (typeof value === 'string' ? value.replace(/\$\$/g, '$') : value);

const STUDIO_VIDEOS = [
  '/video/home/seedance2-video1.mp4',
  '/video/home/seedance2-video2.mp4',
  '/video/home/seedance2-video3.mp4',
];
const WHAT_VIDEOS = [
  '/video/what/example29.mp4',
  '/video/what/example30.mp4',
  '/video/what/example36.mp4',
];
const POSTERS = [1, 2, 3, 4, 5, 6].map((n) => `/video/posters/${n}.png`);

const modelOptions = Object.values(home.hero.video_model_options).map((model) => ({
  label: model.label,
  description: model.description,
}));

const steps = [
  ...Object.values(home.how_it_works.steps),
  {
    title: 'Step 4 Refine and Perfect Your Creation',
    description:
      "Use Flow AI Video's advanced editing features to fine-tune details, adjust settings, and perfect your final video with professional-grade results.",
  },
].map((step, index) => ({ ...step, order: index + 1 }));

// Two strings differ between the reference's message dictionary and what the
// page actually renders; the rendered copy wins (it is what visitors read).
steps[0] = {
  ...steps[0],
  description:
    'Begin by choosing the Flow Video Generator. The Flow Video offers text-to-video and image-to-video creation features to craft refined 4K cinematic videos with Flow Video Maker motion synthesis.',
};

const index = {
  metadata: {
    title: home.metadata.title,
    description: home.metadata.description,
    keywords: home.metadata.keywords,
  },
  page: {
    show_sections: [
      'hero',
      'studio',
      'showcase',
      'transformations',
      'features',
      'how_it_works',
      'pricing',
      'stats',
      'faq',
      'cta',
    ],
    sections: {
      hero: {
        id: 'hero',
        badge: home.hero.badge,
        title: home.hero.title,
        model_tag: home.hero.model_tag,
        subtitle: home.hero.subtitle,
        description: home.hero.description,
        social_users: home.hero.social_users,
        button: home.hero.button,
      },
      studio: {
        id: 'studio',
        anchor_models: 'models',
        label: 'AI Video Generation',
        title: home.upload.title,
        description: home.upload.description,
        tabs: [home.upload.tab_t2i, home.upload.tab_edit, home.upload.tab_reference],
        model_label: home.hero.ai_model_label,
        models: modelOptions,
        prompt_label: home.upload.prompt_label,
        prompt_required: home.upload.prompt_required_label,
        prompt_placeholder: home.upload.prompt_placeholder,
        aspect_ratio_label: home.upload.aspect_ratio_label,
        aspect_ratios: ['16:9', '9:16', home.upload.aspect_ratio.auto],
        quality_label: home.upload.video_quality_label,
        qualities: [
          home.upload.video_quality_options['720p'],
          home.upload.video_quality_options['1080p'],
        ],
        duration_label: home.upload.video_duration_label,
        durations: [
          home.upload.video_duration_options['4s'],
          home.upload.video_duration_options['6s'],
          home.upload.video_duration_options['8s'],
        ],
        generate_button: home.upload.generate_with_ai_editor,
        credits: '20',
        sample_title: home.upload.sample_title,
        sample_desc: home.upload.sample_desc,
        sample_tip: home.upload.sample_tip,
        videos: STUDIO_VIDEOS,
      },
      showcase: {
        id: 'showcase',
        title: home.video_showcase.title,
        description: home.video_showcase.description,
        items: POSTERS.map((poster, index) => ({
          poster,
          video: WHAT_VIDEOS[index % WHAT_VIDEOS.length],
        })),
      },
      transformations: {
        id: 'what-is-flow-ai-video',
        badge: home.transformations.badge,
        title: home.transformations.title,
        description: home.transformations.description,
        highlights: home.transformations.features,
        items: home.transformations.examples.map((example, index) => ({
          title: example.title,
          label: example.style,
          description: example.description,
          video: WHAT_VIDEOS[index % WHAT_VIDEOS.length],
          poster: POSTERS[index],
        })),
        cta_title: home.transformations.cta_title,
        cta_description: home.transformations.cta_description,
      },
      features: {
        id: 'features',
        label: home.ai_features.subtitle,
        title: home.ai_features.title,
        description: home.ai_features.description,
        items: Object.values(home.ai_features.features).map((feature, index) => ({
          title: feature.title,
          description: feature.description,
          icon: ['Brain', 'Images', 'Palette', 'MonitorPlay', 'Clapperboard', 'Zap'][index],
        })),
      },
      how_it_works: {
        id: 'how-it-works',
        label: 'SIMPLE STEPS',
        title: home.how_it_works.title,
        description:
          "Follow these straightforward steps to generate, edit, and refine videos online with Flow AI Video's consistent and intuitive workflow powered by Flow Video Generator.",
        items: steps,
      },
      pricing: {
        id: 'pricing',
        label: home.pricing.annual_badge.save_tag,
        title: home.pricing.title,
        description: home.pricing.description,
        benefits: Object.values(home.pricing.header.benefits),
        notice: home.pricing.checkout_currency_notice,
        annual_badge: home.pricing.annual_badge.title,
        annual_badge_label: 'Flash Sale 50%',
        groups: ['Annually', 'Monthly', 'One Time'],
        cost_per_100_label: home.pricing.cost_per_100_credits_label,
        cancel_support: `${home.pricing.cancel_support_prefix} support@flowaivideo.lol`,
        yearly_only_label: home.pricing.yearly_only,
        limited_offer_label: home.pricing.plan_countdown.label,
        cta_labels: { yearly: 'Get Started', monthly: 'Buy Now', oneTime: 'Pay Now' },
        plans: pricingMessages.pricing.plans
          .filter((plan) => plan.group === 'yearly')
          .map((plan) => ({
            title: plan.title === 'Professional' ? 'Professional' : plan.title,
            description: plan.description,
            price: plan.price.replace(/^\$\$/, '$'),
            unit: plan.unit,
            features_title: plan.features_title,
            features: plan.features,
            label: plan.label || '',
            credits: (plan.features.find((f) => f.includes('credits/year')) || '')
              .replace(/^(\d+) credits per month \((\d+) credits\/year\)$/, '$2'),
            cost_per_100: '',
          })),
      },
      stats: {
        id: 'stats',
        label: home.stats.eyebrow,
        title: home.stats.title,
        description: home.stats.description,
        items: home.stats.items.map((item) => ({
          label: item.category.toUpperCase(),
          title: item.headline,
          description: item.body,
        })),
      },
      faq: {
        id: 'faq',
        title: home.faq.title,
        description: home.faq.description,
        items: home.faq.questions.map((item) => ({
          question: item.question,
          answer: item.answer,
        })),
        cta_title: home.faq.cta_title,
        cta_description: home.faq.cta_description,
        cta_button: home.faq.cta_button,
        stats: Object.values(home.faq.stats),
      },
      cta: {
        id: 'start',
        title: home.faq.cta_title,
        description: home.faq.cta_description,
        buttons: [
          {
            title: home.faq.cta_button,
            url: '/pricing',
            variant: 'default',
            icon: 'ArrowRight',
          },
        ],
      },
    },
  },
};

const pricingItems = [];
for (const plan of pricingMessages.pricing.plans) {
  const amount = Math.round(parseFloat(clean(plan.price).replace('$', '')) * 100);
  const creditsLine = plan.features.find((f) => f.includes('credits')) || '';
  const yearlyMatch = /\((\d[\d,]*) credits\/year\)/.exec(creditsLine);
  const creditsMatch = /(\d[\d,]*)/.exec(creditsLine);
  const credits = Number(
    (yearlyMatch?.[1] || creditsMatch?.[1] || '0').replace(/,/g, '')
  );
  const perYear = plan.group === 'yearly';
  const costPer100 = perYear
    ? `$${((amount / 100) * 12 / (credits / 100)).toFixed(2)}`
    : '';
  const extraFeatures = [
    ...(costPer100
      ? [
          `${credits.toLocaleString('en-US')} Flow AI Video credits/year`,
          `Cost per 100 credits ${costPer100}`,
          'Yearly only',
        ]
      : []),
    ...(plan.label === 'Most Popular' ? ['Limited offer'] : []),
  ];
  pricingItems.push({
    title: plan.title,
    description: plan.description,
    label: plan.label || '',
    features_title: plan.features_title,
    features: [...plan.features, ...extraFeatures],
    // Stripe only accepts day|week|month|year for `price_data.recurring.interval`,
    // so the tab group ("monthly"/"yearly") and the billing interval differ.
    interval:
      plan.group === 'one-time'
        ? 'one-time'
        : plan.group === 'yearly'
          ? 'year'
          : 'month',
    amount,
    currency: 'USD',
    price: clean(plan.price),
    original_price: '',
    unit: plan.unit,
    is_featured: plan.label === 'Most Popular',
    tip: '',
    button: {
      title:
        plan.group === 'yearly'
          ? 'Get Started'
          : plan.group === 'one-time'
            ? 'Pay Now'
            : 'Buy Now',
      url: '',
      icon: 'RiFlashlightFill',
    },
    product_id:
      `flow-${plan.group}-${plan.title}`.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    product_name: `Flow AI Video ${plan.title} (${plan.group})`,
    credits: Number(
      (plan.features.find((f) => f.includes('credits')) || '').match(/(\d[\d,]*)/)?.[1]?.replace(',', '') || 0
    ),
    valid_days: plan.group === 'monthly' ? 30 : plan.group === 'yearly' ? 365 : 0,
    group: plan.group,
  });
}

const pricing = {
  metadata: {
    title: `${pricingMessages.pricing.title} | Flow AI Video`,
    description: pricingMessages.pricing.description,
  },
  page: {
    title: pricingMessages.pricing.title,
    sections: {
      pricing: {
        id: 'pricing',
        title: pricingMessages.pricing.title,
        description: pricingMessages.pricing.description,
        benefits: Object.values(pricingMessages.pricing.header.benefits),
        notice: pricingMessages.pricing.checkout_currency_notice,
        annual_badge_label: 'Flash Sale 50%',
        offer: {
          badge: pricingMessages.pricing.offer_banner.badge_limited,
          badge_active: pricingMessages.pricing.offer_banner.badge_active,
          title: `${pricingMessages.pricing.offer_banner.title} ${pricingMessages.pricing.offer_banner.discount}`,
          subtitle: pricingMessages.pricing.offer_banner.subtitle,
          social_proof: pricingMessages.pricing.offer_banner.social_proof,
          rating: pricingMessages.pricing.offer_banner.rating,
          live: pricingMessages.pricing.offer_banner.live,
          upgraded_today:
            pricingMessages.pricing.offer_banner.upgraded_today.replace('{count}', '453'),
          pills: [
            pricingMessages.pricing.offer_banner.pill_no_fees,
            pricingMessages.pricing.offer_banner.pill_cancel,
            pricingMessages.pricing.offer_banner.pill_money_back,
          ],
          cta: pricingMessages.pricing.offer_banner.cta,
        },
        stats: Object.values(pricingMessages.pricing.header.stats),
        groups: [
          { name: 'yearly', title: 'Annually', is_featured: true, label: 'Save 50%' },
          { name: 'monthly', title: 'Monthly' },
          { name: 'one-time', title: 'One Time' },
        ],
        items: pricingItems,
      },
      faq: {
        id: 'faq',
        title: pricingMessages.pricing_faq.title,
        description: pricingMessages.pricing_faq.description,
        items: pricingMessages.pricing_faq.questions.map((item) => ({
          question: item.question,
          answer: item.answer,
        })),
      },
    },
  },
  messages: {
    credits: pricingMessages.pricing.credits,
    yearly_only: pricingMessages.pricing.yearly_only,
    cancel_anytime: pricingMessages.pricing.cancel_anytime,
    cost_per_100_credits_label: pricingMessages.pricing.cost_per_100_credits_label,
    cancel_support_prefix: pricingMessages.pricing.cancel_support_prefix,
    support_email: 'support@flowaivideo.lol',
    per_month_short: pricingMessages.pricing.per_month_short,
    per_year_short: pricingMessages.pricing.per_year_short,
  },
};

write('src/config/locale/messages/en/pages/index.json', index);
write('src/config/locale/messages/en/pages/pricing.json', pricing);

console.log(
  `index: ${Object.keys(index.page.sections).length} sections, ` +
    `${snapshot.media.videos.length} reference videos\n` +
    `pricing: ${pricingItems.length} plan entries`
);
console.log(`assets: ${Object.keys(assets.pages).join(', ')}`);
