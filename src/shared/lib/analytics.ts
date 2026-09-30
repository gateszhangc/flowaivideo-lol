/**
 * Browser-side Google Analytics (gtag) helpers.
 *
 * Every helper is a no-op when gtag is unavailable, so analytics can never
 * throw inside a click handler or block a user journey.
 */

type EventParams = Record<string, unknown>;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * Events reported from a mount effect can run before gtag exists.
 *
 * gtag.js is loaded with next/script afterInteractive, so the shim that defines
 * window.gtag appears after React has already committed its effects. `purchase`
 * on the post-checkout page and `sign_up` after an OAuth round trip are both
 * reported from an effect, and both used to be dropped in that window. Hold
 * them in a small queue and flush as soon as gtag shows up.
 */
const pendingEvents: Array<[string, EventParams]> = [];
const PENDING_LIMIT = 50;
const FLUSH_INTERVAL_MS = 200;
const FLUSH_ATTEMPTS = 75; // ~15 seconds, then give up rather than leak memory
let flushTimer: number | undefined;
let flushAttempts = 0;

function canTrack(): boolean {
  return typeof window !== 'undefined' && typeof window.gtag === 'function';
}

function flushPending(): void {
  if (!canTrack()) return;

  while (pendingEvents.length > 0) {
    const [name, params] = pendingEvents.shift()!;
    window.gtag!('event', name, params);
  }
}

function stopFlushing(): void {
  if (flushTimer === undefined) return;
  window.clearInterval(flushTimer);
  flushTimer = undefined;
}

function scheduleFlush(): void {
  if (flushTimer !== undefined) return;

  flushTimer = window.setInterval(() => {
    flushAttempts += 1;

    if (canTrack()) {
      stopFlushing();
      flushPending();
      return;
    }

    if (flushAttempts >= FLUSH_ATTEMPTS) {
      stopFlushing();
      pendingEvents.length = 0;
    }
  }, FLUSH_INTERVAL_MS);
}

/**
 * Send a GA4 event.
 *
 * Returns true when the event was handed to gtag or queued for it. Returns
 * false only when there is nowhere to put it (no window, or a full queue).
 */
export function trackEvent(name: string, params: EventParams = {}): boolean {
  if (typeof window === 'undefined') return false;

  if (canTrack()) {
    window.gtag!('event', name, params);
    return true;
  }

  if (pendingEvents.length >= PENDING_LIMIT) return false;

  pendingEvents.push([name, params]);
  scheduleFlush();
  return true;
}

/**
 * Send a page_view for the current URL.
 *
 * Next.js swaps the document title after the route commits, so a client-side
 * navigation that reports straight away can send an empty page title and land
 * in GA4 as a (not set) row. Wait for the title, capped so it is never lost.
 */
export function trackPageView(params: EventParams = {}): void {
  if (typeof window === 'undefined') return;

  const send = () => {
    trackEvent('page_view', {
      page_location: window.location.href,
      page_path: `${window.location.pathname}${window.location.search}`,
      page_title: document.title,
      ...params,
    });
  };

  if (document.title) {
    send();
    return;
  }

  let tries = 0;
  const timer = window.setInterval(() => {
    tries += 1;
    if (document.title || tries >= 30) {
      window.clearInterval(timer);
      send();
    }
  }, 10);
}

/**
 * Send an event at most once per dedupe key for the lifetime of the tab.
 *
 * Used for purchase, where the user can reload the post-checkout page and we
 * must not count the same order twice. The key is only claimed once the event
 * has actually been handed to gtag or queued for it.
 */
export function trackEventOnce(
  dedupeKey: string,
  name: string,
  params: EventParams = {}
): boolean {
  if (typeof window === 'undefined') return false;

  const storageKey = `ga_once_${dedupeKey}`;
  try {
    if (window.sessionStorage.getItem(storageKey)) return false;
  } catch {
    // Storage can be unavailable (private mode); fall through and report.
  }

  if (!trackEvent(name, params)) return false;

  try {
    window.sessionStorage.setItem(storageKey, '1');
  } catch {
    // Ignore: without storage we simply lose the dedupe guarantee.
  }

  return true;
}
