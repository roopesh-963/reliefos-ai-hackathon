import axios from 'axios';

export const API_ORIGIN =
  import.meta.env.VITE_API_URL?.replace(/\/api\/?$/, '') ||
  (import.meta.env.DEV ? 'http://localhost:5000' : window.location.origin);

export const api = axios.create({
  baseURL: `${API_ORIGIN}/api`,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('reliefos_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const requestUrl = String(error.config?.url || '');
    const isAnalyticsRequest = requestUrl.startsWith('/analytics/');
    const isIntelRequest = requestUrl.startsWith('/intel/');
    const isAuthRequest =
      requestUrl.startsWith('/auth/login') ||
      requestUrl.startsWith('/auth/register');
    const hasSessionToken = Boolean(localStorage.getItem('reliefos_token'));

    if (
      error.response?.status === 401 &&
      hasSessionToken &&
      !isAnalyticsRequest &&
      !isIntelRequest &&
      !isAuthRequest
    ) {
      localStorage.removeItem('reliefos_token');
      localStorage.removeItem('reliefos_user');
      window.location.href = '/';
    }

    return Promise.reject(error);
  }
);

export default api;
