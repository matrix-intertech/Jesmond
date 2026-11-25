import { NextRequest, NextResponse } from 'next/server';
import {
  SSO_SESSION_COOKIE,
  getBackendApiBase,
  validateCsrfAndOrigin,
  clearSharedSessionCookies,
} from '../_lib';
import { getBffSession, deleteBffSession } from '../_store';

export async function POST(req: NextRequest) {
  const csrfError = validateCsrfAndOrigin(req);
  if (csrfError) return csrfError;

  const handle = req.cookies.get(SSO_SESSION_COOKIE)?.value;
  const session = handle ? await getBffSession(handle) : null;
  const token =
    session?.accessToken ||
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

  let backendRevoked = !token;

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

  if (handle) {
    await deleteBffSession(handle);
  }

  const res = NextResponse.json(
    {
      success: backendRevoked,
      backendRevoked,
      ...(backendRevoked ? {} : { message: 'Failed to confirm backend session revocation' }),
    },
    {
      status: backendRevoked ? 200 : 502,
      headers: { 'Cache-Control': 'no-store' },
    },
  );
  clearSharedSessionCookies(req, res);
  return res;
}
