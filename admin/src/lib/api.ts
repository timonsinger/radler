const API_URL = process.env.NEXT_PUBLIC_API_URL;

export async function apiFetch(endpoint: string, options?: RequestInit) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });
  if (res.status === 401) {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_user');
      window.location.href = '/login';
    }
    throw new Error('Nicht autorisiert');
  }
  // For CSV downloads, return the response directly
  if (res.headers.get('content-type')?.includes('text/csv')) {
    return res;
  }
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Fehler');
  }
  return data;
}
