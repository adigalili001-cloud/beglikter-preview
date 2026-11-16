// The design-system tokens (generated from Figma into src/styles/tokens.css) served as /ds/tokens.css,
// so the static pages in public/ use exactly the same variables as the Astro pages.
import type { APIRoute } from 'astro';
import tokens from '../../styles/tokens.css?raw';

export const GET: APIRoute = () =>
  new Response(tokens, { headers: { 'Content-Type': 'text/css; charset=utf-8' } });
