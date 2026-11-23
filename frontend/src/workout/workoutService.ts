import { WorkoutSessionData, LifetimeStats } from '../types/workout';

const LOCAL_STORAGE_KEY = 'skipsense_local_workouts';

export class WorkoutService {
  private static baseUrl = '/api';

  public static async getStats(): Promise<LifetimeStats> {
    try {
      const res = await fetch(`${this.baseUrl}/stats`);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      return await res.json();
    } catch (e) {
      console.warn('Backend unavailable, deriving stats from local storage:', e);
      return this.getLocalStats();
    }
  }

  public static async getWorkouts(): Promise<WorkoutSessionData[]> {
    try {
      const res = await fetch(`${this.baseUrl}/workouts`);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const workouts: WorkoutSessionData[] = await res.json();
      // Cache locally
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(workouts));
      return workouts;
    } catch (e) {
      console.warn('Backend unavailable, loading cached workouts from local storage:', e);
      return this.getLocalWorkouts();
    }
  }

  public static async getWorkout(id: number): Promise<WorkoutSessionData> {
    try {
      const res = await fetch(`${this.baseUrl}/workouts/${id}`);
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
      const res = await fetch(`${this.baseUrl}/workouts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(session),
      });
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const saved = await res.json();
      // Also update local cache
      const cached = this.getLocalWorkouts();
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify([saved, ...cached]));
      return saved;
    } catch (e) {
      console.warn('Failed to save to backend, storing in local offline storage:', e);
      const localList = this.getLocalWorkouts();
      const mockSaved: WorkoutSessionData = {
        ...session,
        id: Date.now(),
        created_at: new Date().toISOString(),
      };
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify([mockSaved, ...localList]));
      return mockSaved;
    }
  }

  public static async deleteWorkout(id: number): Promise<void> {
    try {
      const res = await fetch(`${this.baseUrl}/workouts/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    } catch (e) {
      console.warn('Backend delete failed, removing locally:', e);
    }
    const cached = this.getLocalWorkouts().filter((w) => w.id !== id);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cached));
  }

  private static getLocalWorkouts(): WorkoutSessionData[] {
    try {
      const data = localStorage.getItem(LOCAL_STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  private static getLocalStats(): LifetimeStats {
    const workouts = this.getLocalWorkouts();
    const totalJumps = workouts.reduce((sum, w) => sum + (w.total_jumps || 0), 0);
    const totalActiveSec = workouts.reduce((sum, w) => sum + (w.active_duration_seconds || 0), 0);
    const bestJumps = workouts.reduce((max, w) => Math.max(max, w.total_jumps || 0), 0);
    const bestPace = workouts.reduce((max, w) => Math.max(max, w.average_jumps_per_minute || 0), 0);

    return {
      total_lifetime_jumps: totalJumps,
      total_sessions: workouts.length,
      total_active_duration_seconds: totalActiveSec,
      best_record_jumps: bestJumps,
      best_record_pace: Math.round(bestPace * 10) / 10,
    };
  }
}

