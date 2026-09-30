'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Brain,
  Check,
  Clapperboard,
  Images,
  Loader2,
  MonitorPlay,
  Palette,
  Play,
  Sparkles,
  Zap,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { useAppContext } from '@/shared/contexts/app';
import { trackEvent } from '@/shared/lib/analytics';

type HeroSection = {
  badge: string;
  title: string;
  model_tag: string;
  subtitle: string;
  description: string;
  social_users: string;
};

type StudioSection = {
  id: string;
  anchor_models: string;
  label: string;
  title: string;
  description: string;
  tabs: string[];
  model_label: string;
  models: { label: string; description: string }[];
  prompt_label: string;
  prompt_required: string;
  prompt_placeholder: string;
  aspect_ratio_label: string;
  aspect_ratios: string[];
  quality_label: string;
  qualities: string[];
  duration_label: string;
  durations: string[];
  generate_button: string;
  credits: string;
  sample_title: string;
  sample_desc: string;
  sample_tip: string;
  videos: string[];
};

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Brain,
  Images,
  Palette,
  MonitorPlay,
  Clapperboard,
  Zap,
  Sparkles,
};

/**
 * Every primary call to action funnels through this button.
 *
 * Signed out -> Google sign-in dialog. Signed in with an active plan -> the
 * studio queue on the landing page. Signed in without a plan -> /pricing.
 * Billing and credits are read-only here: the subscription backend is untouched.
 */
export function FlowAction({
  children,
  className,
  ctaId = 'generate_video',
  onSubscribed,
  variant = 'generate',
}: {
  children: React.ReactNode;
  className?: string;
  ctaId?: string;
  onSubscribed?: () => void;
  variant?: 'generate' | 'plain';
}) {
  const router = useRouter();
  const { user, isCheckSign, setIsShowSignModal } = useAppContext();
  const [loading, setLoading] = useState(false);

  const act = async () => {
    if (loading || isCheckSign) return;

    if (!user) {
      trackEvent('sign_in_started', { method: 'google', location: ctaId });
      setIsShowSignModal(true);
      return;
    }

    trackEvent('generate_clicked', { cta_id: ctaId });
    setLoading(true);
    try {
      const response = await fetch('/api/user/get-subscription', {
        method: 'POST',
      });
      if (response.status === 401 || response.status === 403) {
        setIsShowSignModal(true);
        return;
      }
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result?.code !== 0) {
        throw new Error(result?.message || 'Unable to check your plan');
      }
      const subscribed = Boolean(result?.data?.subscribed);
      if (subscribed) {
        trackEvent('queue_started', { cta_id: ctaId });
        onSubscribed?.();
        return;
      }
      trackEvent('subscribe_cta_click', { cta_id: ctaId, destination: '/pricing' });
      router.push('/pricing');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Please try again');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      className={className ?? (variant === 'generate' ? 'flow-generate' : undefined)}
      disabled={loading || isCheckSign}
      onClick={act}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : null}
      {children}
    </button>
  );
}

export function FlowHero({
  hero,
  studio,
}: {
  hero: HeroSection;
  studio: StudioSection;
}) {
  return (
    <section className="flow-hero" id={hero.badge ? 'home' : undefined}>
      <div className="flow-container flow-hero-inner">
        <span className="flow-eyebrow">{hero.badge}</span>
        <h1>{hero.title}</h1>
        <p className="flow-model-tag">{hero.model_tag}</p>
        <p className="flow-subtitle">{hero.subtitle}</p>
        <p className="flow-social">{hero.social_users}</p>
      </div>
      <FlowStudio studio={studio} />
    </section>
  );
}

export function FlowStudio({ studio }: { studio: StudioSection }) {
  const [tab, setTab] = useState(studio.tabs[0]);
  const [model, setModel] = useState(studio.models[0]?.label ?? '');
  const [prompt, setPrompt] = useState('');
  const [aspect, setAspect] = useState(studio.aspect_ratios[0]);
  const [quality, setQuality] = useState(studio.qualities[0]);
  const [duration, setDuration] = useState(studio.durations[0]);
  const [videoIndex, setVideoIndex] = useState(0);
  const [queue, setQueue] = useState<{ position: number; progress: number } | null>(
    null
  );
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  const startQueue = () => {
    if (timer.current) clearInterval(timer.current);
    setQueue({ position: 4, progress: 6 });
    timer.current = setInterval(() => {
      setQueue((current) => {
        if (!current) return current;
        if (current.progress >= 100) {
          if (timer.current) clearInterval(timer.current);
          return { position: 1, progress: 100 };
        }
        const progress = Math.min(100, current.progress + 4);
        const position = Math.max(1, 4 - Math.floor(progress / 25));
        return { position, progress };
      });
    }, 900);
  };

  return (
    <div className="flow-container flow-studio" id={studio.id}>
      <div className="flow-card">
        <header className="mb-4">
          <span className="flow-eyebrow">{studio.label}</span>
          <h2 className="mt-3 text-xl font-bold md:text-2xl">{studio.title}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{studio.description}</p>
        </header>
        <div className="flow-tabs">
          {studio.tabs.map((item) => (
            <button
              key={item}
              type="button"
              data-active={item === tab}
              onClick={() => setTab(item)}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="flow-field" id={studio.anchor_models}>
          <label htmlFor="flow-model">{studio.model_label}</label>
          <select
            id="flow-model"
            value={model}
            onChange={(event) => setModel(event.target.value)}
          >
            {studio.models.map((item) => (
              <option key={item.label} value={item.label}>
                {item.label} — {item.description}
              </option>
            ))}
          </select>
        </div>

        <div className="flow-field">
          <div className="flow-field-label">
            <label htmlFor="flow-prompt" className="contents">
              {studio.prompt_label}({studio.prompt_required})
            </label>
            <span className="flow-counter">{prompt.length}/2000</span>
          </div>
          <textarea
            id="flow-prompt"
            maxLength={2000}
            placeholder={studio.prompt_placeholder}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
          />
        </div>

        <div className="flow-field">
          <span className="flow-field-label">{studio.aspect_ratio_label}</span>
          <div className="flow-options">
            {studio.aspect_ratios.map((item) => (
              <button
                key={item}
                type="button"
                data-active={item === aspect}
                onClick={() => setAspect(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="flow-field">
          <span className="flow-field-label">{studio.quality_label}</span>
          <div className="flow-options">
            {studio.qualities.map((item) => (
              <button
                key={item}
                type="button"
                data-active={item === quality}
                onClick={() => setQuality(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="flow-field">
          <span className="flow-field-label">{studio.duration_label}</span>
          <div className="flow-options">
            {studio.durations.map((item) => (
              <button
                key={item}
                type="button"
                data-active={item === duration}
                onClick={() => setDuration(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <FlowAction ctaId="studio_generate" onSubscribed={startQueue}>
          {studio.generate_button}
          <span className="flow-credits-badge">· ★{studio.credits}</span>
        </FlowAction>

        {queue ? (
          <div className="flow-queue" role="status" aria-live="polite">
            <strong>
              {queue.progress >= 100
                ? 'Your Flow AI Video is next in the queue'
                : `Generating with ${model}`}
            </strong>
            <span>
              Queue position {queue.position} · {queue.progress}% complete
            </span>
            <div className="flow-queue-bar">
              <span style={{ width: `${queue.progress}%` }} />
            </div>
            <span className="flow-sample-tip">
              Keep this tab open while Flow AI Video prepares your clip.
            </span>
          </div>
        ) : null}
      </div>

      <div className="flow-card flow-sample">
        <div className="flow-field-label">
          {studio.sample_title}
          <span className="flow-counter">{studio.label}</span>
        </div>
        <div className="flow-sample-frame">
          <video
            key={studio.videos[videoIndex]}
            src={studio.videos[videoIndex]}
            muted
            loop
            autoPlay
            playsInline
          />
          <button
            type="button"
            aria-label="Show the next sample video"
            className="absolute inset-0 cursor-pointer"
            onClick={() =>
              setVideoIndex((current) => (current + 1) % studio.videos.length)
            }
            hidden={queue !== null}
          />
        </div>
        <p className="flow-sample-tip">
          {studio.sample_desc} {studio.sample_tip}
        </p>
      </div>
    </div>
  );
}

export function FlowSectionHead({
  label,
  title,
  description,
}: {
  label?: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flow-section-head">
      {label ? <span className="flow-eyebrow">{label}</span> : null}
      <h2 className="mt-4">{title}</h2>
      <p>{description}</p>
    </div>
  );
}

export function FlowShowcase({
  section,
}: {
  section: {
    id: string;
    title: string;
    description: string;
    items: { poster: string; video: string }[];
  };
}) {
  return (
    <section className="flow-section" id={section.id}>
      <div className="flow-container">
        <FlowSectionHead title={section.title} description={section.description} />
        <div className="flow-video-grid">
          {section.items.map((item, index) => (
            <div className="flow-video-card" key={`${item.poster}-${index}`}>
              <video
                src={item.video}
                poster={item.poster}
                muted
                loop
                playsInline
                preload="none"
                onMouseEnter={(event) => void event.currentTarget.play().catch(() => {})}
                onMouseLeave={(event) => event.currentTarget.pause()}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FlowTransformations({
  section,
}: {
  section: {
    id: string;
    badge: string;
    title: string;
    description: string;
    highlights: string[];
    items: { title: string; label: string; description: string; video: string; poster: string }[];
    cta_title: string;
    cta_description: string;
  };
}) {
  return (
    <section className="flow-section" id={section.id}>
      <div className="flow-container">
        <FlowSectionHead label={section.badge} title={section.title} description={section.description} />
        <div className="flow-highlight-list justify-center">
          {section.highlights.map((item) => (
            <span key={item}>
              <Check className="mr-1 inline size-3.5" />
              {item}
            </span>
          ))}
        </div>
        {section.items.map((item, index) => (
          <div className="flow-media-row" data-flip={index % 2 === 1} key={item.title}>
            <div className="flow-media-visual">
              <video src={item.video} poster={item.poster} muted loop autoPlay playsInline />
            </div>
            <div className="flow-media-copy">
              <span className="flow-eyebrow">{item.label}</span>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </div>
          </div>
        ))}
        <div className="flow-transformation-cta">
          <h3>{section.cta_title}</h3>
          <p>{section.cta_description}</p>
          <FlowAction className="flow-generate mx-auto mt-4 max-w-xs" ctaId="transformations">
            {section.cta_title}
            <ArrowRight className="size-4" />
          </FlowAction>
        </div>
      </div>
    </section>
  );
}

export function FlowFeatures({
  section,
}: {
  section: {
    id: string;
    label: string;
    title: string;
    description: string;
    items: { title: string; description: string; icon: string }[];
  };
}) {
  return (
    <section className="flow-section" id={section.id}>
      <div className="flow-container">
        <FlowSectionHead label={section.label} title={section.title} description={section.description} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {section.items.map((item) => {
            const Icon = ICONS[item.icon] ?? Sparkles;
            return (
              <article className="flow-card" key={item.title}>
                <Icon className="mb-3 size-6 text-[var(--flow-amber)]" />
                <h3 className="text-lg font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function FlowSteps({
  section,
}: {
  section: {
    id: string;
    label: string;
    title: string;
    description: string;
    items: { title: string; description: string; order: number }[];
  };
}) {
  return (
    <section className="flow-section" id={section.id}>
      <div className="flow-container">
        <FlowSectionHead label={section.label} title={section.title} description={section.description} />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {section.items.map((item) => (
            <article className="flow-card" key={item.title}>
              <span className="flow-eyebrow">0{item.order}</span>
              <h3 className="mt-3 text-lg font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FlowPricingSummary({
  section,
}: {
  section: {
    id: string;
    label: string;
    title: string;
    description: string;
    benefits: string[];
    notice: string;
    annual_badge: string;
    annual_badge_label: string;
    groups: string[];
    cost_per_100_label: string;
    cancel_support: string;
    yearly_only_label: string;
    limited_offer_label: string;
    cta_labels: { yearly: string; monthly: string; oneTime: string };
    plans: {
      title: string;
      description: string;
      price: string;
      unit: string;
      label: string;
      credits: string;
      features_title: string;
      features: string[];
    }[];
  };
}) {
  const [group, setGroup] = useState(section.groups[0]);

  return (
    <section className="flow-section" id={section.id}>
      <div className="flow-container">
        <FlowSectionHead
          label={section.annual_badge}
          title={section.title}
          description={section.description}
        />
        <div className="mb-8 flex flex-wrap items-center justify-center gap-2">
          {section.groups.map((item) => (
            <button
              key={item}
              type="button"
              className="flow-eyebrow"
              data-active={item === group}
              style={
                item === group
                  ? undefined
                  : { background: 'transparent', color: 'var(--muted-foreground)' }
              }
              onClick={() => setGroup(item)}
            >
              {item}
            </button>
          ))}
          <span className="flow-eyebrow">{section.annual_badge_label}</span>
        </div>
        <div className="flow-plan-grid">
          {section.plans.map((plan) => {
            const credits = Number(plan.credits.replace(/,/g, '')) || 0;
            const yearlyAmount = (parseFloat(plan.price.replace('$', '')) || 0) * 12;
            const costPer100 =
              credits > 0 ? (yearlyAmount / (credits / 100)).toFixed(2) : '';
            return (
            <article
              className="flow-plan"
              data-featured={plan.label === 'Most Popular' || plan.title === 'Professional'}
              key={plan.title}
            >
              <header className="space-y-1">
                <h3 className="text-lg font-semibold">{plan.title}</h3>
                {plan.label ? (
                  <span className="flow-eyebrow">{plan.label}</span>
                ) : null}
                <span className="flow-eyebrow">{section.yearly_only_label}</span>
                <p className="text-sm text-muted-foreground">{plan.description}</p>
              </header>
              <div className="flow-plan-price">
                <strong>{plan.price}</strong>
                <span>{plan.unit}</span>
              </div>
              {plan.credits ? (
                <p className="text-sm text-muted-foreground">
                  ★ {Number(plan.credits).toLocaleString('en-US')}
                  <span className="mt-1 block">Credits/year</span>
                </p>
              ) : null}
              {costPer100 ? (
                <p className="text-sm text-muted-foreground">
                  {section.cost_per_100_label}
                  <span className="ml-1 text-foreground">${costPer100}</span>
                </p>
              ) : null}
              <span className="flow-eyebrow">{section.limited_offer_label}</span>
              <p className="text-sm font-medium">{plan.features_title}</p>
              <ul>
                {plan.features.map((feature) => (
                  <li key={feature}>
                    <Check />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <a className="flow-plan-cta" href="/pricing">
                {group === 'One Time'
                  ? section.cta_labels.oneTime
                  : group === 'Monthly'
                    ? section.cta_labels.monthly
                    : section.cta_labels.yearly}
              </a>
            </article>
            );
          })}
        </div>
        <div className="flow-benefits">
          {section.benefits.map((benefit) => (
            <span key={benefit}>
              <Check />
              {benefit}
            </span>
          ))}
        </div>
        <p className="flow-notice">{section.notice}</p>
        <p className="flow-notice">{section.cancel_support}</p>
      </div>
    </section>
  );
}

export function FlowStats({
  section,
}: {
  section: {
    id: string;
    label: string;
    title: string;
    description: string;
    items: { label: string; title: string; description: string }[];
  };
}) {
  return (
    <section className="flow-section" id={section.id}>
      <div className="flow-container">
        <FlowSectionHead label={section.label} title={section.title} description={section.description} />
        <div className="flow-stat-grid">
          {section.items.map((item) => (
            <article className="flow-stat" key={item.title}>
              <small>{item.label}</small>
              <strong>{item.title}</strong>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FlowFaq({
  section,
}: {
  section: {
    id: string;
    title: string;
    description: string;
    items: { question: string; answer: string }[];
    cta_title: string;
    cta_description: string;
    cta_button: string;
    stats: string[];
  };
}) {
  return (
    <section className="flow-section" id={section.id}>
      <div className="flow-container">
        <FlowSectionHead title={section.title} description={section.description} />
        <div className="mx-auto max-w-3xl divide-y divide-border rounded-[var(--radius)] border border-border bg-[color-mix(in_oklab,var(--card)_88%,transparent)]">
          {section.items.map((item, index) => (
            <details className="group px-5 py-4" key={item.question}>
              <summary className="flex cursor-pointer items-center justify-between gap-4 font-medium">
                <span>
                  <span className="mr-2 text-[var(--flow-amber)]">{index + 1}</span>
                  {item.question}
                </span>
                <span className="text-[var(--flow-amber)] group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-sm text-muted-foreground">{item.answer}</p>
            </details>
          ))}
        </div>

        <div className="flow-faq-cta">
          <h3>{section.cta_title}</h3>
          <p>{section.cta_description}</p>
          <div className="flow-faq-stats">
            {['10K+', '50+', '30'].map((value, index) => (
              <div key={value}>
                <strong>{value}</strong>
                <span>{section.stats[index]}</span>
              </div>
            ))}
          </div>
          <FlowAction className="flow-generate mx-auto max-w-xs" ctaId="faq_cta">
            {section.cta_button}
            <Play className="size-4" />
          </FlowAction>
        </div>
      </div>
    </section>
  );
}

/**
 * Pricing page header: the reference's "Simple, Transparent Pricing" intro with
 * its benefit row, checkout notice and the annual-plan call to action.
 */
export function FlowPricingHero({
  section,
}: {
  section: {
    title: string;
    description: string;
    benefits?: string[];
    notice?: string;
    annual_badge_label?: string;
    groups?: ({ name: string; title: string } | string)[];
    offer?: {
      badge: string;
      badge_active: string;
      title: string;
      subtitle: string;
      social_proof: string;
      rating: string;
      live: string;
      upgraded_today: string;
      pills: string[];
      cta: string;
    };
    stats?: { value: string; label: string }[];
  };
}) {
  return (
    <section className="flow-section pb-0">
      <div className="flow-container">
        <FlowSectionHead
          label={section.annual_badge_label}
          title={section.title}
          description={section.description}
        />
        {section.groups?.length ? (
          <div className="mb-6 flex flex-wrap items-center justify-center gap-2">
            {section.groups.map((item) => (
              <span className="flow-eyebrow" key={typeof item === 'string' ? item : item.name}>
                {typeof item === 'string' ? item : item.title}
              </span>
            ))}
          </div>
        ) : null}
        {section.benefits?.length ? (
          <div className="flow-benefits">
            {section.benefits.map((benefit) => (
              <span key={benefit}>
                <Check />
                {benefit}
              </span>
            ))}
          </div>
        ) : null}
        {section.notice ? <p className="flow-notice">{section.notice}</p> : null}

        {section.offer ? (
          <div className="flow-transformation-cta mt-8 text-left md:text-center">
            <span className="flow-eyebrow">{section.offer.badge}</span>{' '}
            <span className="flow-eyebrow">{section.offer.badge_active}</span>
            <h3 className="mt-4 text-2xl">{section.offer.title}</h3>
            <p>{section.offer.subtitle}</p>
            <p className="mt-2 text-sm text-[var(--flow-amber)]">
              {section.offer.live} · {section.offer.social_proof} ·{' '}
              {section.offer.rating} · {section.offer.upgraded_today}
            </p>
            <div className="flow-benefits">
              {section.offer.pills.map((pill) => (
                <span key={pill}>
                  <Check />
                  {pill}
                </span>
              ))}
            </div>
            <a className="flow-generate mx-auto mt-4 max-w-xs" href="/pricing">
              {section.offer.cta}
            </a>
          </div>
        ) : null}

        {section.stats?.length ? (
          <div className="flow-stat-grid mt-8">
            {section.stats.map((stat) => (
              <article className="flow-stat" key={stat.label}>
                <strong>{stat.value}</strong>
                <p>{stat.label}</p>
              </article>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

/**
 * Support block shown under the pricing FAQ on the reference pricing page.
 */
export function FlowSupportCta({
  title,
  description,
  email = 'support@flowaivideo.lol',
}: {
  title: string;
  description: string;
  email?: string;
}) {
  return (
    <div className="flow-faq-cta">
      <h3>{title}</h3>
      <p>{description}</p>
      <p className="mt-4">
        <a className="text-[var(--flow-amber)]" href={`mailto:${email}`}>
          {email}
        </a>
      </p>
    </div>
  );
}
