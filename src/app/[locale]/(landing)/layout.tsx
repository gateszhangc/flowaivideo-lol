import { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';

import '@/config/style/flow.css';

import { Footer } from '@/themes/default/blocks/footer';
import { Header } from '@/themes/default/blocks/header';

export default async function LandingLayout({ children }: { children: ReactNode }) {
  // The site chrome is the template's own header/footer block; the copy and
  // links live in `landing.json` so they stay in one place.
  const t = await getTranslations('landing');

  return (
    <div className="landing-shell">
      <Header header={t.raw('header')} />
      <div className="flow-announcement">
        <strong>Flow AI Video is now available on Seed Imagine</strong>
        <span>
          Create with Veo 3.1, Seedance 2.5, and more—all in one workspace.
        </span>
        <a href="/#studio">Try it free →</a>
      </div>
      {children}
      <Footer footer={t.raw('footer')} />
    </div>
  );
}
