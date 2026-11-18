export function getApiUrl(): string {
  if (typeof window !== 'undefined') {
    // In browser, use configured NEXT_PUBLIC_API_URL or relative path.
    // Never fallback to localhost/127.0.0.1:3001 in browser to avoid leaking requests to visitor localhost.
    return process.env.NEXT_PUBLIC_API_URL || '';
  }
  return process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || '';
}

export async function handleApiError(
  response: Response,
  onAuthError?: () => void,
): Promise<'ok' | 'unauthorized' | 'forbidden' | 'error' | 'notfound' | 'notmodified'> {
  if (response.ok) return 'ok';
  if (response.status === 304) {
    return 'notmodified';
  }
  if (response.status === 401) {
    // Authentication error – clear auth and redirect
    if (onAuthError) onAuthError();
    return 'unauthorized';
  }
  if (response.status === 403) {
    // Authorization error – do not logout
    return 'forbidden';
  }
  if (response.status === 404) {
    return 'notfound';
  }
  return 'error';
}

export async function fetchFeatureFlag(flagKey: string, token: string, onAuthError?: () => void): Promise<{ enabled: boolean } | null> {
  const res = await fetch(`${getApiUrl()}/api/v1/admin/features/${flagKey}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const status = await handleApiError(res, onAuthError);
  if (status === 'ok') {
    return await res.json();
  }
  // For forbidden or other errors, return null to indicate unavailable
  return null;
}
