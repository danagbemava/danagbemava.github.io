import { defineCollection, z } from "astro:content";

const sharedOptional = {
  layout: z.string().optional(),
  permalink: z.string().optional(),
  description: z.string().optional()
};

const publicationStatus = z.enum(["complete", "incomplete"]).default("complete");

const posts = defineCollection({
  schema: z.object({
    title: z.string(),
    date: z.coerce.date().optional(),
    categories: z.union([z.string(), z.array(z.string())]).optional(),
    status: publicationStatus,
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
    status: publicationStatus,
    tech: z.array(techItem).optional(),
    features: z.array(z.string()).optional(),
    repo: z.string().optional(),
    live: z.string().optional(),
    ...sharedOptional
  })
});

const experienceProject = z.object({
  name: z.string(),
  link: z.string().optional(),
  tools: z.array(z.string()).optional()
});

const experienceClient = z.object({
  name: z.string(),
  projects: z.array(experienceProject).optional()
});

const experiences = defineCollection({
  schema: z.object({
    title: z.string(),
    company: z.string(),
    tenure: z.string(),
    order: z.number().optional(),
    activities: z.array(z.string()).default([]),
    clients: z.array(experienceClient).optional(),
    summary: z.string().optional(),
    ...sharedOptional
  })
});

const experiments = defineCollection({
  schema: z.object({
    title: z.string(),
    script: z.string(),
    ...sharedOptional
  })
});

export const collections = { posts, projects, experiences, experiments };
