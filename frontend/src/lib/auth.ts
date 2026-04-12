import { apiFetch } from './api';

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  phone?: string;
}

export async function login(email: string, password: string): Promise<User> {
  const data = await apiFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  if (data.error) throw new Error(data.error);
  if (data.user.role === 'driver') {
    throw new Error('Du bist als Fahrer registriert. Bitte nutze die Fahrer-App.');
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
    body: JSON.stringify({ name, email, password, phone, role: 'customer' }),
  });
  if (data.error) throw new Error(data.error);
  localStorage.setItem('token', data.token);
  localStorage.setItem('user', JSON.stringify(data.user));
  return data.user;
}

export function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/login';
}

export function getStoredUser(): User | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('user');
  if (!raw) return null;
  try {
    const user = JSON.parse(raw);
    // Fahrer haben hier nichts zu suchen → automatisch ausloggen
    if (user?.role === 'driver') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      return null;
    }
    return user;
  } catch {
    return null;
  }
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}
