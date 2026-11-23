import React from 'react';
import { JumpDebugInfo } from '../types/pose';
import { X, Activity } from 'lucide-react';

interface DebugPanelProps {
  debugInfo: JumpDebugInfo;
  onClose: () => void;
}

export const DebugPanel: React.FC<DebugPanelProps> = ({ debugInfo, onClose }) => {
  return (
    <div
      style={{
        position: 'absolute',
        top: 16,
        left: 16,
        right: 16,
        zIndex: 50,
        backgroundColor: 'rgba(27, 32, 36, 0.94)',
        backdropFilter: 'blur(10px)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 14,
        padding: 16,
        fontSize: 12,
        color: 'var(--text-secondary)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
      }}
    >
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--accent-green)', fontWeight: 600 }}>
          <Activity size={16} />
          <span>DEVELOPER DEBUG PANEL</span>
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

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '8px 14px',
          fontFamily: 'monospace',
        }}
      >
        <div>
          <span style={{ color: 'var(--text-muted)' }}>Jump State: </span>
          <span style={{ color: 'var(--accent-green)', fontWeight: 700 }}>{debugInfo.state}</span>
        </div>
        <div>
          <span style={{ color: 'var(--text-muted)' }}>FPS: </span>
          <span style={{ color: 'var(--text-primary)' }}>{debugInfo.fps}</span>
        </div>
        <div>
          <span style={{ color: 'var(--text-muted)' }}>Displacement: </span>
          <span style={{ color: 'var(--text-primary)' }}>{debugInfo.displacementNorm.toFixed(3)}</span>
        </div>
        <div>
          <span style={{ color: 'var(--text-muted)' }}>Velocity: </span>
          <span style={{ color: 'var(--text-primary)' }}>{debugInfo.velocity.toFixed(3)}</span>
        </div>
        <div>
          <span style={{ color: 'var(--text-muted)' }}>Hip Y / Base: </span>
          <span style={{ color: 'var(--text-primary)' }}>
            {debugInfo.hipY.toFixed(3)} / {debugInfo.baselineHipY.toFixed(3)}
          </span>
        </div>
        <div>
          <span style={{ color: 'var(--text-muted)' }}>Ankle Y: </span>
          <span style={{ color: 'var(--text-primary)' }}>{debugInfo.ankleY.toFixed(3)}</span>
        </div>
        <div>
          <span style={{ color: 'var(--text-muted)' }}>Confidence: </span>
          <span
            style={{
              color: debugInfo.landmarkConfidence > 0.6 ? 'var(--accent-green)' : 'var(--warning)',
            }}
          >
            {(debugInfo.landmarkConfidence * 100).toFixed(0)}%
          </span>
        </div>
        <div>
          <span style={{ color: 'var(--text-muted)' }}>Airborne: </span>
          <span style={{ color: debugInfo.isAirborne ? 'var(--accent-green)' : 'var(--text-secondary)' }}>
            {debugInfo.isAirborne ? 'YES' : 'NO'}
          </span>
        </div>
        <div>
          <span style={{ color: 'var(--text-muted)' }}>Threshold: </span>
          <span style={{ color: 'var(--text-primary)' }}>{debugInfo.threshold.toFixed(2)}</span>
        </div>
        <div>
          <span style={{ color: 'var(--text-muted)' }}>Last Jump: </span>
          <span style={{ color: 'var(--text-primary)' }}>
            {debugInfo.lastJumpTime ? `${Math.round(performance.now() - debugInfo.lastJumpTime)}ms ago` : 'None'}
          </span>
        </div>
      </div>
    </div>
  );
};

