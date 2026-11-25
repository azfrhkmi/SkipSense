import React, { useState } from 'react';
import { DailyGoals } from '../utils/motivationEngine';
import { X, Check, Target, Zap, Flame, Clock } from 'lucide-react';

interface DailyGoalModalProps {
  currentGoals: DailyGoals;
  onSave: (goals: DailyGoals) => void;
  onClose: () => void;
}

export const DailyGoalModal: React.FC<DailyGoalModalProps> = ({
  currentGoals,
  onSave,
  onClose,
}) => {
  const [jumps, setJumps] = useState(currentGoals.dailyJumps);
  const [pushUps, setPushUps] = useState(currentGoals.dailyPushUps);
  const [minutes, setMinutes] = useState(currentGoals.dailyActiveMinutes);

  const handleSave = () => {
    onSave({
      dailyJumps: jumps,
      dailyPushUps: pushUps,
      dailyActiveMinutes: minutes,
    });
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        className="animate-pop"
        style={{
          backgroundColor: '#12161A',
          border: '1px solid #232930',
          borderRadius: 24,
          maxWidth: 440,
          width: '100%',
          padding: 24,
          boxShadow: '0 24px 60px rgba(0,0,0,0.65)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 18,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: 'rgba(57, 230, 107, 0.15)',
                color: '#39E66B',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Target size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: '#FFFFFF' }}>
                Customize Daily Rings
              </h2>
              <p style={{ fontSize: 12, color: '#929BA3' }}>
                Set targets that stretch and motivate you daily.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              width: 34,
              height: 34,
              borderRadius: '50%',
              backgroundColor: '#1A2026',
              color: '#929BA3',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Skipping Target */}
        <div
          style={{
            backgroundColor: '#181D22',
            borderRadius: 16,
            padding: 14,
            marginBottom: 12,
            border: '1px solid rgba(57, 230, 107, 0.2)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#39E66B', fontWeight: 700, fontSize: 13 }}>
              <Zap size={15} />
              <span>Daily Skipping Jumps</span>
            </div>
            <span className="tabular-nums" style={{ fontSize: 18, fontWeight: 900, color: '#FFFFFF' }}>
              {jumps}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[100, 200, 350, 500].map((val) => (
              <button
                key={val}
                onClick={() => setJumps(val)}
                style={{
                  flex: 1,
                  padding: '8px 0',
                  borderRadius: 10,
                  fontSize: 12,
                  fontWeight: 700,
                  backgroundColor: jumps === val ? '#39E66B' : '#232930',
                  color: jumps === val ? '#090B0D' : '#CBD5E1',
                }}
              >
                {val}
              </button>
            ))}
          </div>
        </div>

        {/* Push-Ups Target */}
        <div
          style={{
            backgroundColor: '#181D22',
            borderRadius: 16,
            padding: 14,
            marginBottom: 12,
            border: '1px solid rgba(94, 150, 255, 0.2)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#5E96FF', fontWeight: 700, fontSize: 13 }}>
              <Flame size={15} />
              <span>Daily Push-Up Reps</span>
            </div>
            <span className="tabular-nums" style={{ fontSize: 18, fontWeight: 900, color: '#FFFFFF' }}>
              {pushUps}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[15, 30, 50, 100].map((val) => (
              <button
                key={val}
                onClick={() => setPushUps(val)}
                style={{
                  flex: 1,
                  padding: '8px 0',
                  borderRadius: 10,
                  fontSize: 12,
                  fontWeight: 700,
                  backgroundColor: pushUps === val ? '#5E96FF' : '#232930',
                  color: pushUps === val ? '#090B0D' : '#CBD5E1',
                }}
              >
                {val}
              </button>
            ))}
          </div>
        </div>

        {/* Active Minutes Target */}
        <div
          style={{
            backgroundColor: '#181D22',
            borderRadius: 16,
            padding: 14,
            marginBottom: 20,
            border: '1px solid rgba(255, 159, 10, 0.2)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#FF9F0A', fontWeight: 700, fontSize: 13 }}>
              <Clock size={15} />
              <span>Daily Active Time (min)</span>
            </div>
            <span className="tabular-nums" style={{ fontSize: 18, fontWeight: 900, color: '#FFFFFF' }}>
              {minutes}m
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[5, 10, 15, 25].map((val) => (
              <button
                key={val}
                onClick={() => setMinutes(val)}
                style={{
                  flex: 1,
                  padding: '8px 0',
                  borderRadius: 10,
                  fontSize: 12,
                  fontWeight: 700,
                  backgroundColor: minutes === val ? '#FF9F0A' : '#232930',
                  color: minutes === val ? '#090B0D' : '#CBD5E1',
                }}
              >
                {val}m
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleSave}
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
            boxShadow: '0 4px 20px rgba(57, 230, 107, 0.3)',
          }}
        >
          <Check size={18} strokeWidth={2.8} />
          <span>Save Daily Targets</span>
        </button>
      </div>
    </div>
  );
};

