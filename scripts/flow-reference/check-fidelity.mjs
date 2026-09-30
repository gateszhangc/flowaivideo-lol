#!/usr/bin/env node
/**
 * Fidelity gate: every line of the reference pages must appear on the clone.
 *
 * The reference snapshot lives in `content/flow/text/*.txt` (imported by
 * `import.mjs`). Lines that cannot be reproduced by design (account-only chrome,
 * the reference's language switcher, alternate plan CTAs) are listed with a
 * reason in `content/flow/fidelity-allowlist.txt`.
 *
 *   node scripts/flow-reference/check-fidelity.mjs [url]
 *   PLAYWRIGHT_MODULE_DIR=/tmp/vidrush-tools/node_modules \
 *     node scripts/flow-reference/check-fidelity.mjs https://flowaivideo.lol
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const CONTENT = path.join(ROOT, 'content/flow');

const appUrl = process.argv[2] || process.env.FIDELITY_URL || 'http://localhost:3000';
const PAGES = [
  { name: 'home', path: '/' },
  { name: 'pricing', path: '/pricing' },
];

async function loadPlaywright() {
  for (const dir of [process.env.PLAYWRIGHT_MODULE_DIR, '/tmp/vidrush-tools/node_modules'].filter(
    Boolean
  )) {
    try {
      return createRequire(path.join(dir, 'index.js'))('playwright');
    } catch {
      /* try the next location */
    }
  }
  return await import('playwright');
}

function normalise(value) {
  return value
    .replace(/flowaivideo\.org/gi, 'flowaivideo.lol')
    .replace(/support@flowaivideo\.lol/gi, 'support@flowaivideo.lol')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function readAllowlist(page) {
  const file = path.join(CONTENT, 'fidelity-allowlist.txt');
  if (!fs.existsSync(file)) return new Map();
  const allowed = new Map();
  for (const raw of fs.readFileSync(file, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const [pageName, ...rest] = line.split('|');
    if (pageName.trim() !== page) continue;
    const text = rest.join('|').split('::')[0];
    allowed.set(normalise(text), rest.join('|').split('::')[1]?.trim() || 'allowlisted');
  }
  return allowed;
}

async function main() {
  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch(
    process.env.FLOW_CHROME_PATH
      ? { headless: true, executablePath: process.env.FLOW_CHROME_PATH }
      : { headless: true, channel: 'chrome' }
  );
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

  let failures = 0;
  for (const entry of PAGES) {
    const reference = fs
      .readFileSync(path.join(CONTENT, 'text', `${entry.name}.txt`), 'utf8')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 1);
    const allowlist = readAllowlist(entry.name);

    await page.goto(`${appUrl}${entry.path}`, {
      waitUntil: 'domcontentloaded',
      timeout: 120000,
    });
    await page.waitForTimeout(2500);
    await page.evaluate(async () => {
      const step = Math.max(400, Math.floor(window.innerHeight * 0.8));
      for (let y = 0; y < document.body.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise((resolve) => setTimeout(resolve, 80));
      }
      window.scrollTo(0, 0);
      for (const details of document.querySelectorAll('details')) {
        details.open = true;
      }
      await new Promise((resolve) => setTimeout(resolve, 400));
    });
    const rendered = normalise(await page.evaluate(() => document.body.innerText));
    // Flex/inline layout can split one visual line into several text nodes, so
    // accept a match that is only whitespace-different from the reference.
    const compactRendered = rendered.replace(/\s+/g, '');

    if (process.env.FIDELITY_DEBUG) {
      console.log('DEBUG url', page.url(), 'len', rendered.length, JSON.stringify(rendered.slice(0, 200)));
    }
    const missing = [];
    const allowed = [];
    for (const line of reference) {
      const needle = normalise(line);
      if (rendered.includes(needle)) continue;
      if (compactRendered.includes(needle.replace(/\s+/g, ''))) continue;
      if (allowlist.has(needle)) {
        allowed.push({ line, reason: allowlist.get(needle) });
        continue;
      }
      missing.push(line);
    }

    console.log(
      `\n${entry.name}: ${reference.length - missing.length - allowed.length}/${
        reference.length
      } reference lines rendered (${allowed.length} allowlisted)`
    );
    if (missing.length > 0) {
      failures += missing.length;
      console.log('  MISSING:');
      for (const line of missing) console.log(`   - ${line}`);
    }
  }

  await browser.close();
  if (failures > 0) {
    console.error(`\n${failures} reference line(s) missing.`);
    process.exit(1);
  }
  console.log('\nReference copy is fully represented.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
