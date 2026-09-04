export function getApiUrl(): string {
  if (typeof window !== 'undefined') {
    return '';
  }
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
}

export async function handleApiError(response: Response, onAuthError?: () => void): Promise<'ok' | 'unauthorized' | 'forbidden' | 'error' | 'notfound'> {
  if (response.ok) return 'ok';
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
