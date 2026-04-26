/**
 * src/hooks/useAuth.ts
 * ---------------------
 * Authentication hook for managing login state across the app.
 *
 * HOW TO USE:
 *   import { useAuth } from '../hooks/useAuth';
 *
 *   const { user, isLoggedIn, doLogin, doRegister, doLogout } = useAuth();
 *
 *   // Protect a page:
 *   if (!isLoggedIn) return <Navigate to="/" />;
 *
 *   // Show role-specific UI:
 *   if (user?.role === 'admin') return <AdminPanel />;
 */

import { useState, useCallback, useEffect } from 'react';
import { login, register, logout, getCurrentUser, AuthUser, AUTH_SYNC_EVENT } from '../services/api';

export const useAuth = () => {
  const [user, setUser] = useState<AuthUser | null>(getCurrentUser());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const syncAuthState = () => setUser(getCurrentUser());

    window.addEventListener('storage', syncAuthState);
    window.addEventListener(AUTH_SYNC_EVENT, syncAuthState);

    return () => {
      window.removeEventListener('storage', syncAuthState);
      window.removeEventListener(AUTH_SYNC_EVENT, syncAuthState);
    };
  }, []);

  const doLogin = useCallback(async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await login(email, password);
      setUser(res.user);
      return res;
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Login failed';
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const doRegister = useCallback(async (
    name: string, email: string, password: string, role?: string
  ) => {
    setLoading(true);
    setError(null);
    try {
      const res = await register(name, email, password, role);
      setUser(res.user);
      return res;
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Registration failed';
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const doLogout = useCallback(() => {
    logout();
    setUser(null);
  }, []);

  return {
    user,
    isLoggedIn: !!user,
    isAdmin: user?.role === 'admin',
    isRescueTeam: user?.role === 'rescue_team',
    isCitizen: user?.role === 'citizen',
    loading,
    error,
    doLogin,
    doRegister,
    doLogout,
  };
};
