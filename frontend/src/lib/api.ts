const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export async function api<T>(
  path: string,
  method: Method = 'GET',
  body?: unknown
): Promise<T> {
  const controller = new AbortController();

const timeout = setTimeout(() => {
  controller.abort();
}, 90000);

  try {
    const response = await fetch(`${API_BASE}${path}`, {
  method,
  credentials: 'include',
  cache: 'no-store',
  headers: body
        ? { 'Content-Type': 'application/json' }
        : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });

    clearTimeout(timeout);

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.error || 'Request failed');
    }

    return data as T;
  } catch (err: any) {
    clearTimeout(timeout);

    if (err.name === 'AbortError') {
      throw new Error(
        'Server took too long to respond. Please try again.'
      );
    }

    throw new Error(
      'Unable to connect to server. Please check your internet and try again.'
    );
  }
}

export function apiBaseUrl() {
  return API_BASE;
}
