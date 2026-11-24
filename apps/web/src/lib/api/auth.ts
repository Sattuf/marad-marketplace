import axios from 'axios';

declare module 'axios' {
  interface AxiosRequestConfig {
    /** On an unrecoverable 401, reject instead of redirecting to /login. */
    skipLoginRedirect?: boolean;
  }
}

/** Public gateway URL, inlined at build time. Localhost only as a dev default. */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Session model (docs/SECURITY_AUDIT.md S10): the access token lives only in this module's
 * memory (gone on reload, never in localStorage); the refresh token lives only in an HttpOnly
 * cookie set by auth-service, which page scripts cannot read. A reload restores the session
 * through POST /auth/refresh. `marad_session` is a non-secret flag cookie saying one exists.
 */
let accessToken: string | null = null;
export const getAccessToken = () => accessToken;
export const setAccessToken = (token: string | null) => {
  accessToken = token;
};

/** Opts in to the cookie session (and forces a CORS preflight, which blocks CSRF). */
const SESSION = { withCredentials: true, headers: { 'X-Session-Cookie': '1' } } as const;

export const hasSessionFlag = () =>
  typeof document !== 'undefined' && document.cookie.split(';').some((c) => c.trim().startsWith('marad_session=1'));

let refreshing: Promise<string> | null = null;
/** Exchanges the refresh cookie for a new access token; concurrent callers share one call. */
export function refreshSession(): Promise<string> {
  refreshing ??= axios
    .post(`${API_URL}/auth/refresh`, {}, SESSION)
    .then(({ data }) => {
      setAccessToken(data.tokens.access_token);
      return data.tokens.access_token as string;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

// An expired access token: refresh once through the cookie, then replay the request.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        await refreshSession();
        return api(originalRequest);
      } catch (refreshError) {
        setAccessToken(null);
        // Background checks (session restore) must not push a guest off a public page.
        if (typeof window !== 'undefined' && !originalRequest.skipLoginRedirect) {
          window.location.href = `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
        }
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

/** Stores the access token of a sign-in response (its refresh token arrived as a cookie). */
function signedIn<T extends { tokens?: { access_token?: string } }>(data: T): T {
  if (data?.tokens?.access_token) setAccessToken(data.tokens.access_token);
  return data;
}

export const authApi = {
  register: async (data: { email?: string; phone?: string; fullName: string; password: string }) => {
    const response = await api.post('/auth/register', data, SESSION);
    return signedIn(response.data);
  },
  
  login: async (data: { identifier: string; password: string }) => {
    const response = await api.post('/auth/login', data, SESSION);
    return signedIn(response.data);
  },
  
  sendOtp: async (phone: string) => {
    const response = await api.post('/auth/send-otp', { phone });
    return response.data;
  },
  
  verifyOtp: async (data: { phone: string; code: string }) => {
    const response = await api.post('/auth/verify-otp', data, SESSION);
    return signedIn(response.data);
  },
  
  logout: async () => {
    // Revokes the refresh token and clears both cookies.
    await api.post('/auth/logout', {}, SESSION).catch(() => {});
    setAccessToken(null);
  },
};
