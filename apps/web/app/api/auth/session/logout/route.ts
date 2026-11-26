import { NextRequest, NextResponse } from 'next/server';
import {
  SSO_SESSION_COOKIE,
  getBackendApiBase,
  validateCsrfAndOrigin,
  clearSharedSessionCookies,
} from '../_lib';
import { getBffSession, deleteBffSession, markHandlePendingRevocation } from '../_store';

export async function POST(req: NextRequest) {
  const csrfError = validateCsrfAndOrigin(req);
  if (csrfError) return csrfError;

  const handle = req.cookies.get(SSO_SESSION_COOKIE)?.value;

  let session: { accessToken?: string } | null = null;
  let redisLookupFailed = false;

  if (handle) {
    try {
      session = await getBffSession(handle);
    } catch {
      redisLookupFailed = true;
    }
  }

  const headerToken = req.headers
    .get('authorization')
    ?.replace(/^Bearer\s+/i, '')
    .trim();
  const token = session?.accessToken || headerToken || '';

  let backendRevoked = !token && !redisLookupFailed;

  if (token) {
    try {
      const backend = getBackendApiBase();
      const logoutRes = await fetch(`${backend}/api/v1/auth/sso/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
        cache: 'no-store',
      });
      backendRevoked = logoutRes.ok || logoutRes.status === 401;
    } catch {
      backendRevoked = false;
    }
  }

  let redisDeleted = true;
  if (handle) {
    try {
      await deleteBffSession(handle);
    } catch {
      redisDeleted = false;
      markHandlePendingRevocation(handle);
    }
  }

  const status = !redisDeleted ? 503 : !backendRevoked ? 502 : 200;
  const success = redisDeleted && backendRevoked;
  const message = !redisDeleted
    ? 'Failed to revoke shared session in session store'
    : !backendRevoked
      ? 'Failed to confirm backend session revocation'
      : undefined;

  const res = NextResponse.json(
    {
      success,
      redisDeleted,
      backendRevoked,
      ...(message ? { message } : {}),
    },
    {
      status,
      headers: { 'Cache-Control': 'no-store' },
    },
  );
  clearSharedSessionCookies(req, res);
  return res;
}
