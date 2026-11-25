import React, { useEffect, useMemo, useState } from 'react';
import { WorkoutSessionData } from '../types/workout';
import { WorkoutService } from '../workout/workoutService';
import { DeleteModal } from '../components/DeleteModal';
import { estimateSessionCalories } from '../utils/motivationEngine';
import {
  ArrowLeft,
  Trash2,
  Calendar,
  Clock,
  Gauge,
  Activity,
  Zap,
  Flame,
  Trophy,
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

  // Identify Personal Best records across all workouts
  const personalBests = useMemo(() => {
    let maxSkipping = 0;
    let maxPushUp = 0;
    for (const w of workouts) {
      if (w.exercise_type === 'push_up') {
        const reps = w.completed_reps ?? w.total_jumps ?? 0;
        if (reps > maxPushUp) maxPushUp = reps;
      } else {
        if ((w.total_jumps || 0) > maxSkipping) maxSkipping = w.total_jumps || 0;
      }
    }
    return { maxSkipping, maxPushUp };
  }, [workouts]);

  const filteredWorkouts = useMemo(
    () =>
      workouts.filter((w) => {
        if (filter === 'all') return true;
        if (filter === 'push_up') return w.exercise_type === 'push_up';
        if (filter === 'skipping') return w.exercise_type !== 'push_up';
        return true;
      }),
    [workouts, filter]
  );

  // Filtered summary metrics
  const filteredTotals = useMemo(() => {
    let totalVolume = 0;
    let totalKcal = 0;
    let totalSec = 0;
    for (const w of filteredWorkouts) {
      const count =
        w.exercise_type === 'push_up'
          ? w.completed_reps ?? w.total_jumps ?? 0
          : w.total_jumps || 0;
      totalVolume += count;
      totalKcal += estimateSessionCalories(w);
      totalSec += w.active_duration_seconds || 0;
    }
    return {
      totalVolume,
      totalKcal: Math.round(totalKcal),
      totalSec,
    };
  }, [filteredWorkouts]);

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
          marginBottom: 18,
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
          marginBottom: 14,
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
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
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
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
          }}
        >
          <Flame size={14} />
          <span>Push-Ups</span>
        </button>
      </div>

      {/* Filtered Totals Banner */}
      {filteredWorkouts.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 8,
            backgroundColor: '#12161A',
            border: '1px solid #232930',
            borderRadius: 16,
            padding: '12px 14px',
            marginBottom: 18,
            textAlign: 'center',
          }}
        >
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#929BA3', textTransform: 'uppercase' }}>
              {filter === 'push_up' ? 'Total Reps' : filter === 'skipping' ? 'Total Jumps' : 'Total Count'}
            </div>
            <div className="tabular-nums" style={{ fontSize: 18, fontWeight: 900, color: '#39E66B' }}>
              {filteredTotals.totalVolume.toLocaleString()}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#929BA3', textTransform: 'uppercase' }}>
              Active Time
            </div>
            <div className="tabular-nums" style={{ fontSize: 18, fontWeight: 900, color: '#FFFFFF' }}>
              {formatDuration(filteredTotals.totalSec)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#929BA3', textTransform: 'uppercase' }}>
              Est. Burn
            </div>
            <div className="tabular-nums" style={{ fontSize: 18, fontWeight: 900, color: '#FF9F0A' }}>
              {filteredTotals.totalKcal} kcal
            </div>
          </div>
        </div>
      )}

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
            const count = isPushUp
              ? session.completed_reps ?? session.total_jumps
              : session.total_jumps;
            const countLabel = isPushUp ? 'REPS' : 'JUMPS';
            const paceUnit = isPushUp ? 'RPM' : 'JPM';
            const badgeColor = isPushUp ? '#5E96FF' : '#39E66B';
            const kcal = Math.round(estimateSessionCalories(session));

            const isPersonalBest =
              count > 0 &&
              ((isPushUp && count === personalBests.maxPushUp) ||
                (!isPushUp && count === personalBests.maxSkipping));

            return (
              <div
                key={session.id}
                style={{
                  backgroundColor: '#12161A',
                  border: isPersonalBest
                    ? '1px solid rgba(245, 185, 66, 0.45)'
                    : '1px solid var(--border-subtle)',
                  borderRadius: 20,
                  padding: '16px 18px',
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
                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 800,
                          backgroundColor: isPushUp
                            ? 'rgba(94, 150, 255, 0.15)'
                            : 'rgba(57, 230, 107, 0.15)',
                          color: badgeColor,
                          padding: '2px 8px',
                          borderRadius: 10,
                          textTransform: 'uppercase',
                        }}
                      >
                        {isPushUp
                          ? session.workout_mode
                            ? `Push-Up (${session.workout_mode})`
                            : 'Push-Up'
                          : 'Skipping'}
                      </span>

                      {isPersonalBest && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 800,
                            backgroundColor: 'rgba(245, 185, 66, 0.18)',
                            color: '#F5B942',
                            padding: '2px 8px',
                            borderRadius: 10,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <Trophy size={10} />
                          PERSONAL BEST
                        </span>
                      )}

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: 12.5,
                          fontWeight: 700,
                          color: 'var(--text-primary)',
                        }}
                      >
                        <Calendar size={12} style={{ color: 'var(--text-muted)' }} />
                        <span>{session.session_date}</span>
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {new Date(session.end_time || session.start_time).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}{' '}
                      • ~{kcal} kcal burned
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
                    padding: '11px 14px',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>
                      {countLabel}
                    </div>
                    <div
                      className="tabular-nums"
                      style={{ fontSize: 20, fontWeight: 800, color: badgeColor }}
                    >
                      {count}
                    </div>
                  </div>

                  <div>
                    <div
                      style={{
                        fontSize: 10,
                        color: 'var(--text-muted)',
                        marginBottom: 2,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 3,
                      }}
                    >
                      <Clock size={11} />
                      <span>ACTIVE</span>
                    </div>
                    <div className="tabular-nums" style={{ fontSize: 15, fontWeight: 700 }}>
                      {formatDuration(session.active_duration_seconds)}
                    </div>
                  </div>

                  <div>
                    <div
                      style={{
                        fontSize: 10,
                        color: 'var(--text-muted)',
                        marginBottom: 2,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 3,
                      }}
                    >
                      <Gauge size={11} />
                      <span>PACE</span>
                    </div>
                    <div className="tabular-nums" style={{ fontSize: 15, fontWeight: 700 }}>
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
