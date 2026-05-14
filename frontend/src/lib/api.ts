const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export async function api<T>(
  path: string,
  method: Method = 'GET',
  body?: unknown
): Promise<T> {
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method,
      credentials: 'include',
      headers: body
        ? { 'Content-Type': 'application/json' }
        : undefined,
      body: body ? JSON.stringify(body) : undefined
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.error || 'Request failed');
    }

    return data as T;
  } catch (err) {
    throw new Error(
      'Server is waking up, please wait a few seconds and try again.'
    );
  }
}

export function apiBaseUrl() {
  return API_BASE;
}
