'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import Script from 'next/script';

import { gaMeasurementId } from '@/config/analytics';
import { trackPageView } from '@/shared/lib/analytics';

/**
 * Google Analytics 4 (gtag.js).
 *
 * `gtag('config', ...)` already sends the initial page_view, so the effect
 * below skips the first render and only reports client-side navigations.
 */
export function GoogleAnalytics() {
  const pathname = usePathname();
  const isInitialRender = useRef(true);

  useEffect(() => {
    if (!gaMeasurementId) return;

    if (isInitialRender.current) {
      isInitialRender.current = false;
      return;
    }

    trackPageView();
  }, [pathname]);

  if (!gaMeasurementId) return null;

  return (
    <>
      <Script
        id="google-analytics-src"
        src={`https://www.googletagmanager.com/gtag/js?id=${gaMeasurementId}`}
        strategy="afterInteractive"
        async
      />
      <Script
        id="google-analytics"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gaMeasurementId}');`,
        }}
      />
    </>
  );
}