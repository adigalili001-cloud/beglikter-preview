import { defineCollection, reference, z } from 'astro:content';
import { glob, file } from 'astro/loaders';

/**
 * Categories = the filter tags on the Works page.
 * They are defined once, in src/content/categories.json. A work can only use a category from this list,
 * so a typo ("Instalation") fails the build instead of quietly creating a new chip.
 */
const categories = defineCollection({
  loader: file('src/content/categories.json'),
  schema: z.object({
    label: z.string(),
    order: z.number().default(0),
  }),
});

/** Each work is one file in src/content/works/ with its image next to it in images/. */
const works = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/works' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      year: z.number().int(),
      medium: z.string(),
      note: z.string().optional(),
      image: image(),
      alt: z.string(),
      /** How the image is framed in the gallery. "original" keeps the photo's own proportions. */
      frame: z.enum(['original', 'landscape', 'standard', 'portrait', 'square']).default('original'),
      /** Which part of the photo stays visible when the frame crops it. */
      focus: z.enum(['center', 'top', 'bottom', 'left', 'right']).default('center'),
      categories: z.array(reference('categories')).min(1),
      /** Optional manual position in the gallery (1 = first). Works without it follow, newest first. */
      order: z.number().int().optional(),
      published: z.boolean().default(true),
    }),
});

export const collections = { categories, works };
