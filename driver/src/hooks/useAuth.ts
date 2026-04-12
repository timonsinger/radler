'use client';

import { useState, useEffect } from 'react';
import { getStoredUser, User } from '@/lib/auth';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUser(getStoredUser());
    setLoading(false);
  }, []);

  return { user, loading, isLoggedIn: !!user };
}
