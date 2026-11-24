import React, { useEffect, useState } from 'react';
import { LifetimeStats, WorkoutSessionData } from '../types/workout';
import { WorkoutService } from '../workout/workoutService';
import { PushUpModeSelector } from '../components/PushUpModeSelector';
import { PushUpMode } from '../exercises/pushup/pushUpTypes';
import {
  Zap,
  Play,
  History,
  Flame,
  ChevronRight,
  Target,
  ArrowRight,
  Activity,
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
  const [recentWorkouts, setRecentWorkouts] = useState<WorkoutSessionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPushUpModal, setShowPushUpModal] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const [statsData, workoutsData] = await Promise.all([
          WorkoutService.getStats(),
          WorkoutService.getWorkouts(),
        ]);
        setStats(statsData);
        setRecentWorkouts(workoutsData.slice(0, 4));
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

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

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--text-primary)',
        padding: '24px 20px 40px 20px',
        maxWidth: 600,
        margin: '0 auto',
      }}
    >
      {/* Header */}
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                backgroundColor: 'var(--accent-green)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#090B0D',
              }}
            >
              <Zap size={22} strokeWidth={2.8} />
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 900, letterSpacing: -0.5 }}>SkipSense</h1>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            AI-Powered Fitness & Repetition Counter
          </p>
        </div>

        <button
          onClick={onViewHistory}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            backgroundColor: 'var(--bg-card)',
            color: 'var(--text-primary)',
            padding: '10px 14px',
            borderRadius: 12,
            fontSize: 13,
            fontWeight: 600,
            border: '1px solid var(--border-subtle)',
            cursor: 'pointer',
          }}
        >
          <History size={16} />
          <span>History</span>
        </button>
      </header>

      {/* Dual Lifetime Performance Hero Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 12,
          marginBottom: 24,
        }}
      >
        {/* Skipping Stats Card */}
        <div
          style={{
            background: 'linear-gradient(145deg, #18221D 0%, #12161A 100%)',
            border: '1px solid rgba(57, 230, 107, 0.25)',
            borderRadius: 20,
            padding: '18px 16px',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#39E66B', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', marginBottom: 6 }}>
            <Zap size={14} />
            <span>Skipping</span>
          </div>
          <div
            className="tabular-nums"
            style={{ fontSize: 32, fontWeight: 900, color: '#39E66B', lineHeight: 1, marginBottom: 4 }}
          >
            {loading ? '...' : (stats.total_lifetime_jumps || 0).toLocaleString()}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Lifetime Jumps</div>
        </div>

        {/* Push-Up Stats Card */}
        <div
          style={{
            background: 'linear-gradient(145deg, #1C1E26 0%, #12161A 100%)',
            border: '1px solid rgba(94, 150, 255, 0.25)',
            borderRadius: 20,
            padding: '18px 16px',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#5E96FF', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', marginBottom: 6 }}>
            <Flame size={14} />
            <span>Push-Ups</span>
          </div>
          <div
            className="tabular-nums"
            style={{ fontSize: 32, fontWeight: 900, color: '#5E96FF', lineHeight: 1, marginBottom: 4 }}
          >
            {loading ? '...' : (stats.total_lifetime_pushups || 0).toLocaleString()}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Lifetime Reps</div>
        </div>
      </div>

      {/* 3 Overview Quick Stats */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 10,
          marginBottom: 28,
        }}
      >
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 16,
            padding: 12,
            textAlign: 'center',
          }}
        >
          <div className="tabular-nums" style={{ fontSize: 18, fontWeight: 700, marginBottom: 2 }}>
            {stats.total_sessions}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Total Sessions</div>
        </div>

        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 16,
            padding: 12,
            textAlign: 'center',
          }}
        >
          <div className="tabular-nums" style={{ fontSize: 18, fontWeight: 700, marginBottom: 2 }}>
            {formatTime(stats.total_active_duration_seconds)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Active Time</div>
        </div>

        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 16,
            padding: 12,
            textAlign: 'center',
          }}
        >
          <div className="tabular-nums" style={{ fontSize: 18, fontWeight: 700, marginBottom: 2 }}>
            {stats.best_record_jumps}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Best Jumps</div>
        </div>
      </div>

      {/* Exercise Selection Section */}
      <div style={{ marginBottom: 32 }}>
        <h2
          style={{
            fontSize: 14,
            fontWeight: 800,
            color: 'var(--text-muted)',
            letterSpacing: 1,
            textTransform: 'uppercase',
            marginBottom: 14,
          }}
        >
          Select Exercise
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* 1. Skipping Mode Card */}
          <div
            style={{
              backgroundColor: '#12161A',
              border: '1px solid #232930',
              borderRadius: 20,
              padding: 20,
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 16 }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  backgroundColor: 'rgba(57, 230, 107, 0.15)',
                  border: '1px solid rgba(57, 230, 107, 0.3)',
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
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 800, color: '#FFFFFF' }}>Skipping</h3>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      backgroundColor: 'rgba(57, 230, 107, 0.15)',
                      color: '#39E66B',
                      padding: '2px 8px',
                      borderRadius: 10,
                      textTransform: 'uppercase',
                    }}
                  >
                    Standing Camera
                  </span>
                </div>
                <p style={{ fontSize: 13, color: '#8E9AA8', lineHeight: 1.4 }}>
                  Full-body MediaPipe skeleton tracking. Detects jumps with dynamic baseline & auto-pause.
                </p>
              </div>
            </div>

            <button
              onClick={onStartSkipping}
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
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(57, 230, 107, 0.3)',
              }}
            >
              <Play size={18} fill="#090B0D" />
              <span>Start Skipping</span>
            </button>
          </div>

          {/* 2. Push-Up Mode Card */}
          <div
            style={{
              backgroundColor: '#12161A',
              border: '1px solid #232930',
              borderRadius: 20,
              padding: 20,
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 16 }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  backgroundColor: 'rgba(94, 150, 255, 0.15)',
                  border: '1px solid rgba(94, 150, 255, 0.3)',
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
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 800, color: '#FFFFFF' }}>Push-Up</h3>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      backgroundColor: 'rgba(94, 150, 255, 0.15)',
                      color: '#5E96FF',
                      padding: '2px 8px',
                      borderRadius: 10,
                      textTransform: 'uppercase',
                    }}
                  >
                    Floor Camera
                  </span>
                </div>
                <p style={{ fontSize: 13, color: '#8E9AA8', lineHeight: 1.4 }}>
                  Upward camera perspective with guided proximity calibration. 4 workout modes (10, 20, 30, Freedom).
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowPushUpModal(true)}
              style={{
                width: '100%',
                height: 48,
                borderRadius: 14,
                backgroundColor: '#1E252D',
                border: '1px solid rgba(94, 150, 255, 0.4)',
                color: '#FFFFFF',
                fontSize: 15,
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                cursor: 'pointer',
              }}
            >
              <Target size={18} color="#5E96FF" />
              <span>Select Mode & Start Push-Ups</span>
              <ArrowRight size={16} color="#5E96FF" />
            </button>
          </div>
        </div>
      </div>

      {/* Push-Up Mode Selection Modal */}
      {showPushUpModal && (
        <PushUpModeSelector
          onSelectMode={handleSelectPushUpMode}
          onCancel={() => setShowPushUpModal(false)}
        />
      )}

      {/* Recent Activity Section */}
      <div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 14,
          }}
        >
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
            Recent Activity
          </h2>
          {recentWorkouts.length > 0 && (
            <button
              onClick={onViewHistory}
              style={{
                background: 'none',
                color: 'var(--accent-green)',
                fontSize: 13,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                cursor: 'pointer',
                border: 'none',
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
              Choose Skipping or Push-Up above to begin your first session.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {recentWorkouts.map((session) => {
              const isPushUp = session.exercise_type === 'push_up';
              const count = isPushUp ? (session.completed_reps ?? session.total_jumps) : session.total_jumps;
              const unit = isPushUp ? 'reps' : 'jumps';
              const paceUnit = isPushUp ? 'RPM' : 'JPM';

              return (
                <div
                  key={session.id}
                  onClick={onViewHistory}
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 16,
                    padding: '14px 18px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        backgroundColor: isPushUp ? 'rgba(94, 150, 255, 0.15)' : 'rgba(57, 230, 107, 0.15)',
                        color: isPushUp ? '#5E96FF' : '#39E66B',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {isPushUp ? <Flame size={18} /> : <Zap size={18} />}
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>
                        {isPushUp ? 'Push-Up Session' : 'Skipping Session'}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        {formatTime(session.active_duration_seconds)} • {Math.round(session.average_jumps_per_minute)} {paceUnit}
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
    </div>
  );
};
