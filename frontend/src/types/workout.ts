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
  exercise_type?: 'skipping' | 'push_up';
  workout_mode?: string;
  target_reps?: number | null;
  completed_reps?: number;
  completion_status?: 'completed' | 'stopped' | 'aborted';
  created_at?: string;
}

export interface LifetimeStats {
  total_lifetime_jumps: number;
  total_sessions: number;
  total_active_duration_seconds: number;
  best_record_jumps: number;
  best_record_pace: number;
  total_lifetime_pushups?: number;
  total_pushup_sessions?: number;
  best_record_pushups?: number;
  best_pushup_pace?: number;
}

