// Public connection details for the Supabase project "beglikter".
// The publishable key is meant to be public: what it can do is limited by the database's row-level security
// (anyone may read published works; only studio members may write).
export const SUPABASE_URL = 'https://jwvubbmixwijmbeljpnl.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_dh1tuypQebRr2vXSlbREIQ_VATt1sSm';
export const WORKS_BUCKET = 'works';

export const imageUrl = (path: string) =>
  `${SUPABASE_URL}/storage/v1/object/public/${WORKS_BUCKET}/${path.split('/').map(encodeURIComponent).join('/')}`;

export const FRAMES = {
  original: { label: 'מקורי', ratio: null },
  landscape: { label: 'רוחבי 3:2', ratio: 3 / 2 },
  standard: { label: 'רוחבי 4:3', ratio: 4 / 3 },
  portrait: { label: 'אורכי 4:5', ratio: 4 / 5 },
  square: { label: 'ריבוע', ratio: 1 },
} as const;
export type Frame = keyof typeof FRAMES;

export const FOCUSES = {
  center: 'מרכז',
  top: 'למעלה',
  bottom: 'למטה',
  left: 'שמאל',
  right: 'ימין',
} as const;
export type Focus = keyof typeof FOCUSES;

/** Card image height for a 300px-wide card. */
export function cardImageHeight(frame: Frame, width: number | null, height: number | null, cardW = 300) {
  const r = FRAMES[frame].ratio ?? (width && height ? width / height : 3 / 2);
  return Math.round(cardW / r);
}
