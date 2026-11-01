import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, WORKS_BUCKET, imageUrl, type Frame, type Focus } from '../lib/supabase-config';

export const sb = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

export type Category = { id: string; label: string; sort_order: number };
export type Work = {
  id: string | null;
  slug: string;
  title: string;
  year: number | '';
  medium: string;
  note: string;
  image_path: string | null;
  image_width: number | null;
  image_height: number | null;
  alt: string;
  frame: Frame;
  focus: Focus;
  sort_order: number;
  published: boolean;
  categories: string[];
};

export const emptyWork = (): Work => ({
  id: null, slug: '', title: '', year: new Date().getFullYear(), medium: '', note: '',
  image_path: null, image_width: null, image_height: null, alt: '',
  frame: 'original', focus: 'center', sort_order: 0, published: false, categories: [],
});

export async function loadAll(): Promise<{ works: Work[]; categories: Category[] }> {
  const [w, c] = await Promise.all([
    sb.from('works').select('*, work_categories(category_id)').order('sort_order'),
    sb.from('categories').select('*').order('sort_order'),
  ]);
  if (w.error) throw w.error;
  if (c.error) throw c.error;
  const works = (w.data ?? []).map((r: any) => ({
    ...r, note: r.note ?? '', categories: (r.work_categories ?? []).map((l: any) => l.category_id),
  })) as Work[];
  return { works, categories: c.data as Category[] };
}

export async function saveWork(w: Work): Promise<string> {
  const { data, error } = await sb.rpc('save_work', { p: { ...w, id: w.id ?? '' } });
  if (error) throw error;
  return data as string;
}

export async function deleteWork(w: Work) {
  const { error } = await sb.from('works').delete().eq('id', w.id!);
  if (error) throw error;
  if (w.image_path) await sb.storage.from(WORKS_BUCKET).remove([w.image_path]);
}

export async function uploadImage(file: Blob, ext: string) {
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await sb.storage.from(WORKS_BUCKET).upload(path, file, { contentType: file.type || 'image/jpeg' });
  if (error) throw error;
  return path;
}

export async function removeImage(path: string) {
  await sb.storage.from(WORKS_BUCKET).remove([path]);
}

export const publicImage = (path: string | null) => (path ? imageUrl(path) : null);

/** Natural pixel size of an image file, read in the browser. */
export async function imageSize(file: Blob) {
  const bmp = await createImageBitmap(file);
  const size = { width: bmp.width, height: bmp.height };
  bmp.close();
  return size;
}

export function slugify(s: string) {
  return s
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[’']/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/** Hebrew wording for the errors people can actually hit. */
export function explain(e: any): string {
  const m = String(e?.message ?? e ?? '');
  if (/Invalid login credentials/i.test(m)) return 'מייל או סיסמה שגויים.';
  if (/works_slug_key|duplicate key.*slug/i.test(m)) return 'כבר קיימת עבודה עם אותה כתובת (slug). שני אותה בשדה המתקדם.';
  if (/categories_pkey|duplicate key/i.test(m)) return 'כבר קיימת קטגוריה בשם הזה.';
  if (/row-level security|permission denied/i.test(m)) return 'אין הרשאה לפעולה הזו. נסי להתנתק ולהתחבר שוב.';
  if (/payload too large|exceeded the maximum/i.test(m)) return 'הקובץ גדול מדי (עד 20MB).';
  if (/Failed to fetch|NetworkError/i.test(m)) return 'אין חיבור לשרת. בדקי את האינטרנט ונסי שוב.';
  if (/Password should be/i.test(m)) return 'הסיסמה קצרה או חלשה מדי.';
  return m || 'משהו השתבש.';
}
