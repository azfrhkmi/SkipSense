import {
  AdminOverview,
  AdminUserDetail,
  AdminUserSummary,
  AuthResponse,
  BootstrapStatus,
  SecurityEvent,
} from '../types/auth';

let cachedCsrfToken: string | null = null;

export function getCsrfTokenFromCookie(): string | null {
  if (typeof document !== 'undefined') {
    const match = document.cookie.match(/(?:^|;\s*)skipsense_csrf=([^;]+)/);
    if (match && match[1]) {
      return decodeURIComponent(match[1]);
    }
  }
  return cachedCsrfToken;
}

export function setCachedCsrfToken(token: string | null) {
  cachedCsrfToken = token;
}

/**
 * Shared security-aware fetch wrapper.
 * Automatically sends HttpOnly cookies (credentials: 'include') and X-CSRF-Token header.
 */
export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const method = (options.method || 'GET').toUpperCase();
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }

  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const csrf = getCsrfTokenFromCookie();
    if (csrf) {
      headers.set('X-CSRF-Token', csrf);
    }
  }

  return fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });
}

async function parseJsonOrThrow<T>(res: Response): Promise<T> {
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!res.ok) {
    const detail =
      typeof data?.detail === 'string'
        ? data.detail
        : Array.isArray(data?.detail) && data.detail[0]?.msg
        ? data.detail[0].msg
        : `Request failed (${res.status})`;
    const err: any = new Error(detail);
    err.status = res.status;
    throw err;
  }
  return data as T;
}

export class AuthService {
  public static async getBootstrapStatus(): Promise<BootstrapStatus> {
    const res = await apiFetch('/api/auth/bootstrap-status');
    return parseJsonOrThrow<BootstrapStatus>(res);
  }

  public static async bootstrapAdmin(payload: {
    username: string;
    email: string;
    password: string;
    setupKey?: string;
  }): Promise<AuthResponse> {
    const headers: Record<string, string> = {};
    if (payload.setupKey) {
      headers['X-Setup-Key'] = payload.setupKey;
    }
    const res = await apiFetch('/api/auth/bootstrap-admin', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        username: payload.username,
        email: payload.email,
        password: payload.password,
      }),
    });
    const data = await parseJsonOrThrow<AuthResponse>(res);
    setCachedCsrfToken(data.csrf_token);
    return data;
  }

  public static async register(payload: {
    username: string;
    email: string;
    password: string;
  }): Promise<AuthResponse> {
    const res = await apiFetch('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const data = await parseJsonOrThrow<AuthResponse>(res);
    setCachedCsrfToken(data.csrf_token);
    return data;
  }

  public static async login(payload: {
    identifier: string;
    password: string;
  }): Promise<AuthResponse> {
    const res = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const data = await parseJsonOrThrow<AuthResponse>(res);
    setCachedCsrfToken(data.csrf_token);
    return data;
  }

  public static async getMe(): Promise<AuthResponse> {
    const res = await apiFetch('/api/auth/me');
    const data = await parseJsonOrThrow<AuthResponse>(res);
    setCachedCsrfToken(data.csrf_token);
    return data;
  }

  public static async logout(): Promise<void> {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } finally {
      setCachedCsrfToken(null);
    }
  }

  public static async changePassword(payload: {
    current_password: string;
    new_password: string;
  }): Promise<AuthResponse> {
    const res = await apiFetch('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const data = await parseJsonOrThrow<AuthResponse>(res);
    setCachedCsrfToken(data.csrf_token);
    return data;
  }

  // --- Admin Endpoints ---

  public static async getAdminOverview(): Promise<AdminOverview> {
    const res = await apiFetch('/api/admin/overview');
    return parseJsonOrThrow<AdminOverview>(res);
  }

  public static async getAdminThreats(options?: {
    severity?: string;
    resolved?: boolean;
  }): Promise<SecurityEvent[]> {
    const params = new URLSearchParams();
    if (options?.severity && options.severity !== 'ALL') {
      params.set('severity', options.severity);
    }
    if (typeof options?.resolved === 'boolean') {
      params.set('resolved', String(options.resolved));
    }
    const qs = params.toString();
    const res = await apiFetch(`/api/admin/threats${qs ? `?${qs}` : ''}`);
    return parseJsonOrThrow<SecurityEvent[]>(res);
  }

  public static async resolveThreat(eventId: number): Promise<void> {
    const res = await apiFetch(`/api/admin/threats/${eventId}/resolve`, {
      method: 'POST',
    });
    await parseJsonOrThrow(res);
  }

  public static async resolveAllThreats(): Promise<void> {
    const res = await apiFetch('/api/admin/threats/resolve-all', {
      method: 'POST',
    });
    await parseJsonOrThrow(res);
  }

  public static async getAdminUsers(): Promise<AdminUserSummary[]> {
    const res = await apiFetch('/api/admin/users');
    return parseJsonOrThrow<AdminUserSummary[]>(res);
  }

  public static async getAdminUserDashboard(userId: number): Promise<AdminUserDetail> {
    const res = await apiFetch(`/api/admin/users/${userId}/dashboard`);
    return parseJsonOrThrow<AdminUserDetail>(res);
  }

  public static async toggleUserActive(userId: number): Promise<{ user_id: number; is_active: boolean }> {
    const res = await apiFetch(`/api/admin/users/${userId}/toggle-active`, {
      method: 'POST',
    });
    return parseJsonOrThrow(res);
  }

  public static async unlockUser(userId: number): Promise<void> {
    const res = await apiFetch(`/api/admin/users/${userId}/unlock`, {
      method: 'POST',
    });
    await parseJsonOrThrow(res);
  }

  public static async revokeUserSessions(userId: number): Promise<void> {
    const res = await apiFetch(`/api/admin/users/${userId}/revoke-sessions`, {
      method: 'POST',
    });
    await parseJsonOrThrow(res);
  }

  public static async toggleUserRole(userId: number): Promise<{ user_id: number; role: 'user' | 'admin' }> {
    const res = await apiFetch(`/api/admin/users/${userId}/toggle-role`, {
      method: 'POST',
    });
    return parseJsonOrThrow(res);
  }
}

