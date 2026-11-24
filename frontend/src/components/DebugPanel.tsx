import React, { useState } from 'react';
import { JumpDebugInfo } from '../types/pose';
import { X, Activity, ArrowUp, ArrowDown, Minus, ChevronDown, ChevronUp, History } from 'lucide-react';

interface DebugPanelProps {
  debugInfo: JumpDebugInfo;
  onClose: () => void;
}

export const DebugPanel: React.FC<DebugPanelProps> = ({ debugInfo, onClose }) => {
  const [showTransitions, setShowTransitions] = useState(true);

  const getDirectionBadge = () => {
    switch (debugInfo.movementDirection) {
      case 'UP':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#39E66B', fontWeight: 800 }}>
            <ArrowUp size={14} /> UPWARD
          </span>
        );
      case 'DOWN':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#F5B942', fontWeight: 800 }}>
            <ArrowDown size={14} /> DOWNWARD
          </span>
        );
      case 'STABLE':
      default:
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#929BA3', fontWeight: 700 }}>
            <Minus size={14} /> STABLE
          </span>
        );
    }
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: 16,
        left: 12,
        right: 12,
        maxHeight: '88vh',
        overflowY: 'auto',
        zIndex: 50,
        backgroundColor: 'rgba(20, 24, 27, 0.96)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(57, 230, 107, 0.3)',
        borderRadius: 16,
        padding: 16,
        fontSize: 12,
        color: 'var(--text-secondary)',
        boxShadow: '0 12px 40px rgba(0,0,0,0.8)',
      }}
    >
      {/* Panel Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
          paddingBottom: 8,
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent-green)', fontWeight: 700 }}>
          <Activity size={18} />
          <span style={{ letterSpacing: 0.5 }}>AI JUMP ENGINE DEBUG v1.1</span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            padding: 4,
          }}
        >
          <X size={18} />
        </button>
      </div>

      {/* Primary Metrics Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '8px 12px',
          fontFamily: 'monospace',
          marginBottom: 12,
        }}
      >
        <div>
          <span style={{ color: 'var(--text-muted)' }}>State: </span>
          <span style={{ color: 'var(--accent-green)', fontWeight: 800 }}>{debugInfo.state}</span>
        </div>
        <div>
          <span style={{ color: 'var(--text-muted)' }}>Detected Jumps: </span>
          <span style={{ color: '#FFFFFF', fontWeight: 800 }}>{debugInfo.totalJumps}</span>
        </div>
        <div>
          <span style={{ color: 'var(--text-muted)' }}>Direction: </span>
          {getDirectionBadge()}
        </div>
        <div>
          <span style={{ color: 'var(--text-muted)' }}>FPS / Inferences: </span>
          <span style={{ color: 'var(--text-primary)' }}>
            {debugInfo.fps} / {debugInfo.inferenceFps}
          </span>
        </div>
        <div>
          <span style={{ color: 'var(--text-muted)' }}>Combined Disp: </span>
          <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>
            {debugInfo.displacementNorm.toFixed(3)}
          </span>
        </div>
        <div>
          <span style={{ color: 'var(--text-muted)' }}>Airborne Thresh: </span>
          <span style={{ color: 'var(--text-primary)' }}>{debugInfo.threshold.toFixed(3)}</span>
        </div>
        <div>
          <span style={{ color: 'var(--text-muted)' }}>Combined Velocity: </span>
          <span style={{ color: 'var(--text-primary)' }}>{debugInfo.velocity.toFixed(3)}</span>
        </div>
        <div>
          <span style={{ color: 'var(--text-muted)' }}>Hip/Ankle Vel: </span>
          <span style={{ color: 'var(--text-primary)' }}>
            {debugInfo.hipVelocity.toFixed(2)} / {debugInfo.ankleVelocity.toFixed(2)}
          </span>
        </div>
        <div>
          <span style={{ color: 'var(--text-muted)' }}>Dynamic Base Y: </span>
          <span style={{ color: 'var(--text-primary)' }}>
            {debugInfo.dynamicBaselineY.toFixed(3)}
          </span>
        </div>
        <div>
          <span style={{ color: 'var(--text-muted)' }}>Current Hip Y: </span>
          <span style={{ color: 'var(--text-primary)' }}>{debugInfo.hipY.toFixed(3)}</span>
        </div>
        <div>
          <span style={{ color: 'var(--text-muted)' }}>Confidence: </span>
          <span
            style={{
              color: debugInfo.landmarkConfidence > 0.5 ? 'var(--accent-green)' : 'var(--warning)',
            }}
          >
            {(debugInfo.landmarkConfidence * 100).toFixed(0)}%
          </span>
        </div>
        <div>
          <span style={{ color: 'var(--text-muted)' }}>Airborne Phase: </span>
          <span style={{ color: debugInfo.isAirborne ? 'var(--accent-green)' : 'var(--text-secondary)' }}>
            {debugInfo.isAirborne ? 'ACTIVE' : `${Math.round(debugInfo.airborneDurationMs)}ms`}
          </span>
        </div>
        <div>
          <span style={{ color: 'var(--text-muted)' }}>Last Jump: </span>
          <span style={{ color: 'var(--text-primary)' }}>
            {debugInfo.lastJumpTime ? `${debugInfo.timeSinceLastJumpMs}ms ago` : 'None'}
          </span>
        </div>
      </div>

      {/* Last Rejection Reason Banner */}
      <div
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 8,
          padding: '8px 10px',
          marginBottom: 12,
          fontFamily: 'monospace',
          fontSize: 11,
        }}
      >
        <span style={{ color: 'var(--text-muted)' }}>Last Status / Reject: </span>
        <span
          style={{
            color: debugInfo.lastRejectionReason.includes('Successful')
              ? 'var(--accent-green)'
              : debugInfo.lastRejectionReason === 'None'
              ? 'var(--text-secondary)'
              : 'var(--warning)',
          }}
        >
          {debugInfo.lastRejectionReason}
        </span>
      </div>

      {/* State Transitions Log Section */}
      <div>
        <button
          onClick={() => setShowTransitions(!showTransitions)}
          style={{
            background: 'none',
            color: 'var(--text-secondary)',
            fontSize: 11,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            padding: '4px 0',
            marginBottom: 6,
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <History size={13} />
            <span>RECENT TRANSITIONS ({debugInfo.recentTransitions?.length || 0})</span>
          </span>
          {showTransitions ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {showTransitions && (
          <div
            style={{
              backgroundColor: 'rgba(0,0,0,0.5)',
              borderRadius: 8,
              padding: 8,
              maxHeight: 130,
              overflowY: 'auto',
              fontFamily: 'monospace',
              fontSize: 10,
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            {(!debugInfo.recentTransitions || debugInfo.recentTransitions.length === 0) ? (
              <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 8 }}>
                No state transitions logged yet
              </div>
            ) : (
              debugInfo.recentTransitions.map((t, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    paddingBottom: 2,
                  }}
                >
                  <span style={{ color: t.to === 'COUNTED' ? 'var(--accent-green)' : 'var(--text-primary)' }}>
                    {t.from} → {t.to}
                  </span>
                  <span style={{ color: 'var(--text-muted)' }}>
                    d:{t.displacement.toFixed(2)} | v:{t.velocity.toFixed(2)}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
