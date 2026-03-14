const API_URL = process.env.NEXT_PUBLIC_API_URL;

/** True if the self-hosted API is configured (replaces !!supabase) */
export const apiEnabled = !!API_URL;

const TOKEN_KEY = 'auth_token';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

/**
 * Fetch wrapper for the self-hosted API.
 * Automatically attaches JWT Authorization header if a token is stored.
 * Throws on non-2xx responses with the server error message.
 */
export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  if (!API_URL) throw new Error('API not configured');

  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) ?? {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  // Parse response body
  const data = await response.json();

  if (!response.ok) {
    const error = new Error(data.error || 'Request failed') as Error & { status: number };
    error.status = response.status;
    throw error;
  }

  return data as T;
}
