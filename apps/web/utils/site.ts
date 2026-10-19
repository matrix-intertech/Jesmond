/**
 * Helper to obtain the canonical site origin for metadata, sitemaps, and robots.
 * Preserves strict environment isolation so staging and dev do not leak production URLs.
 */

export function isProductionEnvironment(): boolean {
  // Explicit non-production signals
  const appEnv = (process.env.NEXT_PUBLIC_APP_ENV || process.env.APP_ENV || '').toLowerCase();
  if (appEnv === 'staging' || appEnv === 'development' || appEnv === 'test') {
    return false;
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (siteUrl && (siteUrl.includes('staging') || siteUrl.includes('localhost') || siteUrl.includes('127.0.0.1'))) {
    return false;
  }

  // Only considered production if explicitly configured as production or pointing directly to verified production domain
  return appEnv === 'production' || (siteUrl === 'https://jesmond.matrixspaces.com' && process.env.NODE_ENV === 'production');
}

export function getSiteUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const isProd = isProductionEnvironment();

  if (envUrl) {
    const cleanUrl = envUrl.replace(/\/+$/, '');
    // In staging or development, never allow silent inheritance/leakage of the production domain
    if (!isProd && cleanUrl.includes('jesmond.matrixspaces.com')) {
      const appEnv = (process.env.NEXT_PUBLIC_APP_ENV || process.env.APP_ENV || '').toLowerCase();
      return appEnv === 'staging' ? 'http://localhost:3302' : 'http://localhost:3000';
    }
    return cleanUrl;
  }

  // Only use verified production domain if explicitly in production environment
  if (isProd) {
    return 'https://jesmond.matrixspaces.com';
  }

  // Staging or development fallback (never emit production canonical when not verified production)
  const appEnv = (process.env.NEXT_PUBLIC_APP_ENV || process.env.APP_ENV || '').toLowerCase();
  if (appEnv === 'staging') {
    return 'http://localhost:3302';
  }

  return 'http://localhost:3000';
}
