import { NextRequest, NextResponse } from 'next/server';
import {
  SSO_SESSION_COOKIE,
  SSO_ORG_COOKIE,
  getBackendApiBase,
  getValidatedHostname,
  clearSharedSessionCookies,
} from './_lib';
import { getBffSession, deleteBffSession } from './_store';

export async function GET(req: NextRequest) {
  const hostname = getValidatedHostname(req);
  if (!hostname) {
    return NextResponse.json(
      { authenticated: false, user: null, message: 'Untrusted portal host' },
      { status: 403, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const handle = req.cookies.get(SSO_SESSION_COOKIE)?.value;
  if (!handle) {
    return NextResponse.json(
      { authenticated: false, user: null },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  let session;
  try {
    session = await getBffSession(handle);
  } catch {
    return NextResponse.json(
      { authenticated: false, user: null, error: 'Session store unavailable' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  if (!session) {
    const res = NextResponse.json(
      { authenticated: false, user: null },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
    clearSharedSessionCookies(req, res);
    return res;
  }

  const orgId =
    req.headers.get('x-organization-id') ||
    session.organizationId ||
    req.cookies.get(SSO_ORG_COOKIE)?.value ||
    undefined;

  const backend = getBackendApiBase();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${session.accessToken}`,
    'Cache-Control': 'no-cache, no-store, must-revalidate',
  };
  if (orgId) {
    headers['X-Organization-Id'] = orgId;
  }

  try {
    const meRes = await fetch(`${backend}/api/v1/auth/me`, {
      method: 'GET',
      headers,
      cache: 'no-store',
    });

    if (meRes.status === 401) {
      await deleteBffSession(handle);
      const res = NextResponse.json(
        { authenticated: false, user: null },
        { status: 401, headers: { 'Cache-Control': 'no-store' } },
      );
      clearSharedSessionCookies(req, res);
      return res;
    }

    if (meRes.status === 403) {
      const bizRes = await fetch(`${backend}/api/v1/auth/sso/business-check`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${session.accessToken}` },
        cache: 'no-store',
      });
      if (bizRes.ok) {
        const bizData = await bizRes.json();
        if (bizData.requiresOrganizationSelection) {
          return NextResponse.json(
            {
              authenticated: true,
              requiresOrganizationSelection: true,
              organizations: bizData.organizations || [],
              user: {
                id: bizData.userId,
                email: bizData.email,
                role: bizData.role,
              },
            },
            { status: 200, headers: { 'Cache-Control': 'no-store' } },
          );
        }
      }
      return NextResponse.json(
        { authenticated: false, user: null },
        { status: 403, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    if (!meRes.ok) {
      return NextResponse.json(
        { authenticated: false, user: null },
        { status: meRes.status, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const meData = await meRes.json();
    const user = meData?.user || meData;
    return NextResponse.json(
      {
        authenticated: true,
        user,
        organizationId: user?.organizationId || orgId || null,
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return NextResponse.json(
      { authenticated: false, user: null, error: 'Backend session check failed' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
