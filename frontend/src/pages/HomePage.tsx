import React, { useEffect, useMemo, useState } from 'react';
import { LifetimeStats, WorkoutSessionData } from '../types/workout';
import { WorkoutService } from '../workout/workoutService';
import { PushUpModeSelector } from '../components/PushUpModeSelector';
import { PushUpMode } from '../exercises/pushup/pushUpTypes';
import { ActivityRings } from '../components/ActivityRings';
import { WeeklyActivityChart } from '../components/WeeklyActivityChart';
import { DailyGoalModal } from '../components/DailyGoalModal';
import { TrophyCaseModal, renderBadgeIcon } from '../components/TrophyCaseModal';
import {
  buildMotivationProfile,
  DailyGoals,
  estimateSessionCalories,
  loadDailyGoals,
  saveDailyGoals,
} from '../utils/motivationEngine';
import {
  Zap,
  Play,
  History,
  Flame,
  ChevronRight,
  Target,
  ArrowRight,
  Activity,
  Trophy,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';

interface HomePageProps {
  onStartSkipping: () => void;
  onStartPushUp: (mode: PushUpMode) => void;
  onViewHistory: () => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  onStartSkipping,
  onStartPushUp,
  onViewHistory,
}) => {
  const [stats, setStats] = useState<LifetimeStats>({
    total_lifetime_jumps: 0,
    total_sessions: 0,
    total_active_duration_seconds: 0,
    best_record_jumps: 0,
    best_record_pace: 0,
    total_lifetime_pushups: 0,
    total_pushup_sessions: 0,
    best_record_pushups: 0,
    best_pushup_pace: 0,
  });
  const [allWorkouts, setAllWorkouts] = useState<WorkoutSessionData[]>([]);
  const [goals, setGoals] = useState<DailyGoals>(() => loadDailyGoals());
  const [loading, setLoading] = useState(true);

  const [showPushUpModal, setShowPushUpModal] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showTrophyModal, setShowTrophyModal] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const [statsData, workoutsData] = await Promise.all([
          WorkoutService.getStats(),
          WorkoutService.getWorkouts(),
        ]);
        setStats(statsData);
        setAllWorkouts(workoutsData);
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const profile = useMemo(
    () => buildMotivationProfile(allWorkouts, goals),
    [allWorkouts, goals]
  );

  const recentWorkouts = useMemo(() => allWorkouts.slice(0, 4), [allWorkouts]);

  // Identify next achievement closest to completion
  const nextBadgeToUnlock = useMemo(() => {
    const locked = profile.badges.filter((b) => !b.unlocked);
    if (locked.length === 0) return profile.badges[profile.badges.length - 1];
    return locked.sort((a, b) => b.progress / b.target - a.progress / a.target)[0];
  }, [profile.badges]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    if (mins >= 60) {
      const hrs = Math.floor(mins / 60);
      const remainingMins = mins % 60;
      return `${hrs}h ${remainingMins}m`;
    }
    return `${mins}m ${secs}s`;
  };

  const handleSelectPushUpMode = (mode: PushUpMode) => {
    setShowPushUpModal(false);
    onStartPushUp(mode);
  };

  const handleSaveGoals = (newGoals: DailyGoals) => {
    const saved = saveDailyGoals(newGoals);
    setGoals(saved);
    setShowGoalModal(false);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--text-primary)',
        padding: '20px 18px 44px 18px',
        maxWidth: 600,
        margin: '0 auto',
      }}
    >
      {/* Top Header with Brand, Streak Flame & History */}
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 11,
              background: 'linear-gradient(135deg, #39E66B 0%, #24B852 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#090B0D',
              boxShadow: '0 4px 14px rgba(57, 230, 107, 0.35)',
            }}
          >
            <Zap size={22} strokeWidth={2.8} />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 900, letterSpacing: -0.5, lineHeight: 1.1 }}>
              SkipSense
            </h1>
            <button
              onClick={() => setShowTrophyModal(true)}
              style={{
                background: 'none',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 12,
                fontWeight: 700,
                color: profile.rank.color,
              }}
            >
              <span>Lv.{profile.rank.level} {profile.rank.title}</span>
              <span style={{ color: '#5E676F' }}>•</span>
              <span style={{ color: '#929BA3' }}>{profile.totalXp.toLocaleString()} XP</span>
              <ChevronRight size={12} color="#929BA3" />
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Streak Pill */}
          <div
            title={profile.workedOutToday ? 'Streak active today!' : 'Work out today to extend streak'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              backgroundColor:
                profile.currentStreak > 0 ? 'rgba(255, 159, 10, 0.14)' : '#181D22',
              border:
                profile.currentStreak > 0
                  ? '1px solid rgba(255, 159, 10, 0.4)'
                  : '1px solid var(--border-subtle)',
              padding: '8px 11px',
              borderRadius: 12,
              fontSize: 12,
              fontWeight: 800,
              color: profile.currentStreak > 0 ? '#FF9F0A' : '#929BA3',
            }}
          >
            <Flame
              size={15}
              fill={profile.currentStreak > 0 ? '#FF9F0A' : 'none'}
              color={profile.currentStreak > 0 ? '#FF9F0A' : '#929BA3'}
            />
            <span className="tabular-nums">
              {profile.currentStreak > 0 ? `${profile.currentStreak}d` : '0d'}
            </span>
          </div>

          <button
            onClick={onViewHistory}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              backgroundColor: 'var(--bg-card)',
              color: 'var(--text-primary)',
              padding: '8px 12px',
              borderRadius: 12,
              fontSize: 12,
              fontWeight: 700,
              border: '1px solid var(--border-subtle)',
            }}
          >
            <History size={15} />
            <span>History</span>
          </button>
        </div>
      </header>

      {/* Thin XP Progress Strip */}
      <div
        onClick={() => setShowTrophyModal(true)}
        style={{
          cursor: 'pointer',
          marginBottom: 18,
          backgroundColor: '#12161A',
          border: '1px solid #20262C',
          borderRadius: 12,
          padding: '8px 12px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 11,
            fontWeight: 700,
            marginBottom: 5,
          }}
        >
          <span style={{ color: '#929BA3' }}>
            {profile.rank.nextLevelXp !== null
              ? `${profile.xpForNextLevel.toLocaleString()} XP to Level ${profile.rank.level + 1}`
              : 'Apex Legend Rank Reached'}
          </span>
          <span style={{ color: profile.rank.color }}>{profile.levelProgressPct}%</span>
        </div>
        <div
          style={{
            width: '100%',
            height: 5,
            backgroundColor: '#1C2228',
            borderRadius: 3,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${profile.levelProgressPct}%`,
              height: '100%',
              backgroundColor: profile.rank.color,
              borderRadius: 3,
              transition: 'width 0.6s ease-out',
            }}
          />
        </div>
      </div>

      {/* Today's Activity Rings & AI Coach Card */}
      <div
        style={{
          background: 'linear-gradient(145deg, #161D23 0%, #101417 100%)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 24,
          padding: 18,
          marginBottom: 20,
          boxShadow: '0 12px 32px rgba(0, 0, 0, 0.45)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 14,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Sparkles size={14} color="#39E66B" />
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: '#39E66B',
                letterSpacing: 0.9,
                textTransform: 'uppercase',
              }}
            >
              Today&apos;s Rings &amp; Coach
            </span>
          </div>

          <button
            onClick={() => setShowGoalModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              backgroundColor: '#1E252C',
              color: '#CBD5E1',
              padding: '5px 10px',
              borderRadius: 10,
              fontSize: 11,
              fontWeight: 700,
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <SlidersHorizontal size={12} />
            <span>Goals</span>
          </button>
        </div>

        {/* Rings + Ring Legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 14 }}>
          <ActivityRings
            jumpsPct={profile.jumpsGoalPct}
            pushUpsPct={profile.pushUpsGoalPct}
            activeMinPct={profile.activeMinGoalPct}
            ringsClosed={profile.ringsClosedToday}
            size={122}
          />

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 9 }}>
            {/* Ring 1: Skipping */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
                <span style={{ color: '#39E66B', fontWeight: 800 }}>Skipping</span>
                <span className="tabular-nums" style={{ color: '#FFFFFF', fontWeight: 700 }}>
                  {profile.todayJumps}{' '}
                  <span style={{ color: '#5E676F', fontWeight: 600 }}>/ {goals.dailyJumps}</span>
                </span>
              </div>
              <div style={{ height: 4, borderRadius: 2, backgroundColor: 'rgba(57,230,107,0.12)' }}>
                <div
                  style={{
                    width: `${profile.jumpsGoalPct}%`,
                    height: '100%',
                    borderRadius: 2,
                    backgroundColor: '#39E66B',
                    transition: 'width 0.5s ease',
                  }}
                />
              </div>
            </div>

            {/* Ring 2: Push-Ups */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
                <span style={{ color: '#5E96FF', fontWeight: 800 }}>Push-Ups</span>
                <span className="tabular-nums" style={{ color: '#FFFFFF', fontWeight: 700 }}>
                  {profile.todayPushUps}{' '}
                  <span style={{ color: '#5E676F', fontWeight: 600 }}>/ {goals.dailyPushUps}</span>
                </span>
              </div>
              <div style={{ height: 4, borderRadius: 2, backgroundColor: 'rgba(94,150,255,0.12)' }}>
                <div
                  style={{
                    width: `${profile.pushUpsGoalPct}%`,
                    height: '100%',
                    borderRadius: 2,
                    backgroundColor: '#5E96FF',
                    transition: 'width 0.5s ease',
                  }}
                />
              </div>
            </div>

            {/* Ring 3: Active Time */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
                <span style={{ color: '#FF9F0A', fontWeight: 800 }}>Active Time</span>
                <span className="tabular-nums" style={{ color: '#FFFFFF', fontWeight: 700 }}>
                  {profile.todayActiveMinutes}m{' '}
                  <span style={{ color: '#5E676F', fontWeight: 600 }}>/ {goals.dailyActiveMinutes}m</span>
                </span>
              </div>
              <div style={{ height: 4, borderRadius: 2, backgroundColor: 'rgba(255,159,10,0.12)' }}>
                <div
                  style={{
                    width: `${profile.activeMinGoalPct}%`,
                    height: '100%',
                    borderRadius: 2,
                    backgroundColor: '#FF9F0A',
                    transition: 'width 0.5s ease',
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Personalized Coach Banner */}
        <div
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: 14,
            padding: '10px 14px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#FFFFFF', marginBottom: 2 }}>
              {profile.coachHighlight}
            </div>
            <div style={{ fontSize: 12, color: '#929BA3', lineHeight: 1.35 }}>
              {profile.coachMessage}
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div className="tabular-nums" style={{ fontSize: 15, fontWeight: 900, color: '#FF9F0A' }}>
              {profile.todayCalories}
            </div>
            <div style={{ fontSize: 10, color: '#929BA3', fontWeight: 600 }}>Est. kcal</div>
          </div>
        </div>
      </div>

      {/* Exercise Selection Section */}
      <div style={{ marginBottom: 22 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
          }}
        >
          <h2
            style={{
              fontSize: 13,
              fontWeight: 800,
              color: 'var(--text-muted)',
              letterSpacing: 1,
              textTransform: 'uppercase',
            }}
          >
            Start Training
          </h2>
          <span style={{ fontSize: 11, color: '#929BA3', fontWeight: 600 }}>
            100% On-Device AI Pose
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* 1. Skipping Mode Card */}
          <div
            style={{
              background: 'linear-gradient(155deg, #16221B 0%, #12161A 65%)',
              border: '1px solid rgba(57, 230, 107, 0.28)',
              borderRadius: 22,
              padding: 18,
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 14 }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  backgroundColor: 'rgba(57, 230, 107, 0.16)',
                  border: '1px solid rgba(57, 230, 107, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#39E66B',
                  flexShrink: 0,
                }}
              >
                <Zap size={24} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 800, color: '#FFFFFF' }}>Skipping</h3>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      backgroundColor: 'rgba(57, 230, 107, 0.15)',
                      color: '#39E66B',
                      padding: '3px 9px',
                      borderRadius: 10,
                      textTransform: 'uppercase',
                    }}
                  >
                    Best: {stats.best_record_jumps} jumps
                  </span>
                </div>
                <p style={{ fontSize: 12.5, color: '#929BA3', lineHeight: 1.4 }}>
                  Standing full-body tracking with auto-pause &amp; live cadence pace.
                </p>
              </div>
            </div>

            <button
              onClick={onStartSkipping}
              className="animate-glow"
              style={{
                width: '100%',
                height: 48,
                borderRadius: 14,
                backgroundColor: '#39E66B',
                color: '#090B0D',
                fontSize: 15,
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <Play size={18} fill="#090B0D" />
              <span>Start Skipping Workout</span>
            </button>
          </div>

          {/* 2. Push-Up Mode Card */}
          <div
            style={{
              background: 'linear-gradient(155deg, #171D29 0%, #12161A 65%)',
              border: '1px solid rgba(94, 150, 255, 0.3)',
              borderRadius: 22,
              padding: 18,
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 14 }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  backgroundColor: 'rgba(94, 150, 255, 0.16)',
                  border: '1px solid rgba(94, 150, 255, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#5E96FF',
                  flexShrink: 0,
                }}
              >
                <Flame size={24} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 800, color: '#FFFFFF' }}>Push-Ups</h3>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      backgroundColor: 'rgba(94, 150, 255, 0.15)',
                      color: '#5E96FF',
                      padding: '3px 9px',
                      borderRadius: 10,
                      textTransform: 'uppercase',
                    }}
                  >
                    Best: {stats.best_record_pushups || 0} reps
                  </span>
                </div>
                <p style={{ fontSize: 12.5, color: '#929BA3', lineHeight: 1.4 }}>
                  Floor camera proximity calibration • Beginner (10), 20, 30, or Freedom Mode.
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowPushUpModal(true)}
              style={{
                width: '100%',
                height: 48,
                borderRadius: 14,
                background: 'linear-gradient(135deg, #5E96FF 0%, #3B76F6 100%)',
                color: '#FFFFFF',
                fontSize: 15,
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                boxShadow: '0 4px 16px rgba(94, 150, 255, 0.35)',
              }}
            >
              <Target size={18} />
              <span>Choose Target &amp; Start</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Weekly Activity Consistency Chart */}
      <WeeklyActivityChart days={profile.weeklyActivity} />

      {/* Trophy Case Strip (Clickable) */}
      <div
        onClick={() => setShowTrophyModal(true)}
        style={{
          backgroundColor: '#12161A',
          border: '1px solid #232930',
          borderRadius: 20,
          padding: 16,
          marginBottom: 22,
          cursor: 'pointer',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Trophy size={17} color="#F5B942" />
            <span style={{ fontSize: 14, fontWeight: 800, color: '#FFFFFF' }}>
              Trophy Case ({profile.unlockedBadgesCount}/{profile.badges.length})
            </span>
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#39E66B', display: 'flex', alignItems: 'center', gap: 2 }}>
            View All <ChevronRight size={14} />
          </span>
        </div>

        {/* Highlight next badge or recently earned badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            backgroundColor: '#181E24',
            borderRadius: 14,
            padding: '10px 12px',
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 11,
              backgroundColor: `${nextBadgeToUnlock.color}20`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {renderBadgeIcon(nextBadgeToUnlock.icon, 19, nextBadgeToUnlock.color)}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
              <span style={{ color: '#FFFFFF' }}>
                {nextBadgeToUnlock.unlocked ? 'Unlocked: ' : 'Next Goal: '}
                {nextBadgeToUnlock.title}
              </span>
              <span className="tabular-nums" style={{ color: nextBadgeToUnlock.color }}>
                {nextBadgeToUnlock.progress}/{nextBadgeToUnlock.target}
              </span>
            </div>
            <div style={{ width: '100%', height: 5, backgroundColor: '#0E1216', borderRadius: 3 }}>
              <div
                style={{
                  width: `${Math.min(100, Math.round((nextBadgeToUnlock.progress / nextBadgeToUnlock.target) * 100))}%`,
                  height: '100%',
                  backgroundColor: nextBadgeToUnlock.color,
                  borderRadius: 3,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Lifetime Milestone Totals */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 10,
          marginBottom: 26,
        }}
      >
        <div
          style={{
            backgroundColor: '#12161A',
            border: '1px solid #232930',
            borderRadius: 16,
            padding: 12,
            textAlign: 'center',
          }}
        >
          <div className="tabular-nums" style={{ fontSize: 18, fontWeight: 800, color: '#39E66B', marginBottom: 2 }}>
            {loading ? '...' : (stats.total_lifetime_jumps || 0).toLocaleString()}
          </div>
          <div style={{ fontSize: 10, color: '#929BA3', fontWeight: 600 }}>LIFETIME JUMPS</div>
        </div>

        <div
          style={{
            backgroundColor: '#12161A',
            border: '1px solid #232930',
            borderRadius: 16,
            padding: 12,
            textAlign: 'center',
          }}
        >
          <div className="tabular-nums" style={{ fontSize: 18, fontWeight: 800, color: '#5E96FF', marginBottom: 2 }}>
            {loading ? '...' : (stats.total_lifetime_pushups || 0).toLocaleString()}
          </div>
          <div style={{ fontSize: 10, color: '#929BA3', fontWeight: 600 }}>LIFETIME REPS</div>
        </div>

        <div
          style={{
            backgroundColor: '#12161A',
            border: '1px solid #232930',
            borderRadius: 16,
            padding: 12,
            textAlign: 'center',
          }}
        >
          <div className="tabular-nums" style={{ fontSize: 18, fontWeight: 800, color: '#FF9F0A', marginBottom: 2 }}>
            {loading ? '...' : profile.lifetimeCalories.toLocaleString()}
          </div>
          <div style={{ fontSize: 10, color: '#929BA3', fontWeight: 600 }}>EST. KCAL</div>
        </div>
      </div>

      {/* Recent Activity Section */}
      <div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
          }}
        >
          <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>
            Recent Activity
          </h2>
          {recentWorkouts.length > 0 && (
            <button
              onClick={onViewHistory}
              style={{
                background: 'none',
                color: 'var(--accent-green)',
                fontSize: 13,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: 2,
              }}
            >
              <span>See All</span>
              <ChevronRight size={14} />
            </button>
          )}
        </div>

        {recentWorkouts.length === 0 ? (
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 18,
              padding: '32px 20px',
              textAlign: 'center',
              color: 'var(--text-secondary)',
            }}
          >
            <Activity size={32} style={{ color: 'var(--text-muted)', marginBottom: 8 }} />
            <p style={{ fontSize: 14, marginBottom: 4 }}>No workouts recorded yet.</p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Start your first workout above to unlock badges and start your streak!
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {recentWorkouts.map((session) => {
              const isPushUp = session.exercise_type === 'push_up';
              const count = isPushUp
                ? session.completed_reps ?? session.total_jumps
                : session.total_jumps;
              const unit = isPushUp ? 'reps' : 'jumps';
              const paceUnit = isPushUp ? 'RPM' : 'JPM';
              const kcal = estimateSessionCalories(session);

              return (
                <div
                  key={session.id}
                  onClick={onViewHistory}
                  style={{
                    backgroundColor: '#12161A',
                    border: '1px solid #232930',
                    borderRadius: 16,
                    padding: '13px 16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 11,
                        backgroundColor: isPushUp
                          ? 'rgba(94, 150, 255, 0.15)'
                          : 'rgba(57, 230, 107, 0.15)',
                        color: isPushUp ? '#5E96FF' : '#39E66B',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {isPushUp ? <Flame size={18} /> : <Zap size={18} />}
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: 'var(--text-primary)',
                          marginBottom: 2,
                        }}
                      >
                        {isPushUp ? 'Push-Up Session' : 'Skipping Session'}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        {formatTime(session.active_duration_seconds)} •{' '}
                        {Math.round(session.average_jumps_per_minute)} {paceUnit} • ~{Math.round(kcal)} kcal
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <span
                      className="tabular-nums"
                      style={{
                        fontSize: 20,
                        fontWeight: 800,
                        color: isPushUp ? '#5E96FF' : 'var(--accent-green)',
                      }}
                    >
                      {count}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 4 }}>
                      {unit}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modals */}
      {showPushUpModal && (
        <PushUpModeSelector
          onSelectMode={handleSelectPushUpMode}
          onCancel={() => setShowPushUpModal(false)}
        />
      )}

      {showGoalModal && (
        <DailyGoalModal
          currentGoals={goals}
          onSave={handleSaveGoals}
          onClose={() => setShowGoalModal(false)}
        />
      )}

      {showTrophyModal && (
        <TrophyCaseModal
          profile={profile}
          onClose={() => setShowTrophyModal(false)}
        />
      )}
    </div>
  );
};
