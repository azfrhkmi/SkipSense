import React, { useState } from 'react';
import { DayActivity } from '../utils/motivationEngine';

interface WeeklyActivityChartProps {
  days: DayActivity[];
}

export const WeeklyActivityChart: React.FC<WeeklyActivityChartProps> = ({ days }) => {
  const [selectedIndex, setSelectedIndex] = useState<number>(days.length - 1);

  const maxScore = Math.max(100, ...days.map((d) => d.score));
  const selectedDay = days[selectedIndex] || days[days.length - 1];
  const activeDaysCount = days.filter((d) => d.sessionsCount > 0).length;

  return (
    <div
      style={{
        backgroundColor: '#12161A',
        border: '1px solid #232930',
        borderRadius: 20,
        padding: '18px 18px 16px 18px',
        marginBottom: 22,
      }}
    >
      {/* Header Row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 14,
        }}
      >
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#FFFFFF' }}>
            7-Day Consistency
          </div>
          <div style={{ fontSize: 12, color: '#929BA3' }}>
            Active {activeDaysCount} of last 7 days
          </div>
        </div>

        {/* Selected day readout pill */}
        {selectedDay && (
          <div
            style={{
              backgroundColor: '#1B2026',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 12,
              padding: '6px 10px',
              textAlign: 'right',
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 700, color: '#39E66B', textTransform: 'uppercase' }}>
              {selectedDay.dayLabel}
            </div>
            <div className="tabular-nums" style={{ fontSize: 12, fontWeight: 700, color: '#FFFFFF' }}>
              {selectedDay.jumps} jumps • {selectedDay.pushUps} push-ups
            </div>
          </div>
        )}
      </div>

      {/* 7 Interactive Bars */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 8,
          alignItems: 'end',
          height: 92,
          paddingTop: 8,
        }}
      >
        {days.map((day, idx) => {
          const isSelected = idx === selectedIndex;
          const hasActivity = day.score > 0;
          const heightPct = hasActivity ? Math.max(18, Math.round((day.score / maxScore) * 100)) : 8;

          let barBackground = '#232930';
          if (hasActivity) {
            if (day.pushUps > 0 && day.jumps > 0) {
              barBackground = 'linear-gradient(180deg, #39E66B 0%, #5E96FF 100%)';
            } else if (day.pushUps > 0) {
              barBackground = 'linear-gradient(180deg, #74A8FF 0%, #5E96FF 100%)';
            } else {
              barBackground = 'linear-gradient(180deg, #5CF288 0%, #39E66B 100%)';
            }
          }

          return (
            <button
              key={day.dateStr}
              onClick={() => setSelectedIndex(idx)}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
                height: '100%',
                justifyContent: 'flex-end',
                cursor: 'pointer',
              }}
            >
              <div
                style={{
                  width: '100%',
                  maxWidth: 26,
                  height: `${heightPct}%`,
                  borderRadius: '8px 8px 4px 4px',
                  background: barBackground,
                  opacity: isSelected || hasActivity ? 1 : 0.45,
                  boxShadow:
                    hasActivity && isSelected
                      ? '0 0 14px rgba(57, 230, 107, 0.45)'
                      : 'none',
                  border: isSelected ? '1px solid rgba(255,255,255,0.45)' : '1px solid transparent',
                  transition: 'height 0.45s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.15s ease',
                }}
              />
              <span
                style={{
                  fontSize: 10,
                  fontWeight: day.isToday || isSelected ? 800 : 600,
                  color: day.isToday ? '#39E66B' : isSelected ? '#FFFFFF' : '#5E676F',
                }}
              >
                {day.dayLabel}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

