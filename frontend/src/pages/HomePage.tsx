import React, { useEffect, useState } from 'react';
import { LifetimeStats, WorkoutSessionData } from '../types/workout';
import { WorkoutService } from '../workout/workoutService';
import { Zap, Play, History, Trophy, Clock, Flame, ChevronRight } from 'lucide-react';

interface HomePageProps {
  onStartWorkout: () => void;
  onViewHistory: () => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onStartWorkout, onViewHistory }) => {
  const [stats, setStats] = useState<LifetimeStats>({
    total_lifetime_jumps: 0,
    total_sessions: 0,
    total_active_duration_seconds: 0,
    best_record_jumps: 0,
    best_record_pace: 0,
  });
  const [recentWorkouts, setRecentWorkouts] = useState<WorkoutSessionData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [statsData, workoutsData] = await Promise.all([
          WorkoutService.getStats(),
          WorkoutService.getWorkouts(),
        ]);
        setStats(statsData);
        setRecentWorkouts(workoutsData.slice(0, 3));
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
          marginBottom: 28,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: 'var(--accent-green)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#090B0D',
              }}
            >
              <Zap size={20} strokeWidth={2.8} />
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5 }}>SkipSense</h1>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>AI-Powered Skipping Counter</p>
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
          }}
        >
          <History size={16} />
          <span>History</span>
        </button>
      </header>

      {/* Hero Lifetime Stat Card */}
      <div
        style={{
          background: 'linear-gradient(145deg, #18221D 0%, #14181B 100%)',
          border: '1px solid rgba(57, 230, 107, 0.25)',
          borderRadius: 24,
          padding: 24,
          marginBottom: 24,
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 12px 30px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{ position: 'relative', zIndex: 2 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              color: 'var(--accent-green)',
              fontSize: 12,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: 0.8,
              marginBottom: 8,
            }}
          >
            <Flame size={16} />
            <span>Lifetime Performance</span>
          </div>

          <div
            className="tabular-nums"
            style={{
              fontSize: 52,
              fontWeight: 900,
              lineHeight: 1,
              letterSpacing: -1.5,
              color: 'var(--accent-green)',
              marginBottom: 6,
            }}
          >
            {loading ? '...' : stats.total_lifetime_jumps.toLocaleString()}
          </div>
          <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Total Completed Jumps</div>
        </div>

        {/* Decorative circle glow */}
        <div
          style={{
            position: 'absolute',
            top: -40,
            right: -40,
            width: 140,
            height: 140,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(57, 230, 107, 0.2) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />
      </div>

      {/* 3-Grid Stats */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 12,
          marginBottom: 28,
        }}
      >
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 18,
            padding: 16,
            textAlign: 'center',
          }}
        >
          <div style={{ color: 'var(--text-muted)', marginBottom: 6, display: 'flex', justifyContent: 'center' }}>
            <Flame size={18} />
          </div>
          <div className="tabular-nums" style={{ fontSize: 20, fontWeight: 700, marginBottom: 2 }}>
            {stats.total_sessions}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Workouts</div>
        </div>

        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 18,
            padding: 16,
            textAlign: 'center',
          }}
        >
          <div style={{ color: 'var(--text-muted)', marginBottom: 6, display: 'flex', justifyContent: 'center' }}>
            <Clock size={18} />
          </div>
          <div className="tabular-nums" style={{ fontSize: 20, fontWeight: 700, marginBottom: 2 }}>
            {formatTime(stats.total_active_duration_seconds)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Active Time</div>
        </div>

        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 18,
            padding: 16,
            textAlign: 'center',
          }}
        >
          <div style={{ color: 'var(--text-muted)', marginBottom: 6, display: 'flex', justifyContent: 'center' }}>
            <Trophy size={18} />
          </div>
          <div className="tabular-nums" style={{ fontSize: 20, fontWeight: 700, marginBottom: 2 }}>
            {stats.best_record_jumps}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Best Jumps</div>
        </div>
      </div>

      {/* Start Workout Primary Action Button */}
      <button
        onClick={onStartWorkout}
        className="animate-glow"
        style={{
          width: '100%',
          backgroundColor: 'var(--accent-green)',
          color: '#090B0D',
          borderRadius: 20,
          padding: '20px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          fontWeight: 800,
          fontSize: 18,
          letterSpacing: 0.2,
          marginBottom: 32,
          boxShadow: '0 8px 24px rgba(57, 230, 107, 0.35)',
        }}
      >
        <Play size={24} fill="#090B0D" />
        <span>START WORKOUT</span>
      </button>

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
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Recent Workouts</h2>
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
            <Zap size={32} style={{ color: 'var(--text-muted)', marginBottom: 8 }} />
            <p style={{ fontSize: 14, marginBottom: 4 }}>No workouts recorded yet.</p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Tap START WORKOUT above to begin your first AI skipping session.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {recentWorkouts.map((session) => (
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
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 3 }}>
                    {session.session_date}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {formatTime(session.active_duration_seconds)} active • {Math.round(session.average_jumps_per_minute)} JPM
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span
                    className="tabular-nums"
                    style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent-green)' }}
                  >
                    {session.total_jumps}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 4 }}>jumps</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

