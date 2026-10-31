import { defineConfig } from 'astro/config';

export default defineConfig({
  // Only Works exists so far; the home page points there until it is designed.
  redirects: { '/': '/works' },
});
