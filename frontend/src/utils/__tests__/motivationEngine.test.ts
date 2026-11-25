import { describe, it, expect } from 'vitest';
import {
  buildMotivationProfile,
  computeStreaks,
  calculateSessionXp,
  estimateSessionCalories,
  evaluateSessionHighlights,
  DEFAULT_DAILY_GOALS,
} from '../motivationEngine';
import { WorkoutSessionData } from '../../types/workout';

function makeWorkout(overrides: Partial<WorkoutSessionData> = {}): WorkoutSessionData {
  return {
    id: Math.floor(Math.random() * 10000),
    session_date: '2026-11-25',
    start_time: '2026-11-25T12:00:00',
    end_time: '2026-11-25T12:05:00',
    total_jumps: 100,
    active_duration_seconds: 180,
    rest_duration_seconds: 20,
    total_duration_seconds: 200,
    average_jumps_per_minute: 75,
    max_jumps_per_minute: 95,
    exercise_type: 'skipping',
    ...overrides,
  };
}

describe('motivationEngine', () => {
  it('computes consecutive daily streaks accurately when worked out today and yesterday', () => {
    const now = new Date('2026-11-25T14:00:00');
    const dates = new Set(['2026-11-25', '2026-11-24', '2026-11-23', '2026-11-20']);
    const result = computeStreaks(dates, now);

    expect(result.workedOutToday).toBe(true);
    expect(result.currentStreak).toBe(3);
    expect(result.longestStreak).toBe(3);
  });

  it('keeps streak alive when worked out yesterday even before today session', () => {
    const now = new Date('2026-11-25T09:00:00');
    const dates = new Set(['2026-11-24', '2026-11-23']);
    const result = computeStreaks(dates, now);

    expect(result.workedOutToday).toBe(false);
    expect(result.currentStreak).toBe(2);
  });

  it('calculates XP, rank level, daily rings, and unlocks earned badges', () => {
    const now = new Date('2026-11-25T15:00:00');
    const workouts: WorkoutSessionData[] = [
      makeWorkout({
        end_time: '2026-11-25T10:00:00',
        total_jumps: 220,
        active_duration_seconds: 400,
        average_jumps_per_minute: 95,
      }),
      makeWorkout({
        end_time: '2026-11-25T11:00:00',
        exercise_type: 'push_up',
        total_jumps: 35,
        completed_reps: 35,
        active_duration_seconds: 240,
        average_jumps_per_minute: 18,
      }),
    ];

    const profile = buildMotivationProfile(workouts, DEFAULT_DAILY_GOALS, now);

    expect(profile.todayJumps).toBe(220);
    expect(profile.todayPushUps).toBe(35);
    expect(profile.todayActiveMinutes).toBeGreaterThanOrEqual(10);
    expect(profile.ringsClosedToday).toBe(3);
    expect(profile.rank.level).toBeGreaterThanOrEqual(2); // Challenger >= 300 XP
    expect(profile.badges.find((b) => b.id === 'first_sweat')?.unlocked).toBe(true);
    expect(profile.badges.find((b) => b.id === 'century_jumper')?.unlocked).toBe(true);
    expect(profile.badges.find((b) => b.id === 'speed_demon')?.unlocked).toBe(true);
    expect(profile.badges.find((b) => b.id === 'pushup_starter')?.unlocked).toBe(true);
    expect(profile.weeklyActivity).toHaveLength(7);
    expect(profile.weeklyActivity[6].isToday).toBe(true);
  });

  it('detects new personal records and calculates positive XP and calories', () => {
    const previous = [makeWorkout({ total_jumps: 80, average_jumps_per_minute: 60 })];
    const current = makeWorkout({ total_jumps: 140, average_jumps_per_minute: 85 });

    const highlights = evaluateSessionHighlights(current, previous);
    expect(highlights.isNewBestCount).toBe(true);
    expect(highlights.isNewBestPace).toBe(true);
    expect(highlights.xpEarned).toBe(calculateSessionXp(current));
    expect(highlights.caloriesBurned).toBe(estimateSessionCalories(current));
  });
});

