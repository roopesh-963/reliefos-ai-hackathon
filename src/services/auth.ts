import api from './http';

const AUTH_CHANGED_EVENT = 'reliefos-auth-changed';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'citizen' | 'rescue_team' | 'admin';
}

export interface AuthResponse {
  message: string;
  token: string;
  user: AuthUser;
}

export interface ProfileUpdateResponse {
  message: string;
  user: AuthUser;
}

export interface ForgotPasswordResponse {
  message: string;
}

const normalizeAuthUser = (input: any): AuthUser | null => {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const role = input.role;
  if (!['citizen', 'rescue_team', 'admin'].includes(role)) {
    return null;
  }

  const id = String(input.id || input._id || '').trim();
  const name = String(input.name || '').trim();
  const email = String(input.email || '').trim();

  if (!id || !name || !email) {
    return null;
  }

  return {
    id,
    name,
    email,
    role,
  };
};

const persistAuthUser = (input: any) => {
  const normalized = normalizeAuthUser(input);
  if (normalized) {
    localStorage.setItem('reliefos_user', JSON.stringify(normalized));
  } else {
    localStorage.removeItem('reliefos_user');
  }
  return normalized;
};

const notifyAuthChanged = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
  }
};

export const register = async (
  name: string,
  email: string,
  password: string,
  role?: string
): Promise<AuthResponse> => {
  const { data } = await api.post('/auth/register', { name, email, password, role });
  localStorage.setItem('reliefos_token', data.token);
  const user = persistAuthUser(data.user) || data.user;
  notifyAuthChanged();
  return { ...data, user };
};

export const login = async (email: string, password: string): Promise<AuthResponse> => {
  const { data } = await api.post('/auth/login', { email, password });
  localStorage.setItem('reliefos_token', data.token);
  const user = persistAuthUser(data.user) || data.user;
  notifyAuthChanged();
  return { ...data, user };
};

export const forgotPassword = async (
  email: string,
  newPassword: string
): Promise<ForgotPasswordResponse> => {
  const { data } = await api.post('/auth/forgot-password', { email, newPassword });
  return data;
};

export const getMe = async (): Promise<AuthUser> => {
  const { data } = await api.get('/auth/me');
  const user = persistAuthUser(data) || data;
  notifyAuthChanged();
  return user;
};

export const updateMe = async (payload: {
  name: string;
  email: string;
}): Promise<ProfileUpdateResponse> => {
  const { data } = await api.put('/auth/me', payload);
  const user = persistAuthUser(data.user) || data.user;
  notifyAuthChanged();
  return { ...data, user };
};

export const logout = () => {
  localStorage.removeItem('reliefos_token');
  localStorage.removeItem('reliefos_user');
  notifyAuthChanged();
  window.location.href = '/';
};

export const getCurrentUser = (): AuthUser | null => {
  const stored = localStorage.getItem('reliefos_user');
  if (!stored) {
    return null;
  }

  try {
    const parsed = JSON.parse(stored);
    const normalized = normalizeAuthUser(parsed);
    if (!normalized) {
      localStorage.removeItem('reliefos_user');
      return null;
    }
    if (JSON.stringify(parsed) !== JSON.stringify(normalized)) {
      localStorage.setItem('reliefos_user', JSON.stringify(normalized));
    }
    return normalized;
  } catch {
    localStorage.removeItem('reliefos_user');
    return null;
  }
};

export const AUTH_SYNC_EVENT = AUTH_CHANGED_EVENT;
