import React, { useEffect, useState } from 'react';
import { WorkoutSessionData } from '../types/workout';
import { WorkoutService } from '../workout/workoutService';
import { DeleteModal } from '../components/DeleteModal';
import {
  ArrowLeft,
  Trash2,
  Calendar,
  Clock,
  Gauge,
  Activity,
  Zap,
  Flame,
} from 'lucide-react';

interface HistoryPageProps {
  onBack: () => void;
}

type FilterType = 'all' | 'skipping' | 'push_up';

export const HistoryPage: React.FC<HistoryPageProps> = ({ onBack }) => {
  const [workouts, setWorkouts] = useState<WorkoutSessionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const data = await WorkoutService.getWorkouts();
      setWorkouts(data);
    } catch (err) {
      console.error('Failed to load workout history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleDeleteConfirm = async () => {
    if (deleteTargetId === null) return;
    try {
      await WorkoutService.deleteWorkout(deleteTargetId);
      setWorkouts((prev) => prev.filter((w) => w.id !== deleteTargetId));
    } catch (err) {
      console.error('Failed to delete workout:', err);
    } finally {
      setDeleteTargetId(null);
    }
  };

  const formatDuration = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = Math.floor(totalSec % 60);
    return `${mins}m ${secs.toString().padStart(2, '0')}s`;
  };

  const filteredWorkouts = workouts.filter((w) => {
    if (filter === 'all') return true;
    if (filter === 'push_up') return w.exercise_type === 'push_up';
    if (filter === 'skipping') return w.exercise_type !== 'push_up';
    return true;
  });

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--text-primary)',
        padding: '20px 20px 40px 20px',
        maxWidth: 600,
        margin: '0 auto',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 20,
        }}
      >
        <button
          onClick={onBack}
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            backgroundColor: 'var(--bg-card)',
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid var(--border-subtle)',
            cursor: 'pointer',
          }}
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800 }}>Workout History</h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {filteredWorkouts.length} recorded {filteredWorkouts.length === 1 ? 'session' : 'sessions'}
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          backgroundColor: '#12161A',
          padding: 4,
          borderRadius: 14,
          marginBottom: 20,
          border: '1px solid #232930',
        }}
      >
        <button
          onClick={() => setFilter('all')}
          style={{
            padding: '8px 12px',
            borderRadius: 10,
            backgroundColor: filter === 'all' ? '#232930' : 'transparent',
            color: filter === 'all' ? '#FFFFFF' : '#8E9AA8',
            fontSize: 13,
            fontWeight: 700,
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          All
        </button>
        <button
          onClick={() => setFilter('skipping')}
          style={{
            padding: '8px 12px',
            borderRadius: 10,
            backgroundColor: filter === 'skipping' ? '#232930' : 'transparent',
            color: filter === 'skipping' ? '#39E66B' : '#8E9AA8',
            fontSize: 13,
            fontWeight: 700,
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            transition: 'all 0.15s ease',
          }}
        >
          <Zap size={14} />
          <span>Skipping</span>
        </button>
        <button
          onClick={() => setFilter('push_up')}
          style={{
            padding: '8px 12px',
            borderRadius: 10,
            backgroundColor: filter === 'push_up' ? '#232930' : 'transparent',
            color: filter === 'push_up' ? '#5E96FF' : '#8E9AA8',
            fontSize: 13,
            fontWeight: 700,
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            transition: 'all 0.15s ease',
          }}
        >
          <Flame size={14} />
          <span>Push-Ups</span>
        </button>
      </div>

      {/* List of Sessions */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>
          Loading your workout history...
        </div>
      ) : filteredWorkouts.length === 0 ? (
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 20,
            padding: '48px 20px',
            textAlign: 'center',
            color: 'var(--text-secondary)',
          }}
        >
          <Activity size={40} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
            No Workouts Found
          </h3>
          <p style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--text-muted)', maxWidth: 280, margin: '0 auto' }}>
            Complete a workout to track your reps, cadence, and performance over time.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filteredWorkouts.map((session) => {
            const isPushUp = session.exercise_type === 'push_up';
            const count = isPushUp ? (session.completed_reps ?? session.total_jumps) : session.total_jumps;
            const countLabel = isPushUp ? 'REPS' : 'JUMPS';
            const paceUnit = isPushUp ? 'RPM' : 'JPM';
            const badgeColor = isPushUp ? '#5E96FF' : '#39E66B';

            return (
              <div
                key={session.id}
                style={{
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 20,
                  padding: '18px 20px',
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: 12,
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 800,
                          backgroundColor: isPushUp ? 'rgba(94, 150, 255, 0.15)' : 'rgba(57, 230, 107, 0.15)',
                          color: badgeColor,
                          padding: '2px 8px',
                          borderRadius: 10,
                          textTransform: 'uppercase',
                        }}
                      >
                        {isPushUp ? (session.workout_mode ? `Push-Up (${session.workout_mode})` : 'Push-Up') : 'Skipping'}
                      </span>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: 13,
                          fontWeight: 700,
                          color: 'var(--text-primary)',
                        }}
                      >
                        <Calendar size={13} style={{ color: 'var(--text-muted)' }} />
                        <span>{session.session_date}</span>
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {new Date(session.end_time || session.start_time).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>

                  {/* Delete Button */}
                  <button
                    onClick={() => setDeleteTargetId(session.id!)}
                    style={{
                      backgroundColor: 'transparent',
                      color: 'var(--text-muted)',
                      padding: 6,
                      borderRadius: 8,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                    title="Delete workout"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                {/* Stats Row */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 8,
                    backgroundColor: 'var(--bg-secondary)',
                    borderRadius: 14,
                    padding: '12px 14px',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>{countLabel}</div>
                    <div
                      className="tabular-nums"
                      style={{ fontSize: 20, fontWeight: 800, color: badgeColor }}
                    >
                      {count}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Clock size={11} />
                      <span>ACTIVE</span>
                    </div>
                    <div className="tabular-nums" style={{ fontSize: 16, fontWeight: 700 }}>
                      {formatDuration(session.active_duration_seconds)}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Gauge size={11} />
                      <span>PACE</span>
                    </div>
                    <div className="tabular-nums" style={{ fontSize: 16, fontWeight: 700 }}>
                      {Math.round(session.average_jumps_per_minute)}{' '}
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{paceUnit}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <DeleteModal
        isOpen={deleteTargetId !== null}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTargetId(null)}
      />
    </div>
  );
};
