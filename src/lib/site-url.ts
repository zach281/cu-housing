import "server-only";

/**
 * The public address of the site, used to build links in auth emails.
 *
 * 1. SITE_URL, if set (e.g. once you add a custom domain).
 * 2. On Vercel, the project's production domain, which Vercel provides
 *    automatically, so nothing needs configuring.
 * 3. Local development.
 */
export function getSiteUrl(): string {
  const explicit = process.env.SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  const vercelProduction = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercelProduction) return `https://${vercelProduction.replace(/\/+$/, "")}`;

  return "http://localhost:3000";
}
