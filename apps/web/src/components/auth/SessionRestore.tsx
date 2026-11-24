'use client';

import { useEffect } from 'react';
import { api, getAccessToken, hasSessionFlag, refreshSession } from '@/lib/api/auth';
import { useAuthStore } from '@/lib/store/auth-store';

/**
 * Restores the signed-in user after a page load: the access token is memory-only, so a new
 * one is obtained from the HttpOnly refresh cookie, then the profile is loaded.
 */
export function SessionRestore() {
  const { setAuth, clearAuth, isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated) return;
    if (!hasSessionFlag()) {
      clearAuth();
      return;
    }
    let cancelled = false;
    refreshSession()
      .then(() => api.get('/auth/me', { skipLoginRedirect: true }))
      .then(({ data }) => {
        if (!cancelled) setAuth(data.user, getAccessToken() ?? '');
      })
      .catch(() => {
        if (!cancelled) clearAuth();
      });
    return () => {
      cancelled = true;
    };
    // Runs once per page load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
