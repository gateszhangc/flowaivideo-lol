# Flow AI Video (flowaivideo.lol)

The site behind [flowaivideo.lol](https://flowaivideo.lol): an English-only
clone of [flowaivideo.org](https://www.flowaivideo.org) built on the
[`ai-shipany-template-two-lite`](https://github.com/gateszhangc/ai-shipany-template-two-lite)
template.

## What ships in this round

- Home page and pricing page. The landing copy is imported from the reference
  site word for word — see `content/flow` and the fidelity gate below.
- Sign-in is Google-only and every primary call to action is gated:
  signed out → Google dialog, signed in without a plan → `/pricing`, signed in
  with a plan → the studio queue on the landing page. The billing backend is
  untouched.
- Stripe subscriptions (Basic / Professional / Enterprise, monthly and annual)
  plus one-time credit packs, through the template's existing checkout and
  notification pipeline.
- Chrome, footer, sign-in dialog, pricing table, legal pages and settings share
  one visual language (warm near-black + amber accent, lifted from the
  reference tokens in `src/config/style/theme.css`).
- SEO: metadata, `sitemap.xml`, `robots.txt`, `llms.txt`, JSON-LD
  (Organization, WebSite, SoftwareApplication, FAQPage) and GA4.

Out of scope this round: the reference's 40+ tool/model/competitor pages, its
blog and its multi-language variants. Navigation and footer links that would
point at those pages anchor into the landing page instead of 404ing.

## Stack

- Next.js (App Router) + React + Tailwind CSS v4, theme `default`,
  appearance `dark`, locale `en` only.
- PostgreSQL + Drizzle ORM; the deploy platform runs
  `drizzle-kit push --config=src/core/db/config.ts` as an init container.
- better-auth for Google sign-in, Stripe for billing.

## Copy fidelity

The reference body copy is imported, not retyped:

```bash
# snapshot flowaivideo.org and /pricing into content/flow
# (Playwright lives outside the app image, e.g. /tmp/vidrush-tools)
PLAYWRIGHT_MODULE_DIR=/tmp/vidrush-tools/node_modules \
  node scripts/flow-reference/import.mjs

# regenerate the locale content the pages render from
node scripts/flow-reference/build-content.mjs

# fail if any reference line is missing from the built site
PLAYWRIGHT_MODULE_DIR=/tmp/vidrush-tools/node_modules \
  node scripts/flow-reference/check-fidelity.mjs https://flowaivideo.lol
```

`content/flow/text/*.txt` holds the ordered visible lines of the reference
pages, `content/flow/*.messages.json` the reference app's own copy dictionary,
and `content/flow/fidelity-allowlist.txt` the handful of lines that are not
reproduced on purpose (account-only chrome, the reference's language switcher).

## Brand assets

`content/flow/brand/master.png` is the generated mark (created with the image
generation endpoint from the bundled ShipAny logo brief); `public/logo.svg` is
the hand-authored vector twin used in the header. Regenerate the favicon and
social preview set with:

```bash
python3 scripts/flow-reference/brand-assets.py
```

## CTA behaviour

Every primary action runs through `FlowAction` in
`src/shared/blocks/flow/site.tsx`:

1. signed out → Google sign-in dialog
2. signed in with an active subscription → the studio queue on the home page
3. signed in without a subscription → `/pricing`

The gate reads `/api/user/get-subscription`.

## Local development

```bash
pnpm install
cp .env.example .env.local   # database, Google OAuth, Stripe, GA4 values
pnpm dev
```

Note: run the production build with `HOSTNAME=0.0.0.0` (as the platform does).
With a loopback hostname Next re-enters the i18n middleware on its own rewrite
and answers with a redirect loop.
