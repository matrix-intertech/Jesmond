/**
 * Jesmond 2.0 — Single Sign-On (SSO) & PKCE Client Utilities
 * RFC 7636 Proof Key for Code Exchange (S256) and Cross-Subdomain Authorization
 */

import {
  getAccessToken,
  setAccessToken,
  setCurrentUser,
  clearAuth,
  getSelectedOrganizationId,
  setSelectedOrganizationId,
  getDashboardRouteForUser,
  isAuthorizedRouteForUser,
  User,
} from './auth';

export interface BusinessOrganizationSummary {
  organizationId: string;
  organizationName: string;
  orgType: string;
  businessCategory?: string;
  status?: string;
  role: string;
  permissions: string[];
  retailBranchId?: string | null;
}

export interface BusinessAccessStatus {
  hasBusinessAccess: boolean;
  isAdmin: boolean;
  requiresOrganizationSelection?: boolean;
  organizations: BusinessOrganizationSummary[];
  activeOrganization: BusinessOrganizationSummary | null;
  error?: string;
  statusCode?: number;
}

/**
 * Base64URL encoder without padding (RFC 7636 Section 3)
 */
function base64UrlEncode(buffer: Uint8Array): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Generates cryptographically secure 32-byte code verifier (43 chars base64url).
 */
export function generateCodeVerifier(): string {
  if (typeof window === 'undefined' || !window.crypto) {
    throw new Error('Web Crypto API is not available');
  }
  const randomBytes = new Uint8Array(32);
  window.crypto.getRandomValues(randomBytes);
  return base64UrlEncode(randomBytes);
}

/**
 * Generates SHA-256 code challenge from verifier using Web Crypto (RFC 7636 Section 4.2).
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  if (typeof window === 'undefined' || !window.crypto?.subtle) {
    throw new Error('Web Crypto subtle API is not available');
  }
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await window.crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(digest));
}

/**
 * Generates cryptographically secure random state string (anti-CSRF).
 */
export function generateOAuthState(): string {
  if (typeof window === 'undefined' || !window.crypto) {
    throw new Error('Web Crypto API is not available');
  }
  const randomBytes = new Uint8Array(16);
  window.crypto.getRandomValues(randomBytes);
  return base64UrlEncode(randomBytes);
}

/**
 * Detects whether the current window host is the Business Portal subdomain.
 */
export function isBusinessPortalHost(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname.toLowerCase();
  return host.startsWith('business.');
}

/**
 * Returns the canonical base URL for the Business Portal.
 */
export function getBusinessPortalUrl(): string {
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_PORTAL_BUSINESS_URL || 'https://business.jesmond.com.au';
  }

  const protocol = window.location.protocol;
  const host = window.location.host;

  if (host.startsWith('business.')) {
    return `${protocol}//${host}`;
  }

  // If on localhost (e.g. localhost:3000), use business.localhost:3000 or same port
  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    const port = window.location.port ? `:${window.location.port}` : '';
    return `${protocol}//business.localhost${port}`;
  }

  // Production or staging: replace hostname with business.jesmond.com.au
  return 'https://business.jesmond.com.au';
}

/**
 * Returns the canonical base URL for the Student/Customer Portal.
 */
export function getStudentPortalUrl(): string {
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_SITE_URL || 'https://jesmond.com.au';
  }

  const protocol = window.location.protocol;
  const host = window.location.host;

  if (!host.startsWith('business.')) {
    return `${protocol}//${host}`;
  }

  // If on business.localhost:3000 -> localhost:3000
  if (host.includes('localhost')) {
    const port = window.location.port ? `:${window.location.port}` : '';
    return `${protocol}//localhost${port}`;
  }

  return 'https://jesmond.com.au';
}

/**
 * Initiates SSO authorization flow from an authenticated session.
 * Stores PKCE verifier and anti-CSRF state in sessionStorage.
 */
export async function initiateSsoAuthorization(options?: {
  clientId?: string;
  redirectUri?: string;
  scope?: string;
}): Promise<{ redirectUrl: string; code: string; state: string }> {
  const token = getAccessToken();
  if (!token) {
    throw new Error('You must be signed in to perform Single Sign-On');
  }

  const clientId = options?.clientId || 'jesmond-business-portal';
  const redirectUri = options?.redirectUri || `${getBusinessPortalUrl()}/auth/callback`;
  const scope = options?.scope || 'openid profile email business';

  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state = generateOAuthState();

  // Store in sessionStorage (tab-isolated) for the callback exchange
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('sso_code_verifier', codeVerifier);
    sessionStorage.setItem('sso_state', state);
    sessionStorage.setItem('sso_client_id', clientId);
    sessionStorage.setItem('sso_redirect_uri', redirectUri);
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  const response = await fetch(`${apiUrl}/api/v1/auth/sso/authorize`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    credentials: 'include',
    body: JSON.stringify({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state,
      scope,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Failed to initiate Single Sign-On authorization');
  }

  const data = await response.json();
  const redirectUrl = `${data.redirect_uri}?code=${encodeURIComponent(data.code)}&state=${encodeURIComponent(data.state)}`;

  return {
    redirectUrl,
    code: data.code,
    state: data.state,
  };
}

/**
 * Exchanges the authorization code and verifier on the destination portal (/auth/callback).
 */
export async function completeSsoExchange(
  code: string,
  state: string,
): Promise<{ user: User; session: { id: string; expiresAt: string } }> {
  if (typeof window === 'undefined') {
    throw new Error('Browser context required');
  }

  const codeVerifier = sessionStorage.getItem('sso_code_verifier');
  const storedState = sessionStorage.getItem('sso_state');
  const clientId = sessionStorage.getItem('sso_client_id') || 'jesmond-business-portal';
  const redirectUri = sessionStorage.getItem('sso_redirect_uri') || `${getBusinessPortalUrl()}/auth/callback`;

  // Anti-CSRF check
  if (storedState && storedState !== state) {
    throw new Error('Security verification failed: OAuth state mismatch. Please try signing in again.');
  }

  if (!codeVerifier) {
    throw new Error('Authentication session data missing. Please restart the sign-in flow.');
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  const response = await fetch(`${apiUrl}/api/v1/auth/sso/exchange`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
      client_id: clientId,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
      state,
    }),
  });

  // Clean up transient PKCE secrets immediately
  sessionStorage.removeItem('sso_code_verifier');
  sessionStorage.removeItem('sso_state');
  sessionStorage.removeItem('sso_client_id');
  sessionStorage.removeItem('sso_redirect_uri');

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Authorization code exchange failed or expired.');
  }

  const data = await response.json();

  // Set session context in frontend
  if (data.access_token) {
    setAccessToken(data.access_token);
  }
  if (data.user) {
    setCurrentUser(data.user);
  }

  return {
    user: data.user,
    session: data.session,
  };
}

/**
 * Checks if the currently authenticated user has active business organization credentials.
 */
export async function checkBusinessAccess(
  overrideOrgId?: string,
): Promise<BusinessAccessStatus> {
  const token = getAccessToken();
  const selectedOrgId = overrideOrgId ?? getSelectedOrganizationId();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  try {
    const response = await fetch(`${apiUrl}/api/v1/auth/sso/business-check`, {
      method: 'GET',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(selectedOrgId ? { 'X-Organization-Id': selectedOrgId } : {}),
      },
      credentials: 'include',
    });

    if (!response.ok) {
      return {
        hasBusinessAccess: false,
        isAdmin: false,
        requiresOrganizationSelection: false,
        organizations: [],
        activeOrganization: null,
        error: `Business access verification failed (HTTP ${response.status})`,
        statusCode: response.status,
      };
    }

    return response.json();
  } catch (err: any) {
    return {
      hasBusinessAccess: false,
      isAdmin: false,
      requiresOrganizationSelection: false,
      organizations: [],
      activeOrganization: null,
      error: err?.message || 'Unable to verify business access',
    };
  }
}

/**
 * Merges an authenticated user with a selected/active business organization
 * and persists the selection in session state.
 */
export function applyActiveOrganizationToUser(
  user: User,
  org: BusinessOrganizationSummary,
): User {
  setSelectedOrganizationId(org.organizationId);
  const updatedUser: User = {
    ...user,
    organizationId: org.organizationId,
    orgType: org.orgType,
    businessCategory: org.businessCategory,
    orgRole: org.role,
    permissions: org.permissions,
    retailBranchId: org.retailBranchId ?? undefined,
  };
  setCurrentUser(updatedUser);
  return updatedUser;
}

/**
 * Centralized post-authentication business routing resolver.
 * Determines whether the user needs org selection, onboarding, or direct dashboard redirect.
 */
export function resolveBusinessAuthDestination(
  user: User,
  accessStatus: BusinessAccessStatus,
  returnUrl?: string | null,
):
  | { action: 'select_organization'; organizations: BusinessOrganizationSummary[] }
  | { action: 'onboarding' }
  | { action: 'error'; message: string }
  | { action: 'redirect'; destination: string; user: User } {
  if (accessStatus.error) {
    return { action: 'error', message: accessStatus.error };
  }

  if (!accessStatus.hasBusinessAccess) {
    return { action: 'onboarding' };
  }

  const orgs = accessStatus.organizations || [];
  let resolvedUser = user;

  if (accessStatus.activeOrganization) {
    resolvedUser = applyActiveOrganizationToUser(
      user,
      accessStatus.activeOrganization,
    );
  } else if (orgs.length > 1 || accessStatus.requiresOrganizationSelection) {
    return { action: 'select_organization', organizations: orgs };
  } else if (orgs.length === 1) {
    resolvedUser = applyActiveOrganizationToUser(user, orgs[0]);
  }

  if (returnUrl && isAuthorizedRouteForUser(resolvedUser, returnUrl)) {
    return { action: 'redirect', destination: returnUrl, user: resolvedUser };
  }

  return {
    action: 'redirect',
    destination: getDashboardRouteForUser(resolvedUser),
    user: resolvedUser,
  };
}

/**
 * Logs out of the current portal session, revokes DB session and clears host cookies.
 */
export async function logoutBusinessSession(): Promise<void> {
  const token = getAccessToken();
  const selectedOrgId = getSelectedOrganizationId();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  try {
    await fetch(`${apiUrl}/api/v1/auth/sso/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(selectedOrgId ? { 'X-Organization-Id': selectedOrgId } : {}),
      },
      credentials: 'include',
      body: JSON.stringify({}),
    });
  } catch (err) {
    console.warn('Backend logout encountered error:', err);
  } finally {
    clearAuth();
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  }
}
