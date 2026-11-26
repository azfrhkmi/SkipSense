import { LifetimeStats, WorkoutSessionData } from './workout';

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  role: 'user' | 'admin';
  is_active: boolean;
  last_login_at?: string | null;
  created_at: string;
}

export interface AuthResponse {
  user: AuthUser;
  csrf_token: string;
  message: string;
}

export interface BootstrapStatus {
  needs_admin_setup: boolean;
  database_backend: string;
}

export interface SecurityEvent {
  id: number;
  event_type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  ip_address: string;
  user_agent: string;
  target_user_id?: number | null;
  target_email?: string | null;
  endpoint: string;
  details: string;
  resolved: boolean;
  created_at: string;
}

export interface AdminUserSummary {
  id: number;
  username: string;
  email: string;
  role: 'user' | 'admin';
  is_active: boolean;
  is_locked: boolean;
  failed_login_attempts: number;
  locked_until?: string | null;
  last_login_at?: string | null;
  last_login_ip?: string | null;
  created_at: string;
  total_sessions: number;
  total_jumps: number;
  total_pushups: number;
  active_duration_seconds: number;
}

export interface AdminOverview {
  total_users: number;
  active_users: number;
  suspended_users: number;
  locked_users: number;
  total_workouts: number;
  total_platform_jumps: number;
  total_platform_pushups: number;
  unresolved_high_threats: number;
  total_threats_24h: number;
  blocked_attempts_24h: number;
  database_backend: string;
  security_controls: string[];
}

export interface AdminUserDetail {
  user: AdminUserSummary;
  stats: LifetimeStats;
  recent_workouts: WorkoutSessionData[];
  recent_security_events: SecurityEvent[];
}

