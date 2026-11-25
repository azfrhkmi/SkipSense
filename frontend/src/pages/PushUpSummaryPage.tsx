import React, { useState, useEffect, useRef } from 'react';
import { WorkoutSessionData } from '../types/workout';
import { WorkoutService } from '../workout/workoutService';
import { ConfettiBurst } from '../components/ConfettiBurst';
import {
  buildMotivationProfile,
  evaluateSessionHighlights,
  loadDailyGoals,
  SessionHighlight,
} from '../utils/motivationEngine';
import {
  CheckCircle2,
  Home,
  History,
  RotateCcw,
  Flame,
  Clock,
  Gauge,
  Trophy,
  Sparkles,
} from 'lucide-react';

interface PushUpSummaryPageProps {
  session: WorkoutSessionData;
  onGoHome: () => void;
  onWorkoutAgain: () => void;
  onViewHistory: () => void;
}

export const PushUpSummaryPage: React.FC<PushUpSummaryPageProps> = ({
  session,
  onGoHome,
  onWorkoutAgain,
  onViewHistory,
}) => {
  const [isSaved, setIsSaved] = useState(false);
  const [workoutsAfterSave, setWorkoutsAfterSave] = useState<WorkoutSessionData[]>([session]);
  const [highlights, setHighlights] = useState<SessionHighlight>(() =>
    evaluateSessionHighlights(session, [])
  );
  const saveAttemptedRef = useRef(false);

  useEffect(() => {
    async function saveAndComputeMotivation() {
      if (saveAttemptedRef.current) return;
      saveAttemptedRef.current = true;
      try {
        const previousHistory = await WorkoutService.getWorkouts();
        setHighlights(evaluateSessionHighlights(session, previousHistory));

        const saved = await WorkoutService.saveWorkout(session);
        setWorkoutsAfterSave([saved, ...previousHistory]);
        setIsSaved(true);
      } catch (err) {
        console.error('Failed to auto-save pushup session:', err);
      }
    }
    saveAndComputeMotivation();
  }, [session]);

  const profile = buildMotivationProfile(workoutsAfterSave, loadDailyGoals());

  const formatDuration = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = Math.floor(totalSec % 60);
    return `${mins}m ${secs.toString().padStart(2, '0')}s`;
  };

  const completedReps = session.completed_reps ?? session.total_jumps ?? 0;
  const targetReps = session.target_reps ?? null;
  const isTargetMode = targetReps !== null;
  const completionPercentage = isTargetMode
    ? Math.min(100, Math.round((completedReps / targetReps) * 100))
    : 100;

  const modeTitle =
    session.workout_mode === 'freedom'
      ? 'Freedom Mode'
      : `${session.workout_mode || '10'} Rep Target`;

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#090B0D',
        color: '#FFFFFF',
        padding: '24px 20px 40px 20px',
        maxWidth: 600,
        margin: '0 auto',
      }}
    >
      <ConfettiBurst active={completedReps > 0} durationMs={2800} />

      {/* Header celebration badge */}
      <div style={{ textAlign: 'center', marginTop: 8, marginBottom: 20 }}>
        <div
          className="animate-pop"
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            backgroundColor: 'rgba(57, 230, 107, 0.15)',
            color: '#39E66B',
            border: '2px solid #39E66B',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 14px auto',
            boxShadow: '0 0 24px rgba(57, 230, 107, 0.35)',
          }}
        >
          <CheckCircle2 size={36} />
        </div>
        <h1 style={{ fontSize: 25, fontWeight: 900, letterSpacing: -0.5, marginBottom: 4 }}>
          {session.completion_status === 'completed'
            ? 'Push-Up Workout Completed!'
            : 'Push-Up Session Finished'}
        </h1>
        <p style={{ fontSize: 13, color: '#8E9AA8', marginBottom: 10 }}>
          {highlights.encouragementQuote}
        </p>

        {/* Personal Best Tag */}
        {(highlights.isNewBestCount || highlights.isNewBestPace) && (
          <div
            className="animate-pop"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              backgroundColor: 'rgba(245, 185, 66, 0.16)',
              border: '1px solid rgba(245, 185, 66, 0.5)',
              color: '#F5B942',
              padding: '5px 14px',
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 800,
            }}
          >
            <Trophy size={14} />
            <span>
              {highlights.isNewBestCount ? 'NEW PERSONAL BEST REPS!' : 'NEW BEST CADENCE!'}
            </span>
          </div>
        )}
      </div>

      {/* Main Repetition Card */}
      <div
        style={{
          background: 'linear-gradient(155deg, #171E29 0%, #12161A 75%)',
          border: '1px solid rgba(94, 150, 255, 0.35)',
          borderRadius: 24,
          padding: 22,
          textAlign: 'center',
          marginBottom: 16,
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.5)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 10 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: '#5E96FF',
              letterSpacing: 1,
              textTransform: 'uppercase',
              backgroundColor: 'rgba(94, 150, 255, 0.15)',
              padding: '4px 12px',
              borderRadius: 20,
            }}
          >
            {modeTitle}
          </span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: highlights.intensityColor,
              letterSpacing: 0.8,
              textTransform: 'uppercase',
              backgroundColor: `${highlights.intensityColor}20`,
              padding: '4px 12px',
              borderRadius: 20,
            }}
          >
            {highlights.intensityLabel}
          </span>
        </div>
        <div
          className="tabular-nums"
          style={{
            fontSize: 74,
            fontWeight: 900,
            lineHeight: 1,
            color: '#FFFFFF',
            marginBottom: 6,
          }}
        >
          {completedReps}
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#8E9AA8' }}>
          {isTargetMode
            ? `Completed of ${targetReps} Target (${completionPercentage}%) • Est. ${highlights.caloriesBurned} kcal`
            : `Total Completed Repetitions • Est. ${highlights.caloriesBurned} kcal`}
        </div>
      </div>

      {/* XP & Athlete Rank Card */}
      <div
        style={{
          backgroundColor: '#12161A',
          border: `1px solid ${profile.rank.color}44`,
          borderRadius: 18,
          padding: '14px 16px',
          marginBottom: 16,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 800 }}>
            <Sparkles size={15} color={profile.rank.color} />
            <span>
              Lv.{profile.rank.level} {profile.rank.title}
            </span>
          </div>
          <span className="tabular-nums" style={{ fontSize: 14, fontWeight: 900, color: '#39E66B' }}>
            +{highlights.xpEarned} XP Earned
          </span>
        </div>
        <div style={{ height: 6, backgroundColor: '#1E252C', borderRadius: 3, overflow: 'hidden' }}>
          <div
            style={{
              width: `${profile.levelProgressPct}%`,
              height: '100%',
              backgroundColor: profile.rank.color,
              borderRadius: 3,
              transition: 'width 0.7s ease-out',
            }}
          />
        </div>
      </div>

      {/* 3 Metric Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 12,
          marginBottom: 20,
        }}
      >
        {/* Duration */}
        <div
          style={{
            backgroundColor: '#12161A',
            border: '1px solid #232930',
            borderRadius: 16,
            padding: 14,
            textAlign: 'center',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#39E66B',
              marginBottom: 6,
            }}
          >
            <Clock size={18} />
          </div>
          <div style={{ fontSize: 10, color: '#8E9AA8', fontWeight: 700, marginBottom: 2 }}>
            DURATION
          </div>
          <div className="tabular-nums" style={{ fontSize: 16, fontWeight: 800, color: '#FFFFFF' }}>
            {formatDuration(session.active_duration_seconds)}
          </div>
        </div>

        {/* Cadence (RPM) */}
        <div
          style={{
            backgroundColor: '#12161A',
            border: '1px solid #232930',
            borderRadius: 16,
            padding: 14,
            textAlign: 'center',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#5E96FF',
              marginBottom: 6,
            }}
          >
            <Gauge size={18} />
          </div>
          <div style={{ fontSize: 10, color: '#8E9AA8', fontWeight: 700, marginBottom: 2 }}>
            CADENCE
          </div>
          <div className="tabular-nums" style={{ fontSize: 16, fontWeight: 800, color: '#FFFFFF' }}>
            {session.average_jumps_per_minute} RPM
          </div>
        </div>

        {/* Calories Burned */}
        <div
          style={{
            backgroundColor: '#12161A',
            border: '1px solid #232930',
            borderRadius: 16,
            padding: 14,
            textAlign: 'center',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FF9F0A',
              marginBottom: 6,
            }}
          >
            <Flame size={18} />
          </div>
          <div style={{ fontSize: 10, color: '#8E9AA8', fontWeight: 700, marginBottom: 2 }}>
            EST. BURN
          </div>
          <div className="tabular-nums" style={{ fontSize: 16, fontWeight: 800, color: '#FF9F0A' }}>
            {highlights.caloriesBurned} kcal
          </div>
        </div>
      </div>

      {/* Database Save Confirmation */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: isSaved ? 'rgba(57, 230, 107, 0.1)' : '#181E24',
          border: isSaved ? '1px solid rgba(57, 230, 107, 0.3)' : '1px solid #232930',
          padding: '12px 16px',
          borderRadius: 14,
          marginBottom: 22,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle2 size={16} color={isSaved ? '#39E66B' : '#8E9AA8'} />
          <span style={{ fontSize: 13, color: isSaved ? '#39E66B' : '#8E9AA8', fontWeight: 600 }}>
            {isSaved ? 'Session saved to SQLite database' : 'Saving session...'}
          </span>
        </div>
        <span style={{ fontSize: 12, fontWeight: 800, color: '#FF9F0A' }}>
          🔥 {profile.currentStreak}d Streak
        </span>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <button
          onClick={onWorkoutAgain}
          style={{
            height: 52,
            borderRadius: 16,
            backgroundColor: '#39E66B',
            color: '#090B0D',
            fontSize: 16,
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            boxShadow: '0 4px 20px rgba(57, 230, 107, 0.35)',
          }}
        >
          <RotateCcw size={18} strokeWidth={2.5} />
          <span>Workout Again</span>
        </button>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <button
            onClick={onViewHistory}
            style={{
              height: 48,
              borderRadius: 14,
              backgroundColor: '#181E24',
              color: '#FFFFFF',
              fontSize: 14,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              border: '1px solid #232930',
            }}
          >
            <History size={16} />
            <span>History</span>
          </button>

          <button
            onClick={onGoHome}
            style={{
              height: 48,
              borderRadius: 14,
              backgroundColor: '#181E24',
              color: '#FFFFFF',
              fontSize: 14,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              border: '1px solid #232930',
            }}
          >
            <Home size={16} />
            <span>Dashboard</span>
          </button>
        </div>
      </div>
    </div>
  );
};
