import { describe, it, expect, beforeEach } from 'vitest';
import { WorkoutService } from '../workoutService';

function createMemoryStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, val: string) => {
      store.set(key, String(val));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  };
}

describe('WorkoutService localStorage persistence', () => {
  beforeEach(() => {
    (globalThis as any).localStorage = createMemoryStorage();
  });

  it('persists skipping and push-up sessions and computes dual stats', async () => {
    await WorkoutService.saveWorkout({
      start_time: '2026-11-26T10:00:00Z',
      end_time: '2026-11-26T10:03:00Z',
      total_jumps: 150,
      active_duration_seconds: 180,
      rest_duration_seconds: 0,
      total_duration_seconds: 180,
      average_jumps_per_minute: 50,
      max_jumps_per_minute: 80,
      exercise_type: 'skipping',
    });

    await WorkoutService.saveWorkout({
      start_time: '2026-11-26T11:00:00Z',
      end_time: '2026-11-26T11:02:00Z',
      total_jumps: 20,
      completed_reps: 20,
      target_reps: 20,
      workout_mode: '20',
      completion_status: 'completed',
      active_duration_seconds: 60,
      rest_duration_seconds: 0,
      total_duration_seconds: 60,
      average_jumps_per_minute: 20,
      max_jumps_per_minute: 20,
      exercise_type: 'push_up',
    });

    const all = await WorkoutService.getWorkouts();
    expect(all).toHaveLength(2);

    const stats = await WorkoutService.getStats();
    expect(stats.total_sessions).toBe(2);
    expect(stats.total_lifetime_jumps).toBe(150);
    expect(stats.total_lifetime_pushups).toBe(20);
    expect(stats.best_record_pushups).toBe(20);
    expect(stats.total_active_duration_seconds).toBe(240);

    // Delete first item
    await WorkoutService.deleteWorkout(all[0].id!);
    const afterDelete = await WorkoutService.getWorkouts();
    expect(afterDelete).toHaveLength(1);
  });
});
