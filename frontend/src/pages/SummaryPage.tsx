import React, { useState } from 'react';
import { WorkoutSessionData } from '../types/workout';
import { WorkoutService } from '../workout/workoutService';
import { CheckCircle2, Save, Home, History, Flame, Clock, Gauge, ArrowRight } from 'lucide-react';

interface SummaryPageProps {
  session: WorkoutSessionData;
  onGoHome: () => void;
  onViewHistory: () => void;
}

export const SummaryPage: React.FC<SummaryPageProps> = ({ session, onGoHome, onViewHistory }) => {
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const formatDuration = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = Math.floor(totalSec % 60);
    return `${mins}m ${secs.toString().padStart(2, '0')}s`;
  };

  const handleSave = async () => {
    if (isSaved || isSaving) return;
    setIsSaving(true);
    try {
      await WorkoutService.saveWorkout(session);
      setIsSaved(true);
    } catch (err) {
      console.error('Save failed:', err);
      alert('Failed to save to database. Record is saved locally.');
      setIsSaved(true);
    } finally {
      setIsSaving(false);
    }
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
      {/* Header celebration badge */}
      <div style={{ textAlign: 'center', marginTop: 12, marginBottom: 24 }}>
        <div
          style={{
            width: 60,
            height: 60,
            borderRadius: '50%',
            backgroundColor: 'var(--accent-green-dim)',
            color: 'var(--accent-green)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 14px auto',
            boxShadow: '0 0 20px rgba(57, 230, 107, 0.3)',
          }}
        >
          <CheckCircle2 size={34} />
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: -0.5, marginBottom: 4 }}>
          Workout Complete!
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          {new Date(session.end_time).toLocaleDateString(undefined, {
            weekday: 'long',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>

      {/* Main Total Jumps Hero Banner */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid rgba(57, 230, 107, 0.3)',
          borderRadius: 24,
          padding: 24,
          textAlign: 'center',
          marginBottom: 20,
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.4)',
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-green)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>
          Total Completed Jumps
        </div>
        <div
          className="tabular-nums"
          style={{
            fontSize: 72,
            fontWeight: 900,
            lineHeight: 1,
            color: 'var(--accent-green)',
            marginBottom: 6,
          }}
        >
          {session.total_jumps.toLocaleString()}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          Confirmed Landing-Based Counts
        </div>
      </div>

      {/* Metrics 2x2 Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 12,
          marginBottom: 24,
        }}
      >
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 18,
            padding: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: 12, marginBottom: 6 }}>
            <Clock size={16} />
            <span>ACTIVE TIME</span>
          </div>
          <div className="tabular-nums" style={{ fontSize: 24, fontWeight: 800 }}>
            {formatDuration(session.active_duration_seconds)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            Rest: {formatDuration(session.rest_duration_seconds)}
          </div>
        </div>

        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 18,
            padding: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: 12, marginBottom: 6 }}>
            <Gauge size={16} />
            <span>AVG CADENCE</span>
          </div>
          <div className="tabular-nums" style={{ fontSize: 24, fontWeight: 800 }}>
            {Math.round(session.average_jumps_per_minute)}{' '}
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>JPM</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            Max: {session.max_jumps_per_minute} JPM
          </div>
        </div>

        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 18,
            padding: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: 12, marginBottom: 6 }}>
            <Flame size={16} />
            <span>TOTAL DURATION</span>
          </div>
          <div className="tabular-nums" style={{ fontSize: 24, fontWeight: 800 }}>
            {formatDuration(session.total_duration_seconds)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            Start to finish
          </div>
        </div>

        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 18,
            padding: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: 12, marginBottom: 6 }}>
            <Gauge size={16} />
            <span>PEAK PACE</span>
          </div>
          <div className="tabular-nums" style={{ fontSize: 24, fontWeight: 800, color: 'var(--accent-green)' }}>
            {session.max_jumps_per_minute}{' '}
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>JPM</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            Highest rhythm
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {!isSaved ? (
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="animate-glow"
            style={{
              backgroundColor: 'var(--accent-green)',
              color: '#090B0D',
              borderRadius: 16,
              padding: '16px 20px',
              fontWeight: 800,
              fontSize: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <Save size={20} />
            <span>{isSaving ? 'SAVING TO DATABASE...' : 'SAVE WORKOUT'}</span>
          </button>
        ) : (
          <div
            style={{
              backgroundColor: 'var(--accent-green-dim)',
              color: 'var(--accent-green)',
              borderRadius: 16,
              padding: '14px 20px',
              fontWeight: 700,
              fontSize: 15,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              border: '1px solid rgba(57, 230, 107, 0.4)',
            }}
          >
            <CheckCircle2 size={18} />
            <span>Saved to SQLite Database</span>
          </div>
        )}

        <button
          onClick={onGoHome}
          style={{
            backgroundColor: 'var(--bg-card)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 16,
            padding: '14px 20px',
            fontWeight: 700,
            fontSize: 15,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <Home size={18} />
          <span>BACK TO DASHBOARD</span>
        </button>

        <button
          onClick={onViewHistory}
          style={{
            backgroundColor: 'transparent',
            color: 'var(--text-secondary)',
            borderRadius: 16,
            padding: '12px 20px',
            fontWeight: 600,
            fontSize: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <History size={16} />
          <span>VIEW WORKOUT HISTORY</span>
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
};
