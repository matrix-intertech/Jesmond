import { NextRequest, NextResponse } from 'next/server';
import {
  getBackendApiBase,
  isValidJwtFormat,
  validateJwtClaims,
  validateCsrfAndOrigin,
  setSharedSessionCookies,
} from '../_lib';
import { generateOpaqueSessionHandle, saveBffSession } from '../_store';

const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

export async function POST(req: NextRequest) {
  const csrfError = validateCsrfAndOrigin(req);
  if (csrfError) return csrfError;

  try {
    const body = await req.json().catch(() => ({}));
    const accessToken = body?.access_token;
    const organizationId =
      typeof body?.organizationId === 'string' && body.organizationId.trim()
        ? body.organizationId.trim()
        : undefined;

    if (!isValidJwtFormat(accessToken)) {
      return NextResponse.json(
        { message: 'Valid access_token is required' },
        { status: 400 },
      );
    }

    const claims = validateJwtClaims(accessToken);
    if (!claims.valid) {
      return NextResponse.json(
        { message: claims.reason || 'Invalid JWT claims' },
        { status: 401 },
      );
    }

    // Fail-closed backend verification (signature, expiry, revocation, and org access)
    const backend = getBackendApiBase();
    let verifyRes: Response;
    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${accessToken}`,
        'Cache-Control': 'no-store',
      };
      if (organizationId) {
        headers['X-Organization-Id'] = organizationId;
      }
      verifyRes = await fetch(`${backend}/api/v1/auth/sso/business-check`, {
        method: 'GET',
        headers,
        cache: 'no-store',
      });
    } catch {
      return NextResponse.json(
        { message: 'Authentication backend unavailable' },
        { status: 503 },
      );
    }

    if (verifyRes.status === 401 || verifyRes.status === 403) {
      return NextResponse.json(
        { message: 'Invalid, expired, or revoked token' },
        { status: 401 },
      );
    }

    if (!verifyRes.ok) {
      return NextResponse.json(
        { message: 'Failed to verify session with backend' },
        { status: 503 },
      );
    }

    const verifyData = await verifyRes.json();
    if (organizationId) {
      const hasOrg = (verifyData.organizations || []).some(
        (o: any) => o.organizationId === organizationId,
      );
      if (!hasOrg && !verifyData.isAdmin) {
        return NextResponse.json(
          { message: 'Unauthorized organization selection' },
          { status: 403 },
        );
      }
    }

    const handle = generateOpaqueSessionHandle();
    const now = Date.now();
    await saveBffSession(
      handle,
      {
        accessToken,
        organizationId,
        userId: verifyData.userId || claims.sub,
        createdAt: now,
        expiresAt: now + SESSION_TTL_SECONDS * 1000,
      },
      SESSION_TTL_SECONDS,
    );

    const res = NextResponse.json(
      { success: true },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
    setSharedSessionCookies(req, res, handle, organizationId);
    return res;
  } catch {
    return NextResponse.json(
      { message: 'Failed to establish shared session' },
      { status: 500 },
    );
  }
}
