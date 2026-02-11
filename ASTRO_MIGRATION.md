# Astro Migration Notes

This repo now includes an Astro app in parallel with the existing Jekyll files.

## Why

- Full-viewport timeline scenes (not embedded in a narrow content wrapper)
- Better control of 3D state, routing, and interaction logic
- Cleaner path for future game-like features

## New app entry points

- Home: `src/pages/index.astro`
- Projects timeline: `src/pages/projects/index.astro`
- Posts timeline: `src/pages/posts/index.astro`
- Project detail route: `src/pages/projects/[slug].astro`
- Post detail route: `src/pages/posts/[slug].astro`

## Content workflow

Keep writing in:

- `_posts/*.md`
- `_projects/*.md`

Before dev/build, content is synced into Astro collections at `src/content/*` via:

- `npm run sync-content`

This is already part of `npm run dev` and `npm run build`.

## Run locally

1. `npm install`
2. `npm run dev`

## Build

1. `npm run build`
2. Output is in `dist/`

## GitHub Pages

- Workflow: `.github/workflows/deploy-astro-pages.yml`
- Trigger: pushes to `main` (and manual runs)
- Pages settings in repository:
  - Go to `Settings -> Pages`
  - Set `Source` to `GitHub Actions`
