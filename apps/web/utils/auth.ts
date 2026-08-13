export interface User {
  id: string;
  email: string;
  role: string;
  firstName: string;
  lastName: string;
  organizationId?: string;
  accountStatus: string;
}

export const getAccessToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  // Previously we used `access_token` and maybe `token` in some places. Let's standardize on `access_token`
  return localStorage.getItem('access_token') || localStorage.getItem('token');
};

export const setAccessToken = (token: string) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem('access_token', token);
  // Remove old token key if it exists to clean up
  localStorage.removeItem('token');
};

export const getCurrentUser = (): User | null => {
  if (typeof window === 'undefined') return null;
  const userStr = localStorage.getItem('user');
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch (e) {
    return null;
  }
};

export const setCurrentUser = (user: User) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem('user', JSON.stringify(user));
};

export const clearAuth = () => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('access_token');
  localStorage.removeItem('token');
  localStorage.removeItem('user');
};

export const isAuthenticated = (): boolean => {
  return !!getAccessToken() && !!getCurrentUser();
};
