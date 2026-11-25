import { NextRequest, NextResponse } from 'next/server';
import {
  SSO_SESSION_COOKIE,
  SSO_ORG_COOKIE,
  getBackendApiBase,
  getValidatedHostname,
} from '../../auth/session/_lib';
import { getBffSession } from '../../auth/session/_store';

async function proxyRequest(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const hostname = getValidatedHostname(req);
  if (!hostname) {
    return NextResponse.json({ message: 'Untrusted portal host' }, { status: 403 });
  }

  const { path } = await context.params;
  const joinedPath = (path || []).join('/');
  const backend = getBackendApiBase();
  const targetUrl = `${backend}/api/v1/${joinedPath}${req.nextUrl.search}`;

  const forwardHeaders = new Headers();
  for (const [k, v] of req.headers.entries()) {
    const lower = k.toLowerCase();
    if (lower === 'host' || lower === 'connection' || lower === 'content-length' || lower === 'cookie') {
      continue;
    }
    forwardHeaders.set(k, v);
  }

  const handle = req.cookies.get(SSO_SESSION_COOKIE)?.value;
  if (handle) {
    try {
      const session = await getBffSession(handle);
      if (session) {
        if (!forwardHeaders.has('authorization')) {
          forwardHeaders.set('authorization', `Bearer ${session.accessToken}`);
        }
        const orgId =
          session.organizationId || req.cookies.get(SSO_ORG_COOKIE)?.value;
        if (orgId && !forwardHeaders.has('x-organization-id')) {
          forwardHeaders.set('x-organization-id', orgId);
        }
      }
    } catch {
      return NextResponse.json(
        { message: 'Session store unavailable' },
        { status: 503 },
      );
    }
  }

  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
  const body = hasBody ? await req.arrayBuffer() : undefined;

  let backendRes: Response;
  try {
    backendRes = await fetch(targetUrl, {
      method: req.method,
      headers: forwardHeaders,
      body,
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json(
      { message: 'Backend API unavailable' },
      { status: 502 },
    );
  }

  const responseHeaders = new Headers();
  for (const [k, v] of backendRes.headers.entries()) {
    const lower = k.toLowerCase();
    if (lower === 'set-cookie' || lower === 'content-encoding' || lower === 'transfer-encoding') {
      continue;
    }
    responseHeaders.set(k, v);
  }
  responseHeaders.set('Cache-Control', 'no-store');

  const isNullBodyStatus = backendRes.status === 204 || backendRes.status === 304;
  return new NextResponse(isNullBodyStatus ? null : backendRes.body, {
    status: backendRes.status,
    headers: responseHeaders,
  });
}

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const PATCH = proxyRequest;
export const DELETE = proxyRequest;
export const HEAD = proxyRequest;
export const OPTIONS = proxyRequest;
