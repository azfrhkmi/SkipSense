import { WorkoutSessionData, LifetimeStats } from '../types/workout';
import { apiFetch } from '../services/authService';

const BASE_CACHE_KEY = 'skipsense_local_workouts';
let activeCacheScope = 'anon';

export class WorkoutService {
  private static baseUrl = '/api';

  public static setUserCacheScope(userId: number | null) {
    activeCacheScope = userId !== null ? `u_${userId}` : 'anon';
  }

  private static get cacheKey(): string {
    return `${BASE_CACHE_KEY}_${activeCacheScope}`;
  }

  public static async getStats(): Promise<LifetimeStats> {
    try {
      const res = await apiFetch(`${this.baseUrl}/stats`);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      return await res.json();
    } catch (e) {
      console.warn('Backend unavailable, deriving stats from local storage:', e);
      return this.getLocalStats();
    }
  }

  public static async getWorkouts(exerciseType?: string): Promise<WorkoutSessionData[]> {
    try {
      const url = exerciseType
        ? `${this.baseUrl}/workouts?exercise_type=${encodeURIComponent(exerciseType)}`
        : `${this.baseUrl}/workouts`;
      const res = await apiFetch(url);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const workouts: WorkoutSessionData[] = await res.json();
      if (!exerciseType) {
        localStorage.setItem(this.cacheKey, JSON.stringify(workouts));
      }
      return workouts;
    } catch (e) {
      console.warn('Backend unavailable, loading cached workouts from local storage:', e);
      const cached = this.getLocalWorkouts();
      return exerciseType ? cached.filter((w) => w.exercise_type === exerciseType) : cached;
    }
  }

  public static async getWorkout(id: number): Promise<WorkoutSessionData> {
    try {
      const res = await apiFetch(`${this.baseUrl}/workouts/${id}`);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      return await res.json();
    } catch (e) {
      const local = this.getLocalWorkouts().find((w) => w.id === id);
      if (local) return local;
      throw e;
    }
  }

  public static async saveWorkout(session: WorkoutSessionData): Promise<WorkoutSessionData> {
    try {
      const res = await apiFetch(`${this.baseUrl}/workouts`, {
        method: 'POST',
        body: JSON.stringify(session),
      });
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const saved = await res.json();
      const cached = this.getLocalWorkouts();
      localStorage.setItem(this.cacheKey, JSON.stringify([saved, ...cached]));
      return saved;
    } catch (e) {
      console.warn('Failed to save to backend, storing in local offline storage:', e);
      const localList = this.getLocalWorkouts();
      const mockSaved: WorkoutSessionData = {
        ...session,
        id: Date.now(),
        created_at: new Date().toISOString(),
      };
      localStorage.setItem(this.cacheKey, JSON.stringify([mockSaved, ...localList]));
      return mockSaved;
    }
  }

  public static async deleteWorkout(id: number): Promise<void> {
    try {
      const res = await apiFetch(`${this.baseUrl}/workouts/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    } catch (e) {
      console.warn('Backend delete failed, removing locally:', e);
    }
    const cached = this.getLocalWorkouts().filter((w) => w.id !== id);
    localStorage.setItem(this.cacheKey, JSON.stringify(cached));
  }

  private static getLocalWorkouts(): WorkoutSessionData[] {
    try {
      const data = localStorage.getItem(this.cacheKey);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  private static getLocalStats(): LifetimeStats {
    const workouts = this.getLocalWorkouts();
    const skipping = workouts.filter((w) => w.exercise_type !== 'push_up');
    const pushups = workouts.filter((w) => w.exercise_type === 'push_up');

    const totalJumps = skipping.reduce((sum, w) => sum + (w.total_jumps || 0), 0);
    const totalActiveSec = workouts.reduce((sum, w) => sum + (w.active_duration_seconds || 0), 0);
    const bestJumps = skipping.reduce((max, w) => Math.max(max, w.total_jumps || 0), 0);
    const bestPace = skipping.reduce((max, w) => Math.max(max, w.average_jumps_per_minute || 0), 0);

    const totalPushups = pushups.reduce((sum, w) => sum + (w.completed_reps ?? w.total_jumps ?? 0), 0);
    const bestPushups = pushups.reduce((max, w) => Math.max(max, w.completed_reps ?? w.total_jumps ?? 0), 0);
    const bestPushupPace = pushups.reduce((max, w) => Math.max(max, w.average_jumps_per_minute || 0), 0);

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
}
