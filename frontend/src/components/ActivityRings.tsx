import React from 'react';

interface ActivityRingsProps {
  jumpsPct: number;
  pushUpsPct: number;
  activeMinPct: number;
  size?: number;
  ringsClosed?: number;
}

/**
 * Apple Fitness-inspired concentric animated SVG activity rings.
 * Outer: Skipping (Neon Green) | Middle: Push-Ups (Electric Blue) | Inner: Active Minutes (Solar Amber)
 */
export const ActivityRings: React.FC<ActivityRingsProps> = ({
  jumpsPct,
  pushUpsPct,
  activeMinPct,
  size = 132,
  ringsClosed = 0,
}) => {
  const center = size / 2;
  const strokeWidth = Math.max(9, Math.round(size * 0.085));
  const gap = strokeWidth + 3;

  const r1 = center - strokeWidth / 2 - 2; // Outer: Jumps
  const r2 = r1 - gap;                     // Middle: Push-Ups
  const r3 = r2 - gap;                     // Inner: Active Time

  const renderRing = (radius: number, pct: number, color: string, trackColor: string) => {
    const circumference = 2 * Math.PI * radius;
    const clampedPct = Math.max(0, Math.min(100, pct));
    // Minimum sliver so 0% still shows an inviting start dot, 100% closes seamlessly
    const visualPct = clampedPct === 0 ? 0 : Math.max(4, clampedPct);
    const dashOffset = circumference - (visualPct / 100) * circumference;

    return (
      <g>
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
        />
        {clampedPct > 0 && (
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{
              transition: 'stroke-dashoffset 0.8s cubic-bezier(0.22, 1, 0.36, 1)',
              filter: `drop-shadow(0 0 6px ${color}66)`,
            }}
          />
        )}
      </g>
    );
  };

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ transform: 'rotate(-90deg)' }}
      >
        {renderRing(r1, jumpsPct, '#39E66B', 'rgba(57, 230, 107, 0.14)')}
        {renderRing(r2, pushUpsPct, '#5E96FF', 'rgba(94, 150, 255, 0.14)')}
        {renderRing(r3, activeMinPct, '#FF9F0A', 'rgba(255, 159, 10, 0.14)')}
      </svg>

      {/* Center summary readout */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}
      >
        <span
          className="tabular-nums"
          style={{
            fontSize: Math.round(size * 0.17),
            fontWeight: 900,
            lineHeight: 1,
            color: ringsClosed === 3 ? '#39E66B' : '#FFFFFF',
          }}
        >
          {ringsClosed}/3
        </span>
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            color: '#929BA3',
            letterSpacing: 0.6,
            textTransform: 'uppercase',
            marginTop: 2,
          }}
        >
          Rings
        </span>
      </div>
    </div>
  );
};

