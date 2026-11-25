import { NextRequest, NextResponse } from 'next/server';

export const SSO_SESSION_COOKIE = 'jesmond_sso_session';
export const SSO_ORG_COOKIE = 'jesmond_sso_org';

const PRODUCTION_ALLOWED_HOSTS = new Set([
  'jesmond.com.au',
  'www.jesmond.com.au',
  'business.jesmond.com.au',
]);

function getConfiguredHosts(): Set<string> {
  const hosts = new Set<string>(PRODUCTION_ALLOWED_HOSTS);
  for (const envUrl of [
    process.env.PORTAL_STUDENT_URL,
    process.env.PORTAL_BUSINESS_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.NEXT_PUBLIC_PORTAL_BUSINESS_URL,
  ]) {
    if (envUrl) {
      try {
        hosts.add(new URL(envUrl).hostname.toLowerCase());
      } catch {}
    }
  }
  if (process.env.ALLOWED_PORTAL_HOSTS) {
    for (const h of process.env.ALLOWED_PORTAL_HOSTS.split(',')) {
      const clean = h.trim().toLowerCase();
      if (clean) hosts.add(clean);
    }
  }
  if (process.env.NODE_ENV !== 'production') {
    hosts.add('localhost');
    hosts.add('business.localhost');
    hosts.add('127.0.0.1');
  }
  return hosts;
}

export function getBackendApiBase(): string {
  const base =
    process.env.INTERNAL_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:3001';
  return base.replace(/\/+$/, '');
}

function shouldTrustProxyHeaders(): boolean {
  return (
    process.env.TRUST_PROXY === 'true' ||
    process.env.NODE_ENV === 'production'
  );
}

export function getValidatedHostname(req: NextRequest): string | null {
  const allowedHosts = getConfiguredHosts();
  const directHost = (
    req.headers.get('host') ||
    req.nextUrl.hostname ||
    ''
  )
    .split(',')[0]
    .trim()
    .split(':')[0]
    .toLowerCase();

  if (shouldTrustProxyHeaders()) {
    const forwardedHost = (req.headers.get('x-forwarded-host') || '')
      .split(',')[0]
      .trim()
      .split(':')[0]
      .toLowerCase();
    if (forwardedHost) {
      return allowedHosts.has(forwardedHost) ? forwardedHost : null;
    }
  }

  return allowedHosts.has(directHost) ? directHost : null;
}

export function isSecureRequest(req: NextRequest): boolean {
  if (process.env.NODE_ENV === 'production' || process.env.COOKIE_SECURE === 'true') {
    return true;
  }
  if (shouldTrustProxyHeaders()) {
    const forwardedProto = req.headers.get('x-forwarded-proto');
    if (forwardedProto === 'https') return true;
  }
  return req.nextUrl.protocol === 'https:';
}

export function getCookieDomain(req: NextRequest): string | undefined {
  if (process.env.SSO_COOKIE_SCOPE === 'host-only') {
    return undefined;
  }
  const hostname = getValidatedHostname(req);
  if (!hostname) return undefined;
  if (/(^|\.)jesmond\.com\.au$/i.test(hostname)) {
    return '.jesmond.com.au';
  }
  return undefined;
}

export function validateCsrfAndOrigin(req: NextRequest): NextResponse | null {
  const hostname = getValidatedHostname(req);
  if (!hostname) {
    return NextResponse.json(
      { message: 'Untrusted portal host' },
      { status: 403 },
    );
  }

  const contentType = (req.headers.get('content-type') || '').toLowerCase();
  if (!contentType.includes('application/json')) {
    return NextResponse.json(
      { message: 'Content-Type must be application/json' },
      { status: 415 },
    );
  }

  const secFetchSite = (req.headers.get('sec-fetch-site') || '').toLowerCase();
  if (secFetchSite && secFetchSite !== 'same-origin' && secFetchSite !== 'same-site' && secFetchSite !== 'none') {
    return NextResponse.json(
      { message: 'Cross-site request blocked' },
      { status: 403 },
    );
  }

  const allowedHosts = getConfiguredHosts();
  const originHeader = req.headers.get('origin');
  const refererHeader = req.headers.get('referer');

  if (originHeader) {
    try {
      const originHost = new URL(originHeader).hostname.toLowerCase();
      if (!allowedHosts.has(originHost)) {
        return NextResponse.json(
          { message: 'Untrusted request origin' },
          { status: 403 },
        );
      }
    } catch {
      return NextResponse.json(
        { message: 'Invalid request origin' },
        { status: 403 },
      );
    }
  } else if (refererHeader) {
    try {
      const refHost = new URL(refererHeader).hostname.toLowerCase();
      if (!allowedHosts.has(refHost)) {
        return NextResponse.json(
          { message: 'Untrusted request referer' },
          { status: 403 },
        );
      }
    } catch {
      return NextResponse.json(
        { message: 'Invalid request referer' },
        { status: 403 },
      );
    }
  } else if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { message: 'Origin header is required' },
      { status: 403 },
    );
  }

  return null;
}

export function setSharedSessionCookies(
  req: NextRequest,
  res: NextResponse,
  sessionHandle: string,
  organizationId?: string | null,
) {
  const secure = isSecureRequest(req);
  const domain = getCookieDomain(req);
  const maxAge = 7 * 24 * 60 * 60;

  res.cookies.set(SSO_SESSION_COOKIE, sessionHandle, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge,
    ...(domain ? { domain } : {}),
  });

  if (organizationId) {
    res.cookies.set(SSO_ORG_COOKIE, organizationId, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge,
      ...(domain ? { domain } : {}),
    });
  }
}

export function setSelectedOrgCookie(
  req: NextRequest,
  res: NextResponse,
  organizationId: string,
) {
  const secure = isSecureRequest(req);
  const domain = getCookieDomain(req);

  res.cookies.set(SSO_ORG_COOKIE, organizationId, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60,
    ...(domain ? { domain } : {}),
  });
}

export function clearSharedSessionCookies(
  req: NextRequest,
  res: NextResponse,
) {
  const secure = isSecureRequest(req);
  const domain = getCookieDomain(req);

  for (const name of [SSO_SESSION_COOKIE, SSO_ORG_COOKIE]) {
    res.cookies.set(name, '', {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
    if (domain) {
      res.cookies.set(name, '', {
        httpOnly: true,
        secure,
        sameSite: 'lax',
        path: '/',
        maxAge: 0,
        domain,
      });
    }
  }
}

export function isValidJwtFormat(token: unknown): token is string {
  if (typeof token !== 'string') return false;
  const parts = token.trim().split('.');
  return parts.length === 3 && parts.every((p) => p.length > 0);
}

export function validateJwtClaims(token: string): {
  valid: boolean;
  sub?: string;
  exp?: number;
  reason?: string;
} {
  try {
    const parts = token.split('.');
    const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf8');
    const payload = JSON.parse(payloadJson);

    if (typeof payload.exp === 'number' && payload.exp * 1000 <= Date.now()) {
      return { valid: false, reason: 'Token expired' };
    }
    if (process.env.JWT_ISSUER && payload.iss !== process.env.JWT_ISSUER) {
      return { valid: false, reason: 'Invalid token issuer' };
    }
    if (process.env.JWT_AUDIENCE && payload.aud !== process.env.JWT_AUDIENCE) {
      return { valid: false, reason: 'Invalid token audience' };
    }
    return { valid: true, sub: payload.sub, exp: payload.exp };
  } catch {
    return { valid: false, reason: 'Malformed JWT payload' };
  }
}
