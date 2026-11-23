export interface WorkoutSessionData {
  id?: number;
  session_date?: string;
  start_time: string;
  end_time: string;
  total_jumps: number;
  active_duration_seconds: number;
  rest_duration_seconds: number;
  total_duration_seconds: number;
  average_jumps_per_minute: number;
  max_jumps_per_minute: number;
  created_at?: string;
}

export interface LifetimeStats {
  total_lifetime_jumps: number;
  total_sessions: number;
  total_active_duration_seconds: number;
  best_record_jumps: number;
  best_record_pace: number;
}
