# Etamar Beglikter — site (v1)

Built from the Figma design system ("Etamar Beglikter — Design System"). Astro, static, deployed on Vercel.

## How the parts connect

| Figma | Code |
|---|---|
| Variables (Color, Spacing, Typography, Layout) | `design/tokens.figma.json` → `npm run tokens` → `src/styles/tokens.css` |
| Text styles `EN/*` | `.t-*` classes in `src/styles/global.css` |
| Components: Top bar, Filter chip, Work card | `src/components/*.astro` |

Never type a colour, size or spacing value in a component — use the token (`var(--…)`). To change one, change the Figma variable and re-export.

## Adding or editing a work

1. Put the photo in `src/content/works/images/` (any size; the site makes web versions automatically).
2. Copy any file in `src/content/works/` and change the fields:

| Field | What it does |
|---|---|
| `title`, `year`, `medium`, `note` | The caption under the image (`note` is optional) |
| `image`, `alt` | The photo and its description for screen readers |
| `frame` | Image shape in the gallery: `original` (photo's own proportions), `landscape` 3:2, `standard` 4:3, `portrait` 4:5, `square` |
| `focus` | What stays visible when the frame crops: `center`, `top`, `bottom`, `left`, `right` |
| `categories` | One or more ids from `src/content/categories.json` — these become the filter chips |
| `order` | Optional position in the gallery; works without it follow, newest first |
| `published` | `false` hides the work without deleting it |

## Categories (filter tags)

Defined once in `src/content/categories.json` (id, label, order). A chip appears only when at least one published work uses it. A work that names a category that isn't in the list fails the build — on purpose, so typos never reach the site.

## Run locally

```
npm install
npm run dev
```
