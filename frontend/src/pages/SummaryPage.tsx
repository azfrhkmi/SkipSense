import React, { useEffect, useState } from 'react';
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
  Save,
  Home,
  History,
  Flame,
  Clock,
  Gauge,
  ArrowRight,
  Trophy,
  Sparkles,
  RotateCcw,
} from 'lucide-react';

interface SummaryPageProps {
  session: WorkoutSessionData;
  onGoHome: () => void;
  onWorkoutAgain: () => void;
  onViewHistory: () => void;
}

export const SummaryPage: React.FC<SummaryPageProps> = ({
  session,
  onGoHome,
  onWorkoutAgain,
  onViewHistory,
}) => {
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [previousWorkouts, setPreviousWorkouts] = useState<WorkoutSessionData[]>([]);
  const [highlights, setHighlights] = useState<SessionHighlight>(() =>
    evaluateSessionHighlights(session, [])
  );

  useEffect(() => {
    async function loadHighlights() {
      try {
        const history = await WorkoutService.getWorkouts();
        setPreviousWorkouts(history);
        setHighlights(evaluateSessionHighlights(session, history));
      } catch {
        setHighlights(evaluateSessionHighlights(session, []));
      }
    }
    loadHighlights();
  }, [session]);

  const profileAfterSession = buildMotivationProfile(
    isSaved ? previousWorkouts : [session, ...previousWorkouts],
    loadDailyGoals()
  );

  const formatDuration = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = Math.floor(totalSec % 60);
    return `${mins}m ${secs.toString().padStart(2, '0')}s`;
  };

  const handleSave = async () => {
    if (isSaved || isSaving) return;
    setIsSaving(true);
    try {
      const saved = await WorkoutService.saveWorkout(session);
      setPreviousWorkouts((prev) => [saved, ...prev]);
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
      <ConfettiBurst active={session.total_jumps > 0} durationMs={2800} />

      {/* Header celebration badge */}
      <div style={{ textAlign: 'center', marginTop: 8, marginBottom: 20 }}>
        <div
          className="animate-pop"
          style={{
            width: 62,
            height: 62,
            borderRadius: '50%',
            backgroundColor: 'var(--accent-green-dim)',
            color: 'var(--accent-green)',
            border: '2px solid rgba(57, 230, 107, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 12px auto',
            boxShadow: '0 0 24px rgba(57, 230, 107, 0.35)',
          }}
        >
          <CheckCircle2 size={34} />
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: -0.5, marginBottom: 4 }}>
          Workout Complete!
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10 }}>
          {highlights.encouragementQuote}
        </p>

        {/* Personal Record Pill */}
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
              boxShadow: '0 0 18px rgba(245, 185, 66, 0.25)',
            }}
          >
            <Trophy size={14} />
            <span>
              {highlights.isNewBestCount ? 'NEW PERSONAL BEST COUNT!' : 'NEW FASTEST PACE RECORD!'}
            </span>
          </div>
        )}
      </div>

      {/* Main Total Jumps Hero Banner */}
      <div
        style={{
          background: 'linear-gradient(155deg, #16221B 0%, #12161A 75%)',
          border: '1px solid rgba(57, 230, 107, 0.35)',
          borderRadius: 24,
          padding: 22,
          textAlign: 'center',
          marginBottom: 16,
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.45)',
        }}
      >
        <div
          style={{
            display: 'inline-block',
            fontSize: 11,
            fontWeight: 800,
            color: highlights.intensityColor,
            backgroundColor: `${highlights.intensityColor}20`,
            padding: '3px 10px',
            borderRadius: 12,
            letterSpacing: 0.8,
            textTransform: 'uppercase',
            marginBottom: 8,
          }}
        >
          {highlights.intensityLabel}
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
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>
          Total Completed Jumps • Est. {highlights.caloriesBurned} kcal
        </div>
      </div>

      {/* XP Earned & Athlete Rank Strip */}
      <div
        style={{
          backgroundColor: '#12161A',
          border: `1px solid ${profileAfterSession.rank.color}44`,
          borderRadius: 18,
          padding: '14px 16px',
          marginBottom: 16,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 800 }}>
            <Sparkles size={15} color={profileAfterSession.rank.color} />
            <span>
              Lv.{profileAfterSession.rank.level} {profileAfterSession.rank.title}
            </span>
          </div>
          <span className="tabular-nums" style={{ fontSize: 14, fontWeight: 900, color: '#39E66B' }}>
            +{highlights.xpEarned} XP Earned
          </span>
        </div>
        <div style={{ height: 6, backgroundColor: '#1E252C', borderRadius: 3, overflow: 'hidden' }}>
          <div
            style={{
              width: `${profileAfterSession.levelProgressPct}%`,
              height: '100%',
              backgroundColor: profileAfterSession.rank.color,
              borderRadius: 3,
              transition: 'width 0.7s ease-out',
            }}
          />
        </div>
      </div>

      {/* Metrics 2x2 Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 12,
          marginBottom: 22,
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
          <div className="tabular-nums" style={{ fontSize: 22, fontWeight: 800 }}>
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
          <div className="tabular-nums" style={{ fontSize: 22, fontWeight: 800 }}>
            {Math.round(session.average_jumps_per_minute)}{' '}
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>JPM</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            Peak: {session.max_jumps_per_minute} JPM
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
            <Flame size={16} color="#FF9F0A" />
            <span>CALORIES BURN</span>
          </div>
          <div className="tabular-nums" style={{ fontSize: 22, fontWeight: 800, color: '#FF9F0A' }}>
            {highlights.caloriesBurned}{' '}
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>kcal</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            Total: {formatDuration(session.total_duration_seconds)}
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
            <Trophy size={16} color="var(--accent-green)" />
            <span>STREAK STATUS</span>
          </div>
          <div className="tabular-nums" style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent-green)' }}>
            {profileAfterSession.currentStreak} Day{profileAfterSession.currentStreak === 1 ? '' : 's'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            {profileAfterSession.ringsClosedToday}/3 rings closed today
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
            <span>{isSaving ? 'SAVING TO DATABASE...' : 'SAVE WORKOUT & CLAIM XP'}</span>
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

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <button
            onClick={onWorkoutAgain}
            style={{
              backgroundColor: 'var(--bg-card)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 14,
              padding: '14px 16px',
              fontWeight: 700,
              fontSize: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <RotateCcw size={16} />
            <span>SKIP AGAIN</span>
          </button>

          <button
            onClick={onGoHome}
            style={{
              backgroundColor: 'var(--bg-card)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 14,
              padding: '14px 16px',
              fontWeight: 700,
              fontSize: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <Home size={16} />
            <span>DASHBOARD</span>
          </button>
        </div>

        <button
          onClick={onViewHistory}
          style={{
            backgroundColor: 'transparent',
            color: 'var(--text-secondary)',
            borderRadius: 16,
            padding: '10px 20px',
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
