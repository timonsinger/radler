import { apiFetch } from './api';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

export async function login(email: string, password: string): Promise<AdminUser> {
  const data = await apiFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  if (data.user.role !== 'admin') {
    throw new Error('Kein Admin-Zugang');
  }
  localStorage.setItem('admin_token', data.token);
  localStorage.setItem('admin_user', JSON.stringify(data.user));
  return data.user;
}

export function logout() {
  localStorage.removeItem('admin_token');
  localStorage.removeItem('admin_user');
  window.location.href = '/login';
}

export function getStoredUser(): AdminUser | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('admin_user');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
