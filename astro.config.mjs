import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';

export default defineConfig({
  integrations: [preact()],
  // Images uploaded in the Studio live in Supabase Storage; Astro optimises them at build time.
  image: { domains: ['jwvubbmixwijmbeljpnl.supabase.co'] },
  // Only Works exists so far; the home page points there until it is designed.
  redirects: { '/': '/works' },
});
