import { WorkoutSessionData, LifetimeStats } from '../types/workout';

const WORKOUTS_STORAGE_KEY = 'skipsense_workouts_v1';
const LEGACY_KEYS = ['skipsense_local_workouts_anon', 'skipsense_local_workouts'];

/**
 * Pure browser-local persistence service using localStorage.
 * Works offline, on Vercel static hosting, and on iPhone Safari across page refreshes.
 */
export class WorkoutService {
  private static nextId = 1;

  private static loadAllFromStorage(): WorkoutSessionData[] {
    try {
      const raw = localStorage.getItem(WORKOUTS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      }

      // Migrate any workouts saved under legacy keys so existing history is preserved
      for (const oldKey of LEGACY_KEYS) {
        const legacyRaw = localStorage.getItem(oldKey);
        if (legacyRaw) {
          const parsedLegacy = JSON.parse(legacyRaw);
          if (Array.isArray(parsedLegacy) && parsedLegacy.length > 0) {
            localStorage.setItem(WORKOUTS_STORAGE_KEY, JSON.stringify(parsedLegacy));
            return parsedLegacy;
          }
        }
      }
      return [];
    } catch {
      return [];
    }
  }

  private static saveAllToStorage(workouts: WorkoutSessionData[]) {
    try {
      localStorage.setItem(WORKOUTS_STORAGE_KEY, JSON.stringify(workouts));
    } catch (e) {
      console.warn('Could not persist workouts to localStorage:', e);
    }
  }

  public static async getStats(): Promise<LifetimeStats> {
    const workouts = this.loadAllFromStorage();
    const skipping = workouts.filter((w) => w.exercise_type !== 'push_up');
    const pushups = workouts.filter((w) => w.exercise_type === 'push_up');

    const totalJumps = skipping.reduce((sum, w) => sum + (w.total_jumps || 0), 0);
    const totalActiveSec = workouts.reduce((sum, w) => sum + (w.active_duration_seconds || 0), 0);
    const bestJumps = skipping.reduce((max, w) => Math.max(max, w.total_jumps || 0), 0);
    const bestPace = skipping.reduce((max, w) => Math.max(max, w.average_jumps_per_minute || 0), 0);

    const totalPushups = pushups.reduce(
      (sum, w) => sum + (w.completed_reps ?? w.total_jumps ?? 0),
      0
    );
    const bestPushups = pushups.reduce(
      (max, w) => Math.max(max, w.completed_reps ?? w.total_jumps ?? 0),
      0
    );
    const bestPushupPace = pushups.reduce(
      (max, w) => Math.max(max, w.average_jumps_per_minute || 0),
      0
    );

    return {
      total_lifetime_jumps: totalJumps,
      total_sessions: workouts.length,
      total_active_duration_seconds: totalActiveSec,
      best_record_jumps: bestJumps,
      best_record_pace: Math.round(bestPace * 10) / 10,
      total_lifetime_pushups: totalPushups,
      total_pushup_sessions: pushups.length,
      best_record_pushups: bestPushups,
      best_pushup_pace: Math.round(bestPushupPace * 10) / 10,
    };
  }

  public static async getWorkouts(exerciseType?: string): Promise<WorkoutSessionData[]> {
    const workouts = this.loadAllFromStorage();
    if (!exerciseType) return workouts;
    if (exerciseType === 'push_up') {
      return workouts.filter((w) => w.exercise_type === 'push_up');
    }
    return workouts.filter((w) => w.exercise_type !== 'push_up');
  }

  public static async getWorkout(id: number): Promise<WorkoutSessionData> {
    const found = this.loadAllFromStorage().find((w) => w.id === id);
    if (!found) {
      throw new Error(`Workout ${id} not found`);
    }
    return found;
  }

  public static async saveWorkout(session: WorkoutSessionData): Promise<WorkoutSessionData> {
    const workouts = this.loadAllFromStorage();
    const uniqueId = Date.now() * 100 + (this.nextId++ % 100);
    const isPushUp = session.exercise_type === 'push_up';
    const completedReps = isPushUp
      ? session.completed_reps ?? session.total_jumps ?? 0
      : session.total_jumps ?? 0;

    const saved: WorkoutSessionData = {
      ...session,
      id: session.id ?? uniqueId,
      session_date: session.session_date || new Date().toISOString().split('T')[0],
      exercise_type: session.exercise_type || 'skipping',
      workout_mode: session.workout_mode || 'standard',
      completed_reps: completedReps,
      total_jumps: isPushUp ? completedReps : session.total_jumps,
      completion_status: session.completion_status || 'completed',
      created_at: session.created_at || new Date().toISOString(),
    };

    this.saveAllToStorage([saved, ...workouts]);
    return saved;
  }

  public static async deleteWorkout(id: number): Promise<void> {
    const remaining = this.loadAllFromStorage().filter((w) => w.id !== id);
    this.saveAllToStorage(remaining);
  }
}
