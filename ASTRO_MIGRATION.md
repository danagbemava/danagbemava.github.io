# Astro Migration Notes

The Jekyll → Astro migration is complete. The site is built only by Astro;
the Jekyll files (`_config.yml`, `Gemfile`, `_layouts/`, `assets/`, root
`*.markdown`/`*.html` pages) have been removed.

## Content

Write content directly in the Astro collections (schemas in `src/content/config.ts`):

- Posts: `src/content/posts/YYYY-MM-DD-slug.md`
- Projects: `src/content/projects/*.md`
- Experiences: `src/content/experiences/*.md`
- Experiments: `src/content/experiments/*.md`

Post front matter:

```yaml
---
title: "Post title"
date: "YYYY-MM-DD"
categories: space separated tags
status: complete # or "incomplete" to hide it from the site
---
```

The post URL is `/posts/<file name without .md>/`.

## Routes

- Home: `src/pages/index.astro`
- Posts: `src/pages/posts/index.astro`, `src/pages/posts/[slug].astro`
- Projects: `src/pages/projects/index.astro`, `src/pages/projects/[slug].astro`
- Experiments, experiences, world, about, credits: `src/pages/*`
- 404: `src/pages/404.astro`

## Run locally

1. `npm install`
2. `npm run dev`

## Build

1. `npm run build`
2. Output is in `dist/`

## GitHub Pages

- Workflow: `.github/workflows/deploy-astro-pages.yml`
- Trigger: pushes to `main` (and manual runs)
- Repository setting: `Settings -> Pages -> Source` must be `GitHub Actions`
