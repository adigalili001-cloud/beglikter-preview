import { defineCollection, z } from 'astro:content';
import type { Loader } from 'astro/loaders';
import { readFileSync } from 'node:fs';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, imageUrl } from './lib/supabase-config';

/**
 * Content is managed in the Studio (/studio) and stored in Supabase.
 * At build time the site reads the published works and the categories.
 * Every save in the Studio asks Vercel to rebuild, so the site follows within about a minute.
 *
 * CONTENT_FIXTURE=1 builds from design/content-fixture.json instead (for offline development).
 */
const useFixture = process.env.CONTENT_FIXTURE === '1';

async function rest<T>(path: string): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}` },
  });
  if (!res.ok) throw new Error(`Supabase ${path}: ${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

type Row = Record<string, any>;
let cache: Promise<{ works: Row[]; categories: Row[] }> | null = null;
function load() {
  cache ??= (async () => {
    if (useFixture) return JSON.parse(readFileSync('design/content-fixture.json', 'utf8'));
    const [works, categories] = await Promise.all([
      rest<Row[]>('works?select=*,work_categories(category_id)&published=eq.true&order=sort_order.asc,year.desc'),
      rest<Row[]>('categories?select=*&order=sort_order.asc'),
    ]);
    // An image that hasn't been uploaded yet must not break the build: the card then shows an empty frame.
    await Promise.all(works.map(async (w) => {
      w.image_url = null;
      if (!w.image_path) return;
      const url = imageUrl(w.image_path);
      const head = await fetch(url, { method: 'HEAD' });
      if (head.ok) w.image_url = url;
    }));
    return { works, categories };
  })();
  return cache;
}

const worksLoader: Loader = {
  name: 'supabase-works',
  async load({ store, parseData }) {
    store.clear();
    const { works } = await load();
    for (const w of works) {
      const data = await parseData({
        id: w.slug,
        data: {
          title: w.title, year: w.year, medium: w.medium ?? '', note: w.note ?? undefined,
          imageUrl: w.image_url ?? undefined, imageWidth: w.image_width ?? undefined, imageHeight: w.image_height ?? undefined,
          alt: w.alt ?? '', frame: w.frame, focus: w.focus, sortOrder: w.sort_order,
          categories: (w.work_categories ?? []).map((l: Row) => l.category_id),
        },
      });
      store.set({ id: w.slug, data });
    }
  },
};

const categoriesLoader: Loader = {
  name: 'supabase-categories',
  async load({ store, parseData }) {
    store.clear();
    const { categories } = await load();
    for (const c of categories) {
      store.set({ id: c.id, data: await parseData({ id: c.id, data: { label: c.label, order: c.sort_order } }) });
    }
  },
};

const works = defineCollection({
  loader: worksLoader,
  schema: z.object({
    title: z.string(),
    year: z.number().int(),
    medium: z.string(),
    note: z.string().optional(),
    imageUrl: z.string().optional(),
    imageWidth: z.number().optional(),
    imageHeight: z.number().optional(),
    alt: z.string(),
    frame: z.enum(['original', 'landscape', 'standard', 'portrait', 'square']),
    focus: z.enum(['center', 'top', 'bottom', 'left', 'right']),
    sortOrder: z.number(),
    categories: z.array(z.string()),
  }),
});

const categories = defineCollection({
  loader: categoriesLoader,
  schema: z.object({ label: z.string(), order: z.number() }),
});

export const collections = { works, categories };
