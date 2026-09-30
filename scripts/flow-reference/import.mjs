#!/usr/bin/env node
/**
 * Snapshot the flowaivideo.org English marketing pages that flowaivideo.lol
 * mirrors (home + pricing) into `content/flow`.
 *
 * The clone keeps the reference body copy verbatim, so the copy is imported
 * instead of retyped:
 *
 *   content/flow/text/home.txt      ordered visible lines, one per line
 *   content/flow/text/pricing.txt   ordered visible lines, one per line
 *   content/flow/home.json          structured headings/copy/faq/media
 *   content/flow/pricing.json       plans + faq
 *   content/flow/assets.json        media urls referenced by the pages
 *
 * Playwright is borrowed from a scratch install so the app image never ships
 * it:
 *
 *   PLAYWRIGHT_MODULE_DIR=/tmp/vidrush-tools/node_modules \
 *     node scripts/flow-reference/import.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const CONTENT_DIR = path.join(ROOT, 'content/flow');
const TEXT_DIR = path.join(CONTENT_DIR, 'text');

const ORIGIN = process.env.FLOW_REFERENCE_ORIGIN || 'https://www.flowaivideo.org';

const PAGES = [
  { name: 'home', path: '/' },
  { name: 'pricing', path: '/pricing' },
];

async function loadPlaywright() {
  const searchPaths = [
    process.env.PLAYWRIGHT_MODULE_DIR,
    '/tmp/vidrush-tools/node_modules',
  ].filter(Boolean);
  for (const dir of searchPaths) {
    try {
      const require = createRequire(path.join(dir, 'index.js'));
      return require('playwright');
    } catch (error) {
      void error;
    }
  }
  return await import('playwright');
}

// Lines that belong to consent banners, chat widgets or cookie notices rather
// than the marketing copy.
const NOISE = [
  /^accept all cookies$/i,
  /^reject all$/i,
  /^manage cookies$/i,
  /^this website uses cookies/i,
  /^we use cookies/i,
  /^powered by .*cookie/i,
];

function cleanLines(rawLines) {
  const seen = new Set();
  const out = [];
  for (const raw of rawLines) {
    const line = raw.replace(/\s+/g, ' ').trim();
    if (!line) continue;
    if (NOISE.some((re) => re.test(line))) continue;
    if (line.length > 400) continue;
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(line);
  }
  return out;
}

/**
 * Pull the `messages` dictionary out of the Next.js flight payload. The
 * reference app renders through next-intl, so this object holds the exact
 * wording of every label on the page — including accordions and tabs that are
 * not visible in the initial HTML.
 */
function extractFlightMessages(html) {
  const chunks = html.matchAll(/self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g);
  let payload = '';
  for (const chunk of chunks) {
    try {
      payload += JSON.parse(chunk[1]);
    } catch {
      /* ignore malformed chunk */
    }
  }
  const marker = payload.indexOf('"messages":');
  if (marker === -1) return null;
  const start = payload.indexOf('{', marker);
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < payload.length; i += 1) {
    const char = payload[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(payload.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

async function snapshot(page, target) {
  await page.goto(`${ORIGIN}${target.path}`, {
    waitUntil: 'domcontentloaded',
    timeout: 120000,
  });
  await page.waitForTimeout(4000);
  // Some sections are revealed on scroll; walk the page so everything renders.
  await page.evaluate(async () => {
    const step = Math.max(400, Math.floor(window.innerHeight * 0.8));
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
    window.scrollTo(0, 0);
  });
  // FAQ answers live behind accordion buttons; open every one so the copy is
  // captured instead of only the questions.
  await page.evaluate(async () => {
    const triggers = [...document.querySelectorAll('button, [role="button"], h3, summary')].filter(
      (el) => (el.textContent || '').trim().endsWith('?')
    );
    for (const trigger of triggers) {
      try {
        if (trigger.getAttribute('aria-expanded') !== 'true') {
          trigger.scrollIntoView({ block: 'center' });
          trigger.click();
          await new Promise((resolve) => setTimeout(resolve, 180));
        }
      } catch {
        /* ignore */
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 800));
  });
  await page.waitForTimeout(1500);

  return await page.evaluate(() => {
    const text = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();
    const headings = [];
    for (const el of document.querySelectorAll('h1, h2, h3, h4')) {
      const value = text(el);
      if (value) headings.push({ tag: el.tagName.toLowerCase(), text: value });
    }
    const bodyText = document.body.innerText || '';
    const media = {
      videos: [
        ...new Set(
          [...document.querySelectorAll('video')]
            .map((v) => v.getAttribute('src') || v.querySelector('source')?.getAttribute('src') || '')
            .filter(Boolean)
        ),
      ],
      posters: [
        ...new Set(
          [...document.querySelectorAll('video')]
            .map((v) => v.getAttribute('poster') || '')
            .filter(Boolean)
        ),
      ],
      images: [
        ...new Set(
          [...document.querySelectorAll('img')]
            .map((i) => i.getAttribute('src') || '')
            .filter((src) => src && !src.startsWith('data:'))
        ),
      ],
    };
    const meta = {};
    for (const name of ['description', 'og:title', 'og:description', 'og:image']) {
      const el =
        document.querySelector(`meta[name="${name}"]`) ||
        document.querySelector(`meta[property="${name}"]`);
      if (el) meta[name] = el.getAttribute('content') || '';
    }
    const footer = document.querySelector('footer') || document.body;
    const footerLinks = [...footer.querySelectorAll('a')]
      .map((a) => ({
        title: (a.textContent || '').replace(/\s+/g, ' ').trim(),
        url: a.getAttribute('href') || '',
      }))
      .filter((link) => link.title);
    return { title: document.title, meta, headings, bodyText, media, footerLinks };
  });
}

async function main() {
  const { chromium } = await loadPlaywright();
  // The scratch install may not own the matching bundled browser revision, so
  // fall back to the local Google Chrome install unless a path is provided.
  const executablePath = process.env.FLOW_CHROME_PATH;
  const browser = await chromium.launch(
    executablePath
      ? { headless: true, executablePath }
      : { headless: true, channel: 'chrome' }
  );
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36',
  });

  fs.mkdirSync(TEXT_DIR, { recursive: true });
  const assets = {};

  for (const target of PAGES) {
    const snapshotData = await snapshot(page, target);
    const html = await page.content();
    const lines = cleanLines(snapshotData.bodyText.split('\n'));
    const json = {
      url: `${ORIGIN}${target.path}`,
      title: snapshotData.title,
      meta: snapshotData.meta,
      headings: snapshotData.headings,
      lines,
      media: snapshotData.media,
      footer_links: snapshotData.footerLinks,
    };
    fs.writeFileSync(
      path.join(CONTENT_DIR, `${target.name}.json`),
      `${JSON.stringify(json, null, 2)}\n`
    );
    fs.writeFileSync(path.join(TEXT_DIR, `${target.name}.txt`), `${lines.join('\n')}\n`);
    // The Next.js app ships its full copy dictionary in the flight payload.
    // Keep it next to the snapshot: it is the authoritative wording for every
    // label on the page, including text that only renders after interaction.
    const messages = extractFlightMessages(html);
    if (messages) {
      fs.writeFileSync(
        path.join(CONTENT_DIR, `${target.name}.messages.json`),
        `${JSON.stringify(messages, null, 2)}\n`
      );
    }
    assets[target.name] = snapshotData.media;
    console.log(
      `${target.name}: ${lines.length} lines, ${snapshotData.media.videos.length} videos, ` +
        `messages: ${messages ? Object.keys(messages).length + ' namespaces' : 'not found'}`
    );
  }

  fs.writeFileSync(
    path.join(CONTENT_DIR, 'assets.json'),
    `${JSON.stringify({ origin: ORIGIN, pages: assets }, null, 2)}\n`
  );
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
