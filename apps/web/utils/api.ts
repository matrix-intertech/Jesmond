export async function handleApiError(response: Response, onAuthError?: () => void): Promise<'ok' | 'unauthorized' | 'forbidden' | 'error'> {
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
  return 'error';
}

export async function fetchFeatureFlag(flagKey: string, token: string): Promise<{ enabled: boolean } | null> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/admin/features/${flagKey}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const status = await handleApiError(res);
  if (status === 'ok') {
    return await res.json();
  }
  // For forbidden or other errors, return null to indicate unavailable
  return null;
}
