import React, { useState, useEffect, useRef } from 'react';
import { WorkoutSessionData } from '../types/workout';
import { WorkoutService } from '../workout/workoutService';
import { CheckCircle2, Home, History, RotateCcw, Flame, Clock, Gauge } from 'lucide-react';

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
  const saveAttemptedRef = useRef(false);

  useEffect(() => {
    async function autoSave() {
      if (saveAttemptedRef.current) return;
      saveAttemptedRef.current = true;
      try {
        await WorkoutService.saveWorkout(session);
        setIsSaved(true);
      } catch (err) {
        console.error('Failed to auto-save pushup session:', err);
      }
    }
    autoSave();
  }, [session]);

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
      {/* Header celebration badge */}
      <div style={{ textAlign: 'center', marginTop: 12, marginBottom: 24 }}>
        <div
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
            margin: '0 auto 16px auto',
            boxShadow: '0 0 24px rgba(57, 230, 107, 0.35)',
          }}
        >
          <CheckCircle2 size={36} />
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: -0.5, marginBottom: 4 }}>
          {session.completion_status === 'completed'
            ? 'Push-Up Workout Completed!'
            : 'Push-Up Session Finished'}
        </h1>
        <p style={{ fontSize: 13, color: '#8E9AA8' }}>
          {new Date(session.end_time).toLocaleDateString(undefined, {
            weekday: 'long',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>

      {/* Main Repetition Card */}
      <div
        style={{
          backgroundColor: '#12161A',
          border: '1px solid rgba(57, 230, 107, 0.35)',
          borderRadius: 24,
          padding: 24,
          textAlign: 'center',
          marginBottom: 20,
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.5)',
        }}
      >
        <div
          style={{
            display: 'inline-block',
            fontSize: 11,
            fontWeight: 800,
            color: '#39E66B',
            letterSpacing: 1,
            textTransform: 'uppercase',
            backgroundColor: 'rgba(57, 230, 107, 0.15)',
            padding: '4px 12px',
            borderRadius: 20,
            marginBottom: 10,
          }}
        >
          {modeTitle}
        </div>
        <div
          className="tabular-nums"
          style={{
            fontSize: 76,
            fontWeight: 900,
            lineHeight: 1,
            color: '#FFFFFF',
            marginBottom: 6,
          }}
        >
          {completedReps}
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#8E9AA8' }}>
          {isTargetMode ? `Completed of ${targetReps} Target (${completionPercentage}%)` : 'Total Completed Repetitions'}
        </div>
      </div>

      {/* 3 Metric Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 12,
          marginBottom: 24,
        }}
      >
        {/* Duration */}
        <div
          style={{
            backgroundColor: '#12161A',
            border: '1px solid #232930',
            borderRadius: 16,
            padding: 16,
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
          <div style={{ fontSize: 11, color: '#8E9AA8', fontWeight: 600, marginBottom: 2 }}>
            DURATION
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#FFFFFF' }}>
            {formatDuration(session.active_duration_seconds)}
          </div>
        </div>

        {/* Cadence (RPM) */}
        <div
          style={{
            backgroundColor: '#12161A',
            border: '1px solid #232930',
            borderRadius: 16,
            padding: 16,
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
            <Gauge size={18} />
          </div>
          <div style={{ fontSize: 11, color: '#8E9AA8', fontWeight: 600, marginBottom: 2 }}>
            CADENCE
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#FFFFFF' }}>
            {session.average_jumps_per_minute} RPM
          </div>
        </div>

        {/* Completion Status */}
        <div
          style={{
            backgroundColor: '#12161A',
            border: '1px solid #232930',
            borderRadius: 16,
            padding: 16,
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
            <Flame size={18} />
          </div>
          <div style={{ fontSize: 11, color: '#8E9AA8', fontWeight: 600, marginBottom: 2 }}>
            STATUS
          </div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 800,
              color: session.completion_status === 'completed' ? '#39E66B' : '#FF9F0A',
              textTransform: 'uppercase',
            }}
          >
            {session.completion_status || 'COMPLETED'}
          </div>
        </div>
      </div>

      {/* Database Save Confirmation */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          backgroundColor: isSaved ? 'rgba(57, 230, 107, 0.1)' : '#181E24',
          border: isSaved ? '1px solid rgba(57, 230, 107, 0.3)' : '1px solid #232930',
          padding: '12px 16px',
          borderRadius: 14,
          marginBottom: 24,
        }}
      >
        <CheckCircle2 size={16} color={isSaved ? '#39E66B' : '#8E9AA8'} />
        <span style={{ fontSize: 13, color: isSaved ? '#39E66B' : '#8E9AA8', fontWeight: 600 }}>
          {isSaved ? 'Session saved to SQLite database' : 'Saving session...'}
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
            border: 'none',
            cursor: 'pointer',
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
              cursor: 'pointer',
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
              cursor: 'pointer',
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
