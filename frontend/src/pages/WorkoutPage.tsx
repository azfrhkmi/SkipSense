import React, { useEffect, useRef, useState, useCallback } from 'react';
import { WorkoutStatus, JumpDebugInfo } from '../types/pose';
import { WorkoutSessionData } from '../types/workout';
import { CameraManager } from '../camera/cameraManager';
import { PoseDetectorService } from '../pose/poseDetector';
import { SkeletonRenderer } from '../pose/skeletonRenderer';
import { WorkoutManager } from '../workout/workoutManager';
import { DebugPanel } from '../components/DebugPanel';
import {
  Square,
  AlertCircle,
  RefreshCw,
  Code,
  Pause,
  Play,
  Activity,
} from 'lucide-react';

interface WorkoutPageProps {
  onFinishWorkout: (session: WorkoutSessionData) => void;
  onExitWorkout: () => void;
}

export const WorkoutPage: React.FC<WorkoutPageProps> = ({ onFinishWorkout, onExitWorkout }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const cameraManagerRef = useRef<CameraManager | null>(null);
  const workoutManagerRef = useRef<WorkoutManager | null>(null);
  const skeletonRendererRef = useRef<SkeletonRenderer | null>(null);
  const isRunningRef = useRef(false);
  const animationFrameIdRef = useRef<number | null>(null);

  const [status, setStatus] = useState<WorkoutStatus>('IDLE');
  const [totalJumps, setTotalJumps] = useState(0);
  const [activeSeconds, setActiveSeconds] = useState(0);
  const [restSeconds, setRestSeconds] = useState(0);
  const [currentPace, setCurrentPace] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [positionFeedback, setPositionFeedback] = useState<string>('Initializing AI & Camera...');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [debugInfo, setDebugInfo] = useState<JumpDebugInfo>({
    state: 'GROUNDED',
    totalJumps: 0,
    hipY: 0,
    ankleY: 0,
    baselineHipY: 0,
    dynamicBaselineY: 0,
    displacementNorm: 0,
    velocity: 0,
    hipVelocity: 0,
    ankleVelocity: 0,
    landmarkConfidence: 0,
    isAirborne: false,
    airborneDurationMs: 0,
    lastJumpTime: 0,
    timeSinceLastJumpMs: 0,
    threshold: 0.08,
    fps: 0,
    inferenceFps: 0,
    lastRejectionReason: 'None',
    movementDirection: 'STABLE',
    recentTransitions: [],
  });

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const initWorkout = useCallback(async () => {
    setCameraError(null);
    setPositionFeedback('Starting camera and AI pose model...');
    setStatus('IDLE');

    try {
      if (!videoRef.current || !canvasRef.current) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;

      // 1. Initialize Camera
      cameraManagerRef.current = new CameraManager({
        facingMode: 'user',
        idealWidth: 1280,
        idealHeight: 720,
      });
      await cameraManagerRef.current.startCamera(video);

      // Match canvas internal resolution to video stream resolution
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      skeletonRendererRef.current = new SkeletonRenderer(canvas);

      // 2. Initialize MediaPipe PoseLandmarker
      setPositionFeedback('Loading local AI pose model...');
      const poseService = PoseDetectorService.getInstance();
      await poseService.initialize();

      // 3. Initialize WorkoutManager
      workoutManagerRef.current = new WorkoutManager({
        onStatusChange: (newStatus) => setStatus(newStatus),
        onCountChange: (count) => setTotalJumps(count),
        onTimerTick: (actSec, rstSec, pace) => {
          setActiveSeconds(actSec);
          setRestSeconds(rstSec);
          setCurrentPace(pace);
        },
        onCountdownTick: (remaining) => setCountdown(remaining),
        onPositionFeedback: (msg) => setPositionFeedback(msg),
        onDebugUpdate: (dbg) => setDebugInfo(dbg),
        onWorkoutComplete: (session) => onFinishWorkout(session),
      });

      workoutManagerRef.current.startWorkoutFlow();
      isRunningRef.current = true;

      // 4. Start Real-time Detection Loop
      let lastInferenceTime = 0;
      let isInferring = false;
      const processLoop = () => {
        if (!isRunningRef.current) return;

        const now = performance.now();
        // Responsive inference cadence (up to 40-50 inferences/sec when hardware permits, min 20ms)
        if (!isInferring && now - lastInferenceTime >= 20 && video.readyState >= 2) {
          isInferring = true;
          lastInferenceTime = now;
          const result = poseService.detectForVideo(video, now);
          isInferring = false;

          if (result && result.landmarks && result.landmarks.length > 0) {
            const landmarks = result.landmarks[0];

            // Render skeleton matching mirrored view
            if (skeletonRendererRef.current) {
              skeletonRendererRef.current.render(landmarks, {
                status: workoutManagerRef.current?.currentStatus || 'IDLE',
                mirrored: false,
              });
            }

            // Feed landmarks to WorkoutManager
            if (workoutManagerRef.current) {
              workoutManagerRef.current.processFrame(landmarks, now);
            }
          } else {
            // No pose detected in this frame
            if (skeletonRendererRef.current) {
              skeletonRendererRef.current.clear();
            }
            if (workoutManagerRef.current) {
              workoutManagerRef.current.processFrame([], now);
            }
          }
        }

        animationFrameIdRef.current = requestAnimationFrame(processLoop);
      };

      animationFrameIdRef.current = requestAnimationFrame(processLoop);
    } catch (err: any) {
      console.error('Initialization error:', err);
      setCameraError(err?.message || 'Could not access camera or initialize AI');
      setStatus('IDLE');
    }
  }, [onFinishWorkout]);

  useEffect(() => {
    initWorkout();

    return () => {
      isRunningRef.current = false;
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
      if (cameraManagerRef.current) {
        cameraManagerRef.current.stopCamera();
      }
      if (workoutManagerRef.current) {
        workoutManagerRef.current.reset();
      }
    };
  }, [initWorkout]);

  const handleFinish = () => {
    isRunningRef.current = false;
    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
    }
    if (cameraManagerRef.current) {
      cameraManagerRef.current.stopCamera();
    }
    if (workoutManagerRef.current) {
      workoutManagerRef.current.finishWorkout();
    }
  };

  // Border and status indicator styling
  const getBorderColor = () => {
    switch (status) {
      case 'ACTIVE':
        return 'var(--accent-green)';
      case 'PAUSED':
        return 'var(--warning)';
      case 'COUNTDOWN':
      case 'CALIBRATING':
        return '#F5B942';
      case 'TRACKING_LOST':
        return 'var(--error)';
      case 'IDLE':
      default:
        return 'rgba(255, 255, 255, 0.15)';
    }
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'ACTIVE':
        return { text: 'ACTIVE', color: 'var(--accent-green)', icon: <Play size={12} fill="currentColor" /> };
      case 'PAUSED':
        return { text: 'AUTO PAUSED', color: 'var(--warning)', icon: <Pause size={12} fill="currentColor" /> };
      case 'COUNTDOWN':
        return { text: 'GET READY', color: 'var(--accent-green)', icon: <Activity size={12} /> };
      case 'CALIBRATING':
        return { text: 'POSITIONING', color: '#F5B942', icon: <Activity size={12} /> };
      case 'TRACKING_LOST':
        return { text: 'TRACKING LOST', color: 'var(--error)', icon: <AlertCircle size={12} /> };
      default:
        return { text: 'INITIALIZING', color: 'var(--text-secondary)', icon: <RefreshCw size={12} className="animate-spin" /> };
    }
  };

  const badge = getStatusBadge();

  return (
    <div
      style={{
        position: 'relative',
        width: '100vw',
        height: '100vh',
        backgroundColor: '#090B0D',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Top Header Controls */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 20,
          padding: '16px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'linear-gradient(to bottom, rgba(9,11,13,0.9) 0%, transparent 100%)',
        }}
      >
        {/* Status Pill */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            backgroundColor: 'rgba(20, 24, 27, 0.85)',
            backdropFilter: 'blur(8px)',
            border: `1px solid ${badge.color}`,
            borderRadius: 20,
            padding: '6px 14px',
            fontSize: 12,
            fontWeight: 700,
            color: badge.color,
            boxShadow: `0 0 12px ${badge.color}33`,
          }}
        >
          {badge.icon}
          <span>{badge.text}</span>
        </div>

        {/* Right Action Icons: Debug & Abort */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => setShowDebug(!showDebug)}
            style={{
              width: 38,
              height: 38,
              borderRadius: '50%',
              backgroundColor: 'rgba(27, 32, 36, 0.85)',
              border: '1px solid var(--border-subtle)',
              color: showDebug ? 'var(--accent-green)' : 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Code size={18} />
          </button>

          <button
            onClick={onExitWorkout}
            style={{
              backgroundColor: 'rgba(27, 32, 36, 0.85)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-secondary)',
              padding: '8px 14px',
              borderRadius: 20,
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            Cancel
          </button>
        </div>
      </div>

      {/* Developer Debug Panel */}
      {showDebug && <DebugPanel debugInfo={debugInfo} onClose={() => setShowDebug(false)} />}

      {/* Main Camera Viewport */}
      <div
        style={{
          position: 'relative',
          flex: 1,
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          border: `3px solid ${getBorderColor()}`,
          borderRadius: 20,
          margin: '8px',
          boxShadow: status === 'ACTIVE' ? '0 0 25px rgba(57, 230, 107, 0.3)' : undefined,
          transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
        }}
      >
        {/* Mirrored Video element */}
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            transform: 'scaleX(-1)', // Mirror preview for natural selfie interaction
          }}
        />

        {/* Skeleton Canvas Overlay (Mirrored identically to video) */}
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            pointerEvents: 'none',
            transform: 'scaleX(-1)', // Match mirrored video
          }}
        />

        {/* Countdown Overlay (3, 2, 1) */}
        {status === 'COUNTDOWN' && countdown !== null && (
          <div
            className="animate-pop"
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(9, 11, 13, 0.65)',
              backdropFilter: 'blur(4px)',
              zIndex: 30,
            }}
          >
            <div
              className="tabular-nums"
              style={{
                fontSize: 120,
                fontWeight: 900,
                color: 'var(--accent-green)',
                lineHeight: 1,
                textShadow: '0 0 40px rgba(57, 230, 107, 0.8)',
              }}
            >
              {countdown > 0 ? countdown : 'READY!'}
            </div>
            <div style={{ fontSize: 16, color: '#FFFFFF', marginTop: 12, fontWeight: 600 }}>
              Get ready to skip...
            </div>
          </div>
        )}

        {/* Auto-Paused Overlay Banner */}
        {status === 'PAUSED' && (
          <div
            className="animate-pop"
            style={{
              position: 'absolute',
              top: '20%',
              backgroundColor: 'rgba(245, 185, 66, 0.92)',
              color: '#090B0D',
              padding: '12px 28px',
              borderRadius: 30,
              fontWeight: 800,
              fontSize: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
              zIndex: 25,
            }}
          >
            <Pause size={20} fill="#090B0D" />
            <span>PAUSED • Start skipping to resume</span>
          </div>
        )}

        {/* Tracking Lost Warning Banner */}
        {status === 'TRACKING_LOST' && (
          <div
            className="animate-pop"
            style={{
              position: 'absolute',
              top: '20%',
              backgroundColor: 'rgba(240, 82, 82, 0.92)',
              color: '#FFFFFF',
              padding: '12px 24px',
              borderRadius: 30,
              fontWeight: 800,
              fontSize: 15,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
              zIndex: 25,
            }}
          >
            <AlertCircle size={20} />
            <span>TRACKING LOST • Step back into camera frame</span>
          </div>
        )}

        {/* Positioning Guidance Prompt */}
        {(status === 'CALIBRATING' || status === 'IDLE') && !cameraError && (
          <div
            style={{
              position: 'absolute',
              bottom: 16,
              left: 20,
              right: 20,
              backgroundColor: 'rgba(20, 24, 27, 0.88)',
              backdropFilter: 'blur(8px)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 14,
              padding: '10px 16px',
              textAlign: 'center',
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--text-primary)',
              zIndex: 15,
            }}
          >
            {positionFeedback}
          </div>
        )}

        {/* Camera Permission / Hardware Error Dialog */}
        {cameraError && (
          <div
            style={{
              position: 'absolute',
              inset: 20,
              backgroundColor: 'rgba(27, 32, 36, 0.95)',
              borderRadius: 20,
              padding: 24,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              zIndex: 40,
            }}
          >
            <AlertCircle size={44} color="var(--error)" style={{ marginBottom: 12 }} />
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Camera Initialization Failed</h3>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 20 }}>
              {cameraError}
            </p>
            <button
              onClick={() => initWorkout()}
              style={{
                backgroundColor: 'var(--accent-green)',
                color: '#090B0D',
                padding: '12px 24px',
                borderRadius: 14,
                fontWeight: 700,
                fontSize: 15,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <RefreshCw size={18} />
              <span>Retry Camera</span>
            </button>
          </div>
        )}
      </div>

      {/* Bottom Live Metrics & Counter Bar */}
      <div
        style={{
          backgroundColor: 'var(--bg-secondary)',
          borderTop: '1px solid var(--border-subtle)',
          padding: '16px 20px 28px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          zIndex: 20,
        }}
      >
        {/* Main Numerical Row: Large Counter & Pace / Time */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
          }}
        >
          {/* Main Jump Counter (Dominant visual element) */}
          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--text-secondary)',
                letterSpacing: 1,
                textTransform: 'uppercase',
                marginBottom: 2,
              }}
            >
              Total Jumps
            </div>
            <div
              className="tabular-nums"
              style={{
                fontSize: 68,
                fontWeight: 900,
                lineHeight: 0.95,
                letterSpacing: -2,
                color: status === 'ACTIVE' ? 'var(--accent-green)' : 'var(--text-primary)',
                transition: 'color 0.2s ease',
              }}
            >
              {totalJumps}
            </div>
          </div>

          {/* Right Metrics: Timer & Cadence */}
          <div style={{ display: 'flex', gap: 24, textAlign: 'right' }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 2 }}>
                {status === 'PAUSED' ? 'REST TIME' : 'ACTIVE TIME'}
              </div>
              <div
                className="tabular-nums"
                style={{
                  fontSize: 24,
                  fontWeight: 700,
                  color: status === 'PAUSED' ? 'var(--warning)' : 'var(--text-primary)',
                }}
              >
                {formatTimer(status === 'PAUSED' ? restSeconds : activeSeconds)}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 2 }}>
                CADENCE
              </div>
              <div
                className="tabular-nums"
                style={{
                  fontSize: 24,
                  fontWeight: 700,
                  color: currentPace > 0 ? 'var(--accent-green)' : 'var(--text-primary)',
                }}
              >
                {currentPace}{' '}
                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>JPM</span>
              </div>
            </div>
          </div>
        </div>

        {/* Finish Workout Button */}
        <button
          onClick={handleFinish}
          style={{
            width: '100%',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid rgba(240, 82, 82, 0.4)',
            color: 'var(--error)',
            borderRadius: 16,
            padding: '16px 20px',
            fontSize: 16,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <Square size={18} fill="currentColor" />
          <span>FINISH WORKOUT</span>
        </button>
      </div>
    </div>
  );
};
