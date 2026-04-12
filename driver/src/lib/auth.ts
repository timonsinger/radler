import { apiFetch } from './api';

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  phone?: string;
  driver?: {
    vehicle_type: string | null;
    is_online: boolean;
    rating: number;
  };
}

export async function login(email: string, password: string): Promise<User> {
  const data = await apiFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  if (data.error) throw new Error(data.error);
  if (data.user.role !== 'driver') {
    throw new Error('Dieser Account ist kein Fahrer-Account');
  }
  localStorage.setItem('token', data.token);
  localStorage.setItem('user', JSON.stringify(data.user));
  return data.user;
}

export async function register(
  name: string,
  email: string,
  password: string,
  phone?: string
): Promise<User> {
  const data = await apiFetch('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password, phone, role: 'driver' }),
  });
  if (data.error) throw new Error(data.error);
  localStorage.setItem('token', data.token);
  localStorage.setItem('user', JSON.stringify(data.user));
  return data.user;
}

export async function logout() {
  // Fahrer vor dem Logout offline setzen
  try {
    const token = localStorage.getItem('token');
    if (token) {
      await apiFetch('/api/drivers/status', {
        method: 'PATCH',
        body: JSON.stringify({ is_online: false }),
      });
    }
  } catch { /* ignorieren – Logout trotzdem durchführen */ }
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/login';
}

export function getStoredUser(): User | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('user');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}
