import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';

export default defineConfig({
  integrations: [preact()],
  // Images uploaded in the admin live in Supabase Storage; Astro optimises them at build time.
  image: { domains: ['jwvubbmixwijmbeljpnl.supabase.co'] },
  // Home, About, Press, Volume for Value and the work page are still the earlier static pages
  // (copied from the main branch into public/); Works is the designed page.
  redirects: { '/studio': '/admin', '/works.html': '/works' },
});
