'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { apiFetch } from './api';

interface User {
  id: string;
  email: string;
  name: string;
  profile_image_url: string | null;
}

interface WgInfo {
  wg_id: string;
  wg_name: string;
  invite_code: string;
}

interface AuthContextType {
  user: User | null;
  wg: WgInfo | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (formData: FormData) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [wg, setWg] = useState<WgInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await apiFetch<User & { wg: WgInfo | null }>('/api/auth/me');
      setUser({ id: data.id, email: data.email, name: data.name, profile_image_url: data.profile_image_url });
      setWg(data.wg);
    } catch {
      setUser(null);
      setWg(null);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('wg_token');
    if (token) {
      refresh().finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [refresh]);

  const login = async (email: string, password: string) => {
    const data = await apiFetch<{ token: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    localStorage.setItem('wg_token', data.token);
    localStorage.setItem('wg_user', JSON.stringify(data.user));
    setUser(data.user);
    // Refresh to get WG info
    await refresh();
  };

  const register = async (formData: FormData) => {
    const data = await apiFetch<{ token: string; user: User }>('/api/auth/register', {
      method: 'POST',
      body: formData,
    });
    localStorage.setItem('wg_token', data.token);
    localStorage.setItem('wg_user', JSON.stringify(data.user));
    setUser(data.user);
  };

  const logout = () => {
    localStorage.removeItem('wg_token');
    localStorage.removeItem('wg_user');
    setUser(null);
    setWg(null);
  };

  return (
    <AuthContext.Provider value={{ user, wg, loading, login, register, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth muss innerhalb von AuthProvider verwendet werden');
  return ctx;
}
