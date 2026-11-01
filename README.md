# Etamar Beglikter — site (v1)

Built from the Figma design system ("Etamar Beglikter — Design System"). Astro, static, deployed on Vercel.

## How the parts connect

| Figma | Code |
|---|---|
| Variables (Color, Spacing, Typography, Layout) | `design/tokens.figma.json` → `npm run tokens` → `src/styles/tokens.css` |
| Text styles `EN/*` | `.t-*` classes in `src/styles/global.css` |
| Components: Top bar, Filter chip, Work card | `src/components/*.astro` |

Never type a colour, size or spacing value in a component — use the token (`var(--…)`). To change one, change the Figma variable and re-export.

## Content: the Studio

Works and categories are managed in the Studio at `/studio` (Hebrew UI, login with email + password).
Data lives in Supabase (project "beglikter"): tables `works`, `categories`, `work_categories`; images in the `works` storage bucket.

- Only addresses listed in `studio_members` can sign in or write; everyone else can only read published works (row-level security).
- Every save asks Vercel to rebuild (deploy hook stored in Supabase Vault as `vercel_deploy_hook`), so the site follows within about a minute.
- The site reads Supabase at build time (`src/content.config.ts`). `CONTENT_FIXTURE=1 npm run build` builds from `design/content-fixture.json` offline.

| Field | What it does |
|---|---|
| Title, year, medium, note | The caption under the image (note is optional) |
| Image, image description | The photo and its alt text |
| Frame | Image shape in the gallery: original, landscape 3:2, standard 4:3, portrait 4:5, square |
| Focus | What stays visible when the frame crops |
| Categories | Filter chips; a chip shows only when a published work uses it |
| Order | Drag rows in the Studio list |
| Published | Drafts never reach the site |

## Run locally

```
npm install
CONTENT_FIXTURE=1 npm run dev
```
