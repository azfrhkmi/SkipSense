import { WorkoutSessionData } from '../types/workout';

export interface DailyGoals {
  dailyJumps: number;
  dailyPushUps: number;
  dailyActiveMinutes: number;
}

export const DEFAULT_DAILY_GOALS: DailyGoals = {
  dailyJumps: 200,
  dailyPushUps: 30,
  dailyActiveMinutes: 10,
};

const GOALS_STORAGE_KEY = 'skipsense_daily_goals';

export interface AthleteRank {
  level: number;
  title: string;
  minXp: number;
  nextLevelXp: number | null;
  color: string;
}

export const ATHLETE_RANKS: AthleteRank[] = [
  { level: 1, title: 'Rookie', minXp: 0, nextLevelXp: 300, color: '#929BA3' },
  { level: 2, title: 'Challenger', minXp: 300, nextLevelXp: 1000, color: '#38BDF8' },
  { level: 3, title: 'Contender', minXp: 1000, nextLevelXp: 2500, color: '#39E66B' },
  { level: 4, title: 'Athlete', minXp: 2500, nextLevelXp: 6000, color: '#A855F7' },
  { level: 5, title: 'Kinetic Pro', minXp: 6000, nextLevelXp: 12000, color: '#F59E0B' },
  { level: 6, title: 'Apex Legend', minXp: 12000, nextLevelXp: null, color: '#FF375F' },
];

export interface AchievementBadge {
  id: string;
  title: string;
  description: string;
  icon: 'zap' | 'flame' | 'trophy' | 'gauge' | 'target' | 'crown' | 'heart' | 'sparkles';
  color: string;
  unlocked: boolean;
  progress: number;
  target: number;
  unit: string;
}

export interface DayActivity {
  dateStr: string;
  dayLabel: string;
  isToday: boolean;
  jumps: number;
  pushUps: number;
  activeSeconds: number;
  calories: number;
  sessionsCount: number;
  score: number; // Combined normalized visual score
}

export interface MotivationProfile {
  totalXp: number;
  rank: AthleteRank;
  xpIntoLevel: number;
  xpForNextLevel: number;
  levelProgressPct: number;
  currentStreak: number;
  longestStreak: number;
  workedOutToday: boolean;
  todayJumps: number;
  todayPushUps: number;
  todayActiveMinutes: number;
  todayCalories: number;
  lifetimeCalories: number;
  jumpsGoalPct: number;
  pushUpsGoalPct: number;
  activeMinGoalPct: number;
  ringsClosedToday: number;
  weeklyActivity: DayActivity[];
  badges: AchievementBadge[];
  unlockedBadgesCount: number;
  coachMessage: string;
  coachHighlight: string;
}

export interface SessionHighlight {
  xpEarned: number;
  caloriesBurned: number;
  isNewBestCount: boolean;
  isNewBestPace: boolean;
  intensityLabel: string;
  intensityColor: string;
  encouragementQuote: string;
}

/**
 * Formats a Date in local YYYY-MM-DD format so streaks match the user's real day.
 */
export function toLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Extracts normalized YYYY-MM-DD local key for a workout session.
 */
export function getSessionLocalDateKey(session: WorkoutSessionData): string {
  if (session.end_time) {
    const parsed = new Date(session.end_time);
    if (!Number.isNaN(parsed.getTime())) {
      return toLocalDateKey(parsed);
    }
  }
  if (session.start_time) {
    const parsed = new Date(session.start_time);
    if (!Number.isNaN(parsed.getTime())) {
      return toLocalDateKey(parsed);
    }
  }
  if (session.session_date && /^\d{4}-\d{2}-\d{2}$/.test(session.session_date)) {
    return session.session_date;
  }
  return toLocalDateKey(new Date());
}

/**
 * Estimates kcal burned for a single workout session.
 */
export function estimateSessionCalories(session: WorkoutSessionData): number {
  if (session.exercise_type === 'push_up') {
    const reps = session.completed_reps ?? session.total_jumps ?? 0;
    const base = reps * 0.45 + (session.active_duration_seconds || 0) * 0.04;
    return Math.round(base * 10) / 10;
  }
  const jumps = session.total_jumps || 0;
  const base = jumps * 0.12 + (session.active_duration_seconds || 0) * 0.03;
  return Math.round(base * 10) / 10;
}

/**
 * Computes XP earned for a single session.
 */
export function calculateSessionXp(session: WorkoutSessionData): number {
  const sessionBonus = 50;
  if (session.exercise_type === 'push_up') {
    const reps = session.completed_reps ?? session.total_jumps ?? 0;
    return sessionBonus + reps * 5 + Math.round((session.active_duration_seconds || 0) / 10);
  }
  const jumps = session.total_jumps || 0;
  return sessionBonus + jumps * 1 + Math.round((session.active_duration_seconds || 0) / 10);
}

/**
 * Loads user's custom daily goals from localStorage.
 */
export function loadDailyGoals(): DailyGoals {
  try {
    const raw = localStorage.getItem(GOALS_STORAGE_KEY);
    if (!raw) return DEFAULT_DAILY_GOALS;
    const parsed = JSON.parse(raw);
    return {
      dailyJumps: Math.max(20, Number(parsed.dailyJumps) || DEFAULT_DAILY_GOALS.dailyJumps),
      dailyPushUps: Math.max(5, Number(parsed.dailyPushUps) || DEFAULT_DAILY_GOALS.dailyPushUps),
      dailyActiveMinutes: Math.max(2, Number(parsed.dailyActiveMinutes) || DEFAULT_DAILY_GOALS.dailyActiveMinutes),
    };
  } catch {
    return DEFAULT_DAILY_GOALS;
  }
}

export function saveDailyGoals(goals: DailyGoals): DailyGoals {
  const sanitized: DailyGoals = {
    dailyJumps: Math.max(20, Math.round(goals.dailyJumps)),
    dailyPushUps: Math.max(5, Math.round(goals.dailyPushUps)),
    dailyActiveMinutes: Math.max(2, Math.round(goals.dailyActiveMinutes)),
  };
  try {
    localStorage.setItem(GOALS_STORAGE_KEY, JSON.stringify(sanitized));
  } catch {
    // Ignore storage restriction errors
  }
  return sanitized;
}

/**
 * Computes current active consecutive day streak and longest ever streak.
 */
export function computeStreaks(
  uniqueDateKeys: Set<string>,
  now: Date = new Date()
): { currentStreak: number; longestStreak: number; workedOutToday: boolean } {
  const todayKey = toLocalDateKey(now);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = toLocalDateKey(yesterday);

  const workedOutToday = uniqueDateKeys.has(todayKey);

  // Current streak is alive if user worked out today OR yesterday
  let currentStreak = 0;
  if (workedOutToday || uniqueDateKeys.has(yesterdayKey)) {
    const cursor = new Date(now);
    if (!workedOutToday) {
      cursor.setDate(cursor.getDate() - 1);
    }
    while (uniqueDateKeys.has(toLocalDateKey(cursor))) {
      currentStreak++;
      cursor.setDate(cursor.getDate() - 1);
    }
  }

  // Longest historical streak
  const sortedDates = Array.from(uniqueDateKeys).sort();
  let longestStreak = 0;
  let run = 0;
  let prevTime: number | null = null;

  for (const key of sortedDates) {
    const [y, m, d] = key.split('-').map(Number);
    const utcDay = Date.UTC(y, m - 1, d);
    if (prevTime !== null && utcDay - prevTime === 86400000) {
      run++;
    } else {
      run = 1;
    }
    if (run > longestStreak) longestStreak = run;
    prevTime = utcDay;
  }

  return { currentStreak, longestStreak, workedOutToday };
}

/**
 * Resolves Athlete Rank info from total XP.
 */
export function getRankForXp(totalXp: number): {
  rank: AthleteRank;
  xpIntoLevel: number;
  xpForNextLevel: number;
  levelProgressPct: number;
} {
  let activeRank = ATHLETE_RANKS[0];
  for (const r of ATHLETE_RANKS) {
    if (totalXp >= r.minXp) {
      activeRank = r;
    }
  }

  if (activeRank.nextLevelXp === null) {
    return {
      rank: activeRank,
      xpIntoLevel: totalXp - activeRank.minXp,
      xpForNextLevel: 0,
      levelProgressPct: 100,
    };
  }

  const span = activeRank.nextLevelXp - activeRank.minXp;
  const xpIntoLevel = totalXp - activeRank.minXp;
  const levelProgressPct = Math.min(100, Math.max(0, Math.round((xpIntoLevel / span) * 100)));

  return {
    rank: activeRank,
    xpIntoLevel,
    xpForNextLevel: activeRank.nextLevelXp - totalXp,
    levelProgressPct,
  };
}

/**
 * Builds the complete gamification, rings, chart, badges, and AI coach profile.
 */
export function buildMotivationProfile(
  workouts: WorkoutSessionData[],
  goals: DailyGoals = DEFAULT_DAILY_GOALS,
  now: Date = new Date()
): MotivationProfile {
  const todayKey = toLocalDateKey(now);
  const dateSet = new Set<string>();

  let totalXp = 0;
  let totalLifetimeJumps = 0;
  let totalLifetimePushUps = 0;
  let lifetimeCalories = 0;
  let bestSessionJumps = 0;
  let bestSkippingPace = 0;
  let pushUpSessionsCount = 0;

  let todayJumps = 0;
  let todayPushUps = 0;
  let todayActiveSeconds = 0;
  let todayCalories = 0;

  // Map for 7-day rolling timeline
  const dayBucketMap = new Map<
    string,
    { jumps: number; pushUps: number; activeSeconds: number; calories: number; sessionsCount: number }
  >();

  const weeklyDates: Date[] = [];
  for (let offset = 6; offset >= 0; offset--) {
    const d = new Date(now);
    d.setDate(d.getDate() - offset);
    const key = toLocalDateKey(d);
    weeklyDates.push(d);
    dayBucketMap.set(key, {
      jumps: 0,
      pushUps: 0,
      activeSeconds: 0,
      calories: 0,
      sessionsCount: 0,
    });
  }

  for (const w of workouts) {
    const dateKey = getSessionLocalDateKey(w);
    dateSet.add(dateKey);

    const isPushUp = w.exercise_type === 'push_up';
    const repsOrJumps = isPushUp ? (w.completed_reps ?? w.total_jumps ?? 0) : (w.total_jumps || 0);
    const kcal = estimateSessionCalories(w);

    totalXp += calculateSessionXp(w);
    lifetimeCalories += kcal;

    if (isPushUp) {
      pushUpSessionsCount++;
      totalLifetimePushUps += repsOrJumps;
    } else {
      totalLifetimeJumps += repsOrJumps;
      if (repsOrJumps > bestSessionJumps) bestSessionJumps = repsOrJumps;
      if ((w.average_jumps_per_minute || 0) > bestSkippingPace) {
        bestSkippingPace = w.average_jumps_per_minute || 0;
      }
    }

    if (dateKey === todayKey) {
      if (isPushUp) {
        todayPushUps += repsOrJumps;
      } else {
        todayJumps += repsOrJumps;
      }
      todayActiveSeconds += w.active_duration_seconds || 0;
      todayCalories += kcal;
    }

    const bucket = dayBucketMap.get(dateKey);
    if (bucket) {
      if (isPushUp) {
        bucket.pushUps += repsOrJumps;
      } else {
        bucket.jumps += repsOrJumps;
      }
      bucket.activeSeconds += w.active_duration_seconds || 0;
      bucket.calories += kcal;
      bucket.sessionsCount += 1;
    }
  }

  const { currentStreak, longestStreak, workedOutToday } = computeStreaks(dateSet, now);
  const rankInfo = getRankForXp(totalXp);

  const todayActiveMinutes = Math.round((todayActiveSeconds / 60) * 10) / 10;
  const jumpsGoalPct = Math.min(100, Math.round((todayJumps / goals.dailyJumps) * 100));
  const pushUpsGoalPct = Math.min(100, Math.round((todayPushUps / goals.dailyPushUps) * 100));
  const activeMinGoalPct = Math.min(100, Math.round((todayActiveMinutes / goals.dailyActiveMinutes) * 100));

  const ringsClosedToday =
    (todayJumps >= goals.dailyJumps ? 1 : 0) +
    (todayPushUps >= goals.dailyPushUps ? 1 : 0) +
    (todayActiveMinutes >= goals.dailyActiveMinutes ? 1 : 0);

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const weeklyActivity: DayActivity[] = weeklyDates.map((d) => {
    const key = toLocalDateKey(d);
    const b = dayBucketMap.get(key)!;
    // Weighted visual effort score: 1 jump = 1 pt, 1 pushup = 5 pts
    const score = b.jumps + b.pushUps * 5;
    return {
      dateStr: key,
      dayLabel: key === todayKey ? 'Today' : dayNames[d.getDay()],
      isToday: key === todayKey,
      jumps: b.jumps,
      pushUps: b.pushUps,
      activeSeconds: b.activeSeconds,
      calories: Math.round(b.calories),
      sessionsCount: b.sessionsCount,
      score,
    };
  });

  // 8 Unlockable Achievement Badges
  const badges: AchievementBadge[] = [
    {
      id: 'first_sweat',
      title: 'First Sweat',
      description: 'Complete your very first tracked AI workout',
      icon: 'sparkles',
      color: '#39E66B',
      unlocked: workouts.length >= 1,
      progress: Math.min(1, workouts.length),
      target: 1,
      unit: 'workout',
    },
    {
      id: 'century_jumper',
      title: 'Century Jumper',
      description: 'Log 100+ jumps in a single skipping session',
      icon: 'zap',
      color: '#39E66B',
      unlocked: bestSessionJumps >= 100,
      progress: Math.min(100, bestSessionJumps),
      target: 100,
      unit: 'jumps',
    },
    {
      id: 'speed_demon',
      title: 'Speed Demon',
      description: 'Maintain an average cadence of 90+ JPM',
      icon: 'gauge',
      color: '#F59E0B',
      unlocked: bestSkippingPace >= 90,
      progress: Math.min(90, Math.round(bestSkippingPace)),
      target: 90,
      unit: 'JPM',
    },
    {
      id: 'pushup_starter',
      title: 'Floor Warrior',
      description: 'Complete a calibrated floor Push-Up session',
      icon: 'target',
      color: '#5E96FF',
      unlocked: pushUpSessionsCount >= 1,
      progress: Math.min(1, pushUpSessionsCount),
      target: 1,
      unit: 'session',
    },
    {
      id: 'iron_chest',
      title: 'Iron Chest',
      description: 'Reach 100 total lifetime push-up repetitions',
      icon: 'flame',
      color: '#5E96FF',
      unlocked: totalLifetimePushUps >= 100,
      progress: Math.min(100, totalLifetimePushUps),
      target: 100,
      unit: 'reps',
    },
    {
      id: 'hat_trick_streak',
      title: 'On Fire Streak',
      description: 'Train consistently for 3 consecutive days',
      icon: 'crown',
      color: '#FF375F',
      unlocked: longestStreak >= 3,
      progress: Math.min(3, Math.max(currentStreak, longestStreak)),
      target: 3,
      unit: 'days',
    },
    {
      id: 'calorie_torcher',
      title: 'Calorie Torcher',
      description: 'Burn an estimated 150+ kcal across workouts',
      icon: 'heart',
      color: '#F97316',
      unlocked: lifetimeCalories >= 150,
      progress: Math.min(150, Math.round(lifetimeCalories)),
      target: 150,
      unit: 'kcal',
    },
    {
      id: 'thousand_club',
      title: '1K Rope Club',
      description: 'Accumulate 1,000 lifetime skipping jumps',
      icon: 'trophy',
      color: '#A855F7',
      unlocked: totalLifetimeJumps >= 1000,
      progress: Math.min(1000, totalLifetimeJumps),
      target: 1000,
      unit: 'jumps',
    },
  ];

  const unlockedBadgesCount = badges.filter((b) => b.unlocked).length;

  // Dynamic personalized coach prompt
  const { coachMessage, coachHighlight } = deriveCoachPrompt({
    workoutsCount: workouts.length,
    currentStreak,
    workedOutToday,
    todayJumps,
    todayPushUps,
    goals,
    ringsClosedToday,
    now,
  });

  return {
    totalXp,
    ...rankInfo,
    currentStreak,
    longestStreak,
    workedOutToday,
    todayJumps,
    todayPushUps,
    todayActiveMinutes,
    todayCalories: Math.round(todayCalories),
    lifetimeCalories: Math.round(lifetimeCalories),
    jumpsGoalPct,
    pushUpsGoalPct,
    activeMinGoalPct,
    ringsClosedToday,
    weeklyActivity,
    badges,
    unlockedBadgesCount,
    coachMessage,
    coachHighlight,
  };
}

function deriveCoachPrompt(ctx: {
  workoutsCount: number;
  currentStreak: number;
  workedOutToday: boolean;
  todayJumps: number;
  todayPushUps: number;
  goals: DailyGoals;
  ringsClosedToday: number;
  now: Date;
}): { coachMessage: string; coachHighlight: string } {
  const hour = ctx.now.getHours();
  const timeGreeting =
    hour < 12 ? 'Morning momentum!' : hour < 17 ? 'Afternoon energy!' : 'Evening finisher!';

  if (ctx.workoutsCount === 0) {
    return {
      coachHighlight: 'Day 1 Starts Now',
      coachMessage:
        'Start your first quick 60-second session to unlock the First Sweat badge and light up your rings.',
    };
  }

  if (ctx.ringsClosedToday === 3) {
    return {
      coachHighlight: 'All 3 Rings Closed!',
      coachMessage: `Phenomenal discipline today (${ctx.currentStreak}-day streak). Recover well or push extra XP in Freedom Mode.`,
    };
  }

  const pushUpsLeft = Math.max(0, ctx.goals.dailyPushUps - ctx.todayPushUps);
  const jumpsLeft = Math.max(0, ctx.goals.dailyJumps - ctx.todayJumps);

  if (ctx.workedOutToday) {
    if (pushUpsLeft > 0 && pushUpsLeft <= 15) {
      return {
        coachHighlight: 'Almost There!',
        coachMessage: `Only ${pushUpsLeft} push-up${pushUpsLeft === 1 ? '' : 's'} left to close your blue strength ring today.`,
      };
    }
    if (jumpsLeft > 0 && jumpsLeft <= 80) {
      return {
        coachHighlight: 'Finish Strong!',
        coachMessage: `Just ${jumpsLeft} jumps away from closing today’s neon skipping ring!`,
      };
    }
    return {
      coachHighlight: `${ctx.currentStreak}-Day Streak Active`,
      coachMessage: `Great work logging today’s session. Knock out ${pushUpsLeft > 0 ? `${pushUpsLeft} push-ups` : `${jumpsLeft} jumps`} to close another ring.`,
    };
  }

  if (ctx.currentStreak > 0) {
    return {
      coachHighlight: `Protect Your ${ctx.currentStreak}-Day Streak`,
      coachMessage: `${timeGreeting} Even a fast 10-rep push-up set keeps your ${ctx.currentStreak}-day streak burning.`,
    };
  }

  return {
    coachHighlight: timeGreeting,
    coachMessage: `Ready to build a new streak? Hit ${ctx.goals.dailyJumps} jumps or ${ctx.goals.dailyPushUps} push-ups today.`,
  };
}

/**
 * Evaluates a finished workout against prior workout history for celebration banners.
 */
export function evaluateSessionHighlights(
  session: WorkoutSessionData,
  previousWorkouts: WorkoutSessionData[]
): SessionHighlight {
  const isPushUp = session.exercise_type === 'push_up';
  const sameExerciseHistory = previousWorkouts.filter((w) =>
    isPushUp ? w.exercise_type === 'push_up' : w.exercise_type !== 'push_up'
  );

  const count = isPushUp
    ? session.completed_reps ?? session.total_jumps ?? 0
    : session.total_jumps || 0;
  const pace = session.average_jumps_per_minute || 0;

  const prevBestCount = sameExerciseHistory.reduce(
    (max, w) => Math.max(max, isPushUp ? w.completed_reps ?? w.total_jumps ?? 0 : w.total_jumps || 0),
    0
  );
  const prevBestPace = sameExerciseHistory.reduce(
    (max, w) => Math.max(max, w.average_jumps_per_minute || 0),
    0
  );

  const isNewBestCount = count > 0 && count > prevBestCount;
  const isNewBestPace = pace > 0 && pace > prevBestPace && sameExerciseHistory.length > 0;

  let intensityLabel = 'Steady Pace';
  let intensityColor = '#38BDF8';
  if (isPushUp) {
    if (pace >= 20) {
      intensityLabel = 'Explosive Strength';
      intensityColor = '#FF375F';
    } else if (count >= 20) {
      intensityLabel = 'Chest Endurance';
      intensityColor = '#5E96FF';
    } else {
      intensityLabel = 'Controlled Form';
      intensityColor = '#39E66B';
    }
  } else {
    if (pace >= 100) {
      intensityLabel = 'HIIT Turbo';
      intensityColor = '#FF375F';
    } else if (pace >= 65) {
      intensityLabel = 'Cardio Burn';
      intensityColor = '#39E66B';
    } else {
      intensityLabel = 'Rhythm Builder';
      intensityColor = '#F59E0B';
    }
  }

  let encouragementQuote = 'Every rep compounds into unstoppable stamina.';
  if (isNewBestCount) {
    encouragementQuote = `New personal high of ${count} ${isPushUp ? 'reps' : 'jumps'}! You just raised your ceiling.`;
  } else if (isNewBestPace) {
    encouragementQuote = `Fastest average cadence yet (${Math.round(pace)} ${isPushUp ? 'RPM' : 'JPM'})!`;
  } else if (count >= 100 && !isPushUp) {
    encouragementQuote = 'Triple-digit skipping effort! Your cardiovascular engine is leveling up.';
  } else if (isPushUp && session.completion_status === 'completed') {
    encouragementQuote = 'Clean depth, full extension, target locked and crushed!';
  }

  return {
    xpEarned: calculateSessionXp(session),
    caloriesBurned: estimateSessionCalories(session),
    isNewBestCount,
    isNewBestPace,
    intensityLabel,
    intensityColor,
    encouragementQuote,
  };
}

