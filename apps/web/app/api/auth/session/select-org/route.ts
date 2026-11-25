import { NextRequest, NextResponse } from 'next/server';
import {
  SSO_SESSION_COOKIE,
  getBackendApiBase,
  validateCsrfAndOrigin,
  setSelectedOrgCookie,
  clearSharedSessionCookies,
} from '../_lib';
import { getBffSession, saveBffSession, deleteBffSession } from '../_store';

export async function POST(req: NextRequest) {
  const csrfError = validateCsrfAndOrigin(req);
  if (csrfError) return csrfError;

  try {
    const body = await req.json().catch(() => ({}));
    const organizationId =
      typeof body?.organizationId === 'string' ? body.organizationId.trim() : '';

    if (!organizationId) {
      return NextResponse.json(
        { message: 'organizationId is required' },
        { status: 400 },
      );
    }

    const handle = req.cookies.get(SSO_SESSION_COOKIE)?.value;
    if (!handle) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const session = await getBffSession(handle);
    if (!session) {
      const res = NextResponse.json({ message: 'Session expired' }, { status: 401 });
      clearSharedSessionCookies(req, res);
      return res;
    }

    // Fail-closed backend membership check
    const backend = getBackendApiBase();
    let checkRes: Response;
    try {
      checkRes = await fetch(`${backend}/api/v1/auth/sso/business-check`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          'X-Organization-Id': organizationId,
        },
        cache: 'no-store',
      });
    } catch {
      return NextResponse.json(
        { message: 'Authentication backend unavailable' },
        { status: 503 },
      );
    }

    if (checkRes.status === 401) {
      await deleteBffSession(handle);
      const res = NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
      clearSharedSessionCookies(req, res);
      return res;
    }

    if (!checkRes.ok) {
      return NextResponse.json(
        { message: 'Failed to verify organization membership' },
        { status: checkRes.status === 403 ? 403 : 503 },
      );
    }

    const data = await checkRes.json();
    const authorized = (data.organizations || []).some(
      (o: any) => o.organizationId === organizationId,
    );
    if (!authorized && !data.isAdmin) {
      return NextResponse.json(
        { message: 'You do not have access to this organization' },
        { status: 403 },
      );
    }

    const ttlSeconds = Math.max(
      60,
      Math.floor((session.expiresAt - Date.now()) / 1000),
    );
    await saveBffSession(
      handle,
      { ...session, organizationId },
      ttlSeconds,
    );

    const res = NextResponse.json(
      { success: true, organizationId },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
    setSelectedOrgCookie(req, res, organizationId);
    return res;
  } catch {
    return NextResponse.json(
      { message: 'Failed to select organization' },
      { status: 500 },
    );
  }
}
