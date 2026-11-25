import { NextRequest, NextResponse } from 'next/server';
import {
  SSO_SESSION_COOKIE,
  getBackendApiBase,
  validateCsrfAndOrigin,
  setSharedSessionCookies,
  clearSharedSessionCookies,
} from '../_lib';
import { getBffSession, rotateBffSession, deleteBffSession } from '../_store';

export async function POST(req: NextRequest) {
  const csrfError = validateCsrfAndOrigin(req);
  if (csrfError) return csrfError;

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

  // Verify backend session is still valid before rotating handle
  const backend = getBackendApiBase();
  let checkRes: Response;
  try {
    checkRes = await fetch(`${backend}/api/v1/auth/sso/business-check`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        ...(session.organizationId ? { 'X-Organization-Id': session.organizationId } : {}),
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
    const res = NextResponse.json({ message: 'Session revoked or expired' }, { status: 401 });
    clearSharedSessionCookies(req, res);
    return res;
  }

  if (!checkRes.ok) {
    return NextResponse.json(
      { message: 'Failed to validate session for rotation' },
      { status: 503 },
    );
  }

  const rotated = await rotateBffSession(handle);
  if (!rotated) {
    const res = NextResponse.json({ message: 'Session not found' }, { status: 401 });
    clearSharedSessionCookies(req, res);
    return res;
  }

  const res = NextResponse.json(
    { success: true },
    { status: 200, headers: { 'Cache-Control': 'no-store' } },
  );
  setSharedSessionCookies(req, res, rotated.newHandle, rotated.record.organizationId);
  return res;
}
