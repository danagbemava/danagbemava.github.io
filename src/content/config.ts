import { defineCollection, z } from "astro:content";

const sharedOptional = {
  layout: z.string().optional(),
  permalink: z.string().optional(),
  description: z.string().optional()
};

const posts = defineCollection({
  schema: z.object({
    title: z.string(),
    date: z.coerce.date().optional(),
    categories: z.union([z.string(), z.array(z.string())]).optional(),
    ...sharedOptional
  })
});

const techItem = z.object({
  name: z.string(),
  icon: z.string().optional()
});

const projects = defineCollection({
  schema: z.object({
    title: z.string(),
    timeline_year: z.string().optional(),
    stack: z.union([z.string(), z.array(z.string())]).optional(),
    tech: z.array(techItem).optional(),
    features: z.array(z.string()).optional(),
    repo: z.string().optional(),
    live: z.string().optional(),
    ...sharedOptional
  })
});

const experiences = defineCollection({
  schema: z.object({
    title: z.string(),
    company: z.string(),
    tenure: z.string(),
    order: z.number().optional(),
    activities: z.array(z.string()).default([]),
    summary: z.string().optional(),
    ...sharedOptional
  })
});

export const collections = { posts, projects, experiences };
