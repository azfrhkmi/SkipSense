import React, { useState } from 'react';
import { PushUpMode } from '../exercises/pushup/pushUpTypes';
import { Target, Zap, Flame, Infinity as InfinityIcon, ArrowRight, X } from 'lucide-react';

interface PushUpModeSelectorProps {
  onSelectMode: (mode: PushUpMode) => void;
  onCancel: () => void;
}

interface ModeOption {
  id: PushUpMode;
  title: string;
  repsText: string;
  description: string;
  icon: React.ReactNode;
  badge?: string;
}

export const PushUpModeSelector: React.FC<PushUpModeSelectorProps> = ({
  onSelectMode,
  onCancel,
}) => {
  const [selectedMode, setSelectedMode] = useState<PushUpMode>('10');

  const options: ModeOption[] = [
    {
      id: '10',
      title: 'Beginner',
      repsText: '10 Reps',
      description: 'Auto-stops at 10 reps with victory fanfare. Ideal for beginners and warmups.',
      icon: <Target size={22} className="text-[#39E66B]" />,
      badge: 'Popular',
    },
    {
      id: '20',
      title: 'Intermediate',
      repsText: '20 Reps',
      description: 'Auto-stops at 20 reps. Solid strength & chest endurance challenge.',
      icon: <Zap size={22} className="text-[#39E66B]" />,
    },
    {
      id: '30',
      title: 'Advanced',
      repsText: '30 Reps',
      description: 'Auto-stops at 30 reps. High-intensity workout for experienced athletes.',
      icon: <Flame size={22} className="text-[#39E66B]" />,
      badge: 'Challenging',
    },
    {
      id: 'freedom',
      title: 'Freedom Mode',
      repsText: 'Unlimited',
      description: 'No rep ceiling. Count indefinitely (1, 10, 50, 100+) until you press Stop.',
      icon: <InfinityIcon size={22} className="text-[#39E66B]" />,
    },
  ];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        style={{
          backgroundColor: '#12161A',
          border: '1px solid #232930',
          borderRadius: 24,
          maxWidth: 480,
          width: '100%',
          padding: 24,
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 20,
          }}
        >
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: '#FFFFFF', marginBottom: 4 }}>
              Push-Up Target Mode
            </h2>
            <p style={{ fontSize: 13, color: '#8E9AA8' }}>
              Choose your workout goal before placing the phone.
            </p>
          </div>
          <button
            onClick={onCancel}
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              backgroundColor: '#1A2026',
              border: '1px solid #2B333D',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#8E9AA8',
              cursor: 'pointer',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Options */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
          {options.map((opt) => {
            const isSelected = selectedMode === opt.id;
            return (
              <div
                key={opt.id}
                onClick={() => setSelectedMode(opt.id)}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 14,
                  padding: '14px 16px',
                  borderRadius: 16,
                  backgroundColor: isSelected ? 'rgba(57, 230, 107, 0.08)' : '#181E24',
                  border: isSelected ? '2px solid #39E66B' : '1px solid #232930',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    backgroundColor: isSelected ? 'rgba(57, 230, 107, 0.15)' : '#232930',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {opt.icon}
                </div>

                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 2,
                    }}
                  >
                    <span style={{ fontSize: 16, fontWeight: 700, color: '#FFFFFF' }}>
                      {opt.title}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {opt.badge && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            backgroundColor: 'rgba(57, 230, 107, 0.2)',
                            color: '#39E66B',
                            padding: '2px 8px',
                            borderRadius: 10,
                            textTransform: 'uppercase',
                          }}
                        >
                          {opt.badge}
                        </span>
                      )}
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: 800,
                          color: isSelected ? '#39E66B' : '#8E9AA8',
                        }}
                      >
                        {opt.repsText}
                      </span>
                    </div>
                  </div>
                  <p style={{ fontSize: 12, color: '#8E9AA8', lineHeight: 1.4 }}>
                    {opt.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Button */}
        <button
          onClick={() => onSelectMode(selectedMode)}
          style={{
            width: '100%',
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
          <span>Continue with {selectedMode === 'freedom' ? 'Freedom Mode' : `${selectedMode} Reps`}</span>
          <ArrowRight size={18} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
};
