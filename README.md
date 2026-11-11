# Creator Toolkit

Thirty tools for starting a long-form YouTube channel, in one static web app:
plan, script, produce, publish, then grow and earn.

Everything runs in the browser. There is no server and no account; data is kept
in the visitor's own browser (IndexedDB) and can be exported as a backup file.

## The 30 tools

| Stage | Tools |
| --- | --- |
| Plan | Idea bank, upload calendar, production kanban, niche and audience worksheet, series planner, competitor notes |
| Script | Script editor, hook and intro library, title workshop, outline builder, shot list, teleprompter |
| Produce | Thumbnail designer, thumbnail A/B preview, screen and webcam recorder, voiceover recorder, subtitle editor, brand kit |
| Publish | Description builder, chapter generator, tag set manager, pre-publish checklist, end screen and pinned comment templates, promo planner |
| Grow and earn | Analytics tracker, CTR / retention / RPM calculators, sponsorship CRM, rate card and invoice generator, goals and upload streaks, backup and restore |

## Develop

```bash
npm install
npm run dev
```

`npm run build` type-checks and writes the static site to `dist/`.

## Deploy

The site is hosted on GitHub Pages, served from the `gh-pages` branch
(repository Settings, Pages, Source: Deploy from a branch, `gh-pages`, `/`).

```bash
npm run deploy
```

builds the site and publishes `dist/` to that branch. Pushing to `main` does not
deploy on its own.

### Custom domain

`public/CNAME` holds the custom domain, `project.dbdd.in`. It needs one DNS record
at the domain's DNS provider:

| Type | Name | Value |
| --- | --- | --- |
| CNAME | `project` | `<github-username>.github.io` |

The deploy script publishes the custom domain only once that record exists, so the
site stays reachable at the default `github.io` address until then. After adding
the record, run `npm run deploy` again. Behind a DNS proxy that hides the CNAME,
use `PAGES_DOMAIN=1 npm run deploy`.

## Structure

- `src/registry.tsx` lists the 30 tools; each is lazy-loaded from `src/features/`.
- `src/lib/store.ts` is the storage layer; `src/lib/data.ts` is the shared data model.
- `src/ui/` holds shared components (form kit, template library, charts).

Built with React, TypeScript and Vite. Icons by Lucide; fonts via Fontsource.
