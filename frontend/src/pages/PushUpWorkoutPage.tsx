import React, { useEffect, useRef, useState, useCallback } from 'react';
import { WorkoutSessionData } from '../types/workout';
import { CameraManager } from '../camera/cameraManager';
import { PoseDetectorService } from '../pose/poseDetector';
import { SkeletonRenderer } from '../pose/skeletonRenderer';
import { PushUpDetector } from '../exercises/pushup/pushUpDetector';
import { pushUpSound } from '../exercises/pushup/pushUpSound';
import { ConfettiBurst } from '../components/ConfettiBurst';
import {
  PushUpCalibrationState,
  PushUpDebugInfo,
  PushUpMode,
} from '../exercises/pushup/pushUpTypes';
import {
  Square,
  AlertCircle,
  RefreshCw,
  Code,
  Volume2,
  VolumeX,
  SwitchCamera,
  CheckCircle2,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';

interface PushUpWorkoutPageProps {
  mode: PushUpMode;
  onFinishWorkout: (session: WorkoutSessionData) => void;
  onExitWorkout: () => void;
}

export const PushUpWorkoutPage: React.FC<PushUpWorkoutPageProps> = ({
  mode,
  onFinishWorkout,
  onExitWorkout,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const cameraManagerRef = useRef<CameraManager | null>(null);
  const detectorRef = useRef<PushUpDetector | null>(null);
  const skeletonRendererRef = useRef<SkeletonRenderer | null>(null);
  const isRunningRef = useRef(false);
  const animationFrameIdRef = useRef<number | null>(null);
  const workoutStartTimestampRef = useRef<number | null>(null);

  // States
  const [calibrationState, setCalibrationState] = useState<PushUpCalibrationState>('INSTRUCTION');
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isWorkoutActive, setIsWorkoutActive] = useState(false);
  const [completedReps, setCompletedReps] = useState(0);
  const [targetReps] = useState<number | null>(mode === 'freedom' ? null : parseInt(mode, 10));
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [statusMessage, setStatusMessage] = useState('Position yourself above phone');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [isMuted, setIsMuted] = useState(pushUpSound.isMuted());
  const [showDebug, setShowDebug] = useState(false);
  const [celebrationMessage, setCelebrationMessage] = useState<string | null>(null);
  const [milestoneBanner, setMilestoneBanner] = useState<string | null>(null);

  const elapsedSecondsRef = useRef(0);
  const milestoneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [debugInfo, setDebugInfo] = useState<PushUpDebugInfo>({
    state: 'READY',
    completedReps: 0,
    targetReps: mode === 'freedom' ? null : parseInt(mode, 10),
    mode,
    avgElbowAngle: 180,
    shoulderSpan: 0,
    proximityScore: 0,
    stateDurationMs: 0,
    repPaceRpm: 0,
    lastRejectionReason: 'None',
    isCalibrated: false,
    statusMessage: 'READY',
  });

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // 1. Initialize detector, camera, and MediaPipe
  const initCameraAndAI = useCallback(async () => {
    setCameraError(null);
    try {
      if (!videoRef.current || !canvasRef.current) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;

      cameraManagerRef.current = new CameraManager({
        facingMode: 'user',
        idealWidth: 1280,
        idealHeight: 720,
      });
      await cameraManagerRef.current.startCamera(video);

      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      skeletonRendererRef.current = new SkeletonRenderer(canvas);

      const poseService = PoseDetectorService.getInstance();
      await poseService.initialize();

      detectorRef.current = new PushUpDetector({ mode });
      detectorRef.current.setCalibrationState('INSTRUCTION');
      setCalibrationState('INSTRUCTION');
    } catch (err: any) {
      console.error('PushUp initialization error:', err);
      setCameraError(err?.message || 'Could not access camera or start pose detector.');
    }
  }, [mode]);

  useEffect(() => {
    initCameraAndAI();
    return () => {
      isRunningRef.current = false;
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
      cameraManagerRef.current?.stopCamera();
      if (milestoneTimerRef.current) {
        clearTimeout(milestoneTimerRef.current);
      }
    };
  }, [initCameraAndAI]);

  // Handle auto-finish workout on target reached
  const handleAutoFinish = useCallback(
    (finalReps: number) => {
      isRunningRef.current = false;
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }

      const activeDuration = elapsedSecondsRef.current;
      const rpm = activeDuration > 0 ? (finalReps / activeDuration) * 60 : 0;
      const startTime = new Date(Date.now() - activeDuration * 1000).toISOString();
      const endTime = new Date().toISOString();

      const session: WorkoutSessionData = {
        session_date: new Date().toISOString().split('T')[0],
        start_time: startTime,
        end_time: endTime,
        total_jumps: finalReps,
        active_duration_seconds: activeDuration,
        rest_duration_seconds: 0,
        total_duration_seconds: activeDuration,
        average_jumps_per_minute: Math.round(rpm * 10) / 10,
        max_jumps_per_minute: Math.round(rpm * 10) / 10,
        exercise_type: 'push_up',
        workout_mode: mode,
        target_reps: targetReps,
        completed_reps: finalReps,
        completion_status: 'completed',
      };

      setCelebrationMessage(`${finalReps} REPS COMPLETED! 🎉`);
      setTimeout(() => {
        onFinishWorkout(session);
      }, 1700);
    },
    [mode, onFinishWorkout, targetReps]
  );

  // Manual stop workout
  const handleStopWorkout = () => {
    isRunningRef.current = false;
    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
    }
    cameraManagerRef.current?.stopCamera();

    const activeDuration = elapsedSeconds;
    const rpm = activeDuration > 0 ? (completedReps / activeDuration) * 60 : 0;
    const startTime = new Date(Date.now() - activeDuration * 1000).toISOString();
    const endTime = new Date().toISOString();

    const isCompleted = targetReps !== null ? completedReps >= targetReps : completedReps > 0;

    const session: WorkoutSessionData = {
      session_date: new Date().toISOString().split('T')[0],
      start_time: startTime,
      end_time: endTime,
      total_jumps: completedReps,
      active_duration_seconds: activeDuration,
      rest_duration_seconds: 0,
      total_duration_seconds: activeDuration,
      average_jumps_per_minute: Math.round(rpm * 10) / 10,
      max_jumps_per_minute: Math.round(rpm * 10) / 10,
      exercise_type: 'push_up',
      workout_mode: mode,
      target_reps: targetReps,
      completed_reps: completedReps,
      completion_status: isCompleted ? 'completed' : 'stopped',
    };

    onFinishWorkout(session);
  };

  // Workout frame processing loop
  const runDetectionLoop = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const detector = detectorRef.current;
    const poseService = PoseDetectorService.getInstance();
    const renderer = skeletonRendererRef.current;

    if (!video || !canvas || !detector || !renderer) return;

    const processFrame = () => {
      if (!isRunningRef.current) return;

      const now = performance.now();
      const result = poseService.detectForVideo(video, now);
      const landmarks = result?.landmarks?.[0] || null;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }

      if (landmarks) {
        // Draw skeleton overlay
        renderer.render(landmarks, {
          status: isWorkoutActive ? 'ACTIVE' : 'CALIBRATING',
          mirrored: false,
        });

        // Check if workout is actively counting
        if (isWorkoutActive) {
          const didRepComplete = detector.processFrame(landmarks, now);
          const currentCount = detector.completedReps;
          setCompletedReps(currentCount);
          setStatusMessage(detector.debugInfo.statusMessage);
          setDebugInfo(detector.debugInfo);

          if (detector.isTargetReached) {
            handleAutoFinish(currentCount);
            return;
          }

          if (didRepComplete) {
            // Trigger encouraging mid-set callout on halfway, final sprint, or multiples of 5/10
            let toastMsg: string | null = null;
            if (targetReps !== null) {
              const remaining = targetReps - currentCount;
              if (remaining === Math.floor(targetReps / 2)) {
                toastMsg = '⚡ HALFWAY THERE! KEEP PUSHING!';
              } else if (remaining === 3) {
                toastMsg = '🔥 ONLY 3 REPS LEFT!';
              } else if (remaining === 1) {
                toastMsg = '💥 ONE LAST REP! FINISH IT!';
              }
            } else if (currentCount > 0 && currentCount % 10 === 0) {
              toastMsg = `🏆 ${currentCount} REPS! BEAST MODE!`;
            } else if (currentCount === 5) {
              toastMsg = '💪 5 REPS LOCKED IN!';
            }

            if (toastMsg) {
              pushUpSound.playMilestoneChime();
              setMilestoneBanner(toastMsg);
              if (milestoneTimerRef.current) clearTimeout(milestoneTimerRef.current);
              milestoneTimerRef.current = setTimeout(() => setMilestoneBanner(null), 2100);
            }
          }
        } else if (detector.currentCalibrationState === 'CALIBRATING_TOP') {
          const done = detector.addCalibrationSample(landmarks, now);
          if (done) {
            detector.setCalibrationState('CALIBRATING_BOTTOM');
            setCalibrationState('CALIBRATING_BOTTOM');
          }
        } else if (detector.currentCalibrationState === 'CALIBRATING_BOTTOM') {
          const done = detector.addCalibrationSample(landmarks, now);
          if (done) {
            setCalibrationState('COMPLETED');
            startCountdown();
          }
        }
      } else {
        if (isWorkoutActive) {
          setStatusMessage('TRACKING LOST');
        }
      }

      animationFrameIdRef.current = requestAnimationFrame(processFrame);
    };

    isRunningRef.current = true;
    animationFrameIdRef.current = requestAnimationFrame(processFrame);
  }, [handleAutoFinish, isWorkoutActive]);

  // Start 3-second countdown before active counting
  const startCountdown = () => {
    let count = 3;
    setCountdown(count);
    const timer = setInterval(() => {
      count--;
      if (count <= 0) {
        clearInterval(timer);
        setCountdown(null);
        setIsWorkoutActive(true);
        workoutStartTimestampRef.current = Date.now();
        setStatusMessage('READY');
      } else {
        setCountdown(count);
      }
    }, 1000);
  };

  // Timer interval when workout is active
  useEffect(() => {
    if (!isWorkoutActive) return;
    const interval = setInterval(() => {
      setElapsedSeconds((s) => {
        const next = s + 1;
        elapsedSecondsRef.current = next;
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isWorkoutActive]);

  // Start frame loop when camera is ready
  useEffect(() => {
    if (calibrationState !== 'INSTRUCTION') {
      runDetectionLoop();
    }
    return () => {
      isRunningRef.current = false;
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
    };
  }, [calibrationState, runDetectionLoop]);

  // Handle begin calibration button
  const handleBeginCalibration = () => {
    detectorRef.current?.setCalibrationState('CALIBRATING_TOP');
    setCalibrationState('CALIBRATING_TOP');
  };

  // Switch camera between front and back
  const handleSwitchCamera = async () => {
    if (!cameraManagerRef.current || !videoRef.current) return;
    try {
      const newMode = await cameraManagerRef.current.switchCamera();
      setFacingMode(newMode);
    } catch (err: any) {
      alert(`Could not switch camera: ${err?.message || 'Unknown error'}`);
    }
  };

  const handleToggleMute = () => {
    const next = pushUpSound.toggleMute();
    setIsMuted(next);
  };

  // Calculate progress percentage
  const progressPercent =
    targetReps !== null
      ? Math.min(100, Math.round((completedReps / targetReps) * 100))
      : null;

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100vh',
        backgroundColor: '#090B0D',
        color: '#FFFFFF',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Camera Video Stream */}
      <video
        ref={videoRef}
        playsInline
        muted
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: facingMode === 'user' ? 'scaleX(-1)' : 'none',
        }}
      />

      {/* MediaPipe Skeleton Canvas */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: facingMode === 'user' ? 'scaleX(-1)' : 'none',
          pointerEvents: 'none',
        }}
      />

      {/* Camera Error Modal */}
      {cameraError && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(9, 11, 13, 0.95)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            textAlign: 'center',
            zIndex: 999,
          }}
        >
          <AlertCircle size={48} color="#FF453A" style={{ marginBottom: 16 }} />
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Camera Access Issue</h2>
          <p style={{ fontSize: 14, color: '#8E9AA8', maxWidth: 360, marginBottom: 24 }}>
            {cameraError}
          </p>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={initCameraAndAI}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '12px 20px',
                backgroundColor: '#39E66B',
                color: '#090B0D',
                borderRadius: 12,
                fontWeight: 700,
                border: 'none',
              }}
            >
              <RefreshCw size={18} /> Retry
            </button>
            <button
              onClick={onExitWorkout}
              style={{
                padding: '12px 20px',
                backgroundColor: '#1E252B',
                color: '#FFF',
                borderRadius: 12,
                fontWeight: 600,
                border: 'none',
              }}
            >
              Back to Home
            </button>
          </div>
        </div>
      )}

      {/* Celebration Banner Overlay on Target Reached */}
      {celebrationMessage && (
        <>
          <ConfettiBurst active={true} durationMs={2800} />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'rgba(9, 11, 13, 0.9)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              animation: 'fadeIn 0.3s ease-out',
            }}
          >
            <div
              className="animate-pop"
              style={{
                width: 84,
                height: 84,
                borderRadius: '50%',
                backgroundColor: 'rgba(57, 230, 107, 0.2)',
                border: '2px solid #39E66B',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#39E66B',
                marginBottom: 16,
                boxShadow: '0 0 36px rgba(57, 230, 107, 0.6)',
              }}
            >
              <CheckCircle2 size={50} />
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 900, color: '#FFFFFF', marginBottom: 8 }}>
              {celebrationMessage}
            </h1>
            <p style={{ fontSize: 16, color: '#39E66B', fontWeight: 700 }}>
              Saving workout summary...
            </p>
          </div>
        </>
      )}

      {/* Guided Calibration Overlay */}
      {calibrationState !== 'COMPLETED' && !cameraError && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(9, 11, 13, 0.88)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 24,
            zIndex: 900,
            textAlign: 'center',
          }}
        >
          {calibrationState === 'INSTRUCTION' && (
            <div style={{ maxWidth: 420 }}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 20,
                  backgroundColor: 'rgba(57, 230, 107, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#39E66B',
                  margin: '0 auto 20px auto',
                  border: '1px solid rgba(57, 230, 107, 0.3)',
                }}
              >
                <ShieldAlert size={32} />
              </div>
              <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 12 }}>
                Phone Placement Setup
              </h2>
              <p style={{ fontSize: 15, color: '#8E9AA8', lineHeight: 1.5, marginBottom: 20 }}>
                Place your phone <strong>flat on the floor</strong> directly underneath your chest
                area, with the <strong>front camera pointing up</strong> towards you.
              </p>
              <div
                style={{
                  backgroundColor: '#161B20',
                  borderRadius: 14,
                  padding: '12px 16px',
                  marginBottom: 24,
                  textAlign: 'left',
                  border: '1px solid #232930',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: '#39E66B', marginBottom: 4 }}>
                  Next 2 Calibration Steps:
                </div>
                <div style={{ fontSize: 12, color: '#CBD5E1', marginBottom: 2 }}>
                  1. Hold top plank position (arms extended)
                </div>
                <div style={{ fontSize: 12, color: '#CBD5E1' }}>
                  2. Perform 1 slow practice rep to set bottom depth
                </div>
              </div>
              <button
                onClick={handleBeginCalibration}
                style={{
                  width: '100%',
                  height: 52,
                  borderRadius: 16,
                  backgroundColor: '#39E66B',
                  color: '#090B0D',
                  fontSize: 16,
                  fontWeight: 800,
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <span>I'm In Position — Start Calibration</span>
                <ArrowRight size={18} strokeWidth={2.5} />
              </button>
            </div>
          )}

          {calibrationState === 'CALIBRATING_TOP' && (
            <div style={{ maxWidth: 360 }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  border: '3px solid #39E66B',
                  borderTopColor: 'transparent',
                  animation: 'spin 1s linear infinite',
                  margin: '0 auto 20px auto',
                }}
              />
              <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>
                Step 1: Hold Top Position
              </h2>
              <p style={{ fontSize: 14, color: '#8E9AA8', lineHeight: 1.5 }}>
                Straighten your arms in push-up plank directly above the phone. Hold steady...
              </p>
            </div>
          )}

          {calibrationState === 'CALIBRATING_BOTTOM' && (
            <div style={{ maxWidth: 360 }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  backgroundColor: 'rgba(57, 230, 107, 0.15)',
                  border: '2px solid #39E66B',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#39E66B',
                  margin: '0 auto 20px auto',
                }}
              >
                <CheckCircle2 size={32} />
              </div>
              <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>
                Step 2: 1 Practice Rep
              </h2>
              <p style={{ fontSize: 14, color: '#8E9AA8', lineHeight: 1.5 }}>
                Lower your chest towards the phone (~15cm depth) then press back up to lock your
                range of motion.
              </p>
            </div>
          )}
        </div>
      )}

      {/* 3-Second Countdown Overlay */}
      {countdown !== null && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(9, 11, 13, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 950,
          }}
        >
          <div
            style={{
              fontSize: 100,
              fontWeight: 900,
              color: '#39E66B',
              animation: 'pulse 1s ease-in-out infinite',
            }}
          >
            {countdown}
          </div>
        </div>
      )}

      {/* Top Floating Controls Bar */}
      <div
        style={{
          position: 'relative',
          zIndex: 100,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 20px',
          background: 'linear-gradient(180deg, rgba(9, 11, 13, 0.8) 0%, rgba(9, 11, 13, 0) 100%)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: 1,
              backgroundColor: 'rgba(57, 230, 107, 0.2)',
              color: '#39E66B',
              padding: '4px 10px',
              borderRadius: 20,
              textTransform: 'uppercase',
            }}
          >
            {mode === 'freedom' ? 'Freedom Mode' : `${mode} Rep Target`}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={handleToggleMute}
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              backgroundColor: 'rgba(24, 30, 36, 0.85)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isMuted ? '#8E9AA8' : '#39E66B',
              cursor: 'pointer',
            }}
          >
            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>

          <button
            onClick={handleSwitchCamera}
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              backgroundColor: 'rgba(24, 30, 36, 0.85)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              cursor: 'pointer',
            }}
          >
            <SwitchCamera size={18} />
          </button>

          <button
            onClick={() => setShowDebug((prev) => !prev)}
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              backgroundColor: showDebug ? '#39E66B' : 'rgba(24, 30, 36, 0.85)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: showDebug ? '#090B0D' : '#FFFFFF',
              cursor: 'pointer',
            }}
          >
            <Code size={18} />
          </button>

          <button
            onClick={handleStopWorkout}
            style={{
              height: 40,
              padding: '0 16px',
              borderRadius: 20,
              backgroundColor: 'rgba(255, 69, 58, 0.2)',
              border: '1px solid #FF453A',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              color: '#FF453A',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            <Square size={14} fill="#FF453A" /> Stop
          </button>
        </div>
      </div>

      {/* Main Repetition Display & Progress */}
      <div
        style={{
          position: 'relative',
          zIndex: 100,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20,
        }}
      >
        {/* Real-time Status Banner */}
        <div
          style={{
            backgroundColor:
              statusMessage === 'BOTTOM POSITION DETECTED'
                ? 'rgba(57, 230, 107, 0.3)'
                : statusMessage === 'TRACKING LOST'
                ? 'rgba(255, 69, 58, 0.3)'
                : 'rgba(18, 22, 26, 0.85)',
            border:
              statusMessage === 'BOTTOM POSITION DETECTED'
                ? '2px solid #39E66B'
                : statusMessage === 'TRACKING LOST'
                ? '2px solid #FF453A'
                : '1px solid rgba(255, 255, 255, 0.15)',
            color:
              statusMessage === 'BOTTOM POSITION DETECTED'
                ? '#39E66B'
                : statusMessage === 'TRACKING LOST'
                ? '#FF453A'
                : '#FFFFFF',
            padding: '10px 24px',
            borderRadius: 30,
            fontSize: 15,
            fontWeight: 800,
            letterSpacing: 1,
            textTransform: 'uppercase',
            marginBottom: 20,
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(8px)',
            transition: 'all 0.15s ease',
          }}
        >
          {statusMessage}
        </div>

        {/* Primary Repetition Count with Circular Progress Ring */}
        <div
          style={{
            position: 'relative',
            width: 196,
            height: 196,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 14,
          }}
        >
          <svg
            width={196}
            height={196}
            viewBox="0 0 196 196"
            style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}
          >
            <circle
              cx={98}
              cy={98}
              r={86}
              fill="rgba(12, 16, 20, 0.55)"
              stroke="rgba(255, 255, 255, 0.14)"
              strokeWidth={10}
            />
            <circle
              cx={98}
              cy={98}
              r={86}
              fill="none"
              stroke={
                statusMessage === 'BOTTOM POSITION DETECTED'
                  ? '#39E66B'
                  : progressPercent === 100
                  ? '#39E66B'
                  : '#5E96FF'
              }
              strokeWidth={10}
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 86}
              strokeDashoffset={
                progressPercent !== null
                  ? 2 * Math.PI * 86 * (1 - progressPercent / 100)
                  : 2 * Math.PI * 86 * (1 - Math.min(1, (completedReps % 10 || (completedReps > 0 ? 10 : 0)) / 10))
              }
              style={{
                transition: 'stroke-dashoffset 0.3s cubic-bezier(0.22, 1, 0.36, 1), stroke 0.2s ease',
                filter: 'drop-shadow(0 0 10px rgba(57, 230, 107, 0.45))',
              }}
            />
          </svg>

          <div
            key={completedReps > 0 ? completedReps : 'zero'}
            className={`tabular-nums ${completedReps > 0 ? 'animate-counter-bump' : ''}`}
            style={{
              position: 'relative',
              fontSize: 82,
              fontWeight: 900,
              lineHeight: 0.95,
              color: '#FFFFFF',
              textShadow: '0 4px 24px rgba(0, 0, 0, 0.85)',
            }}
          >
            {completedReps}
          </div>
          <div
            style={{
              position: 'relative',
              fontSize: 13,
              fontWeight: 800,
              color: '#39E66B',
              letterSpacing: 1.5,
              textTransform: 'uppercase',
              marginTop: 4,
            }}
          >
            {targetReps !== null ? `of ${targetReps} Reps` : 'Freedom Reps'}
          </div>
        </div>

        {/* Milestone Toast Banner */}
        {milestoneBanner && (
          <div
            key={milestoneBanner + completedReps}
            className="animate-toast-float"
            style={{
              backgroundColor: 'rgba(18, 22, 26, 0.94)',
              border: '2px solid #5E96FF',
              color: '#FFFFFF',
              padding: '8px 20px',
              borderRadius: 24,
              fontSize: 14,
              fontWeight: 900,
              letterSpacing: 0.5,
              marginBottom: 12,
              boxShadow: '0 6px 24px rgba(94, 150, 255, 0.45)',
            }}
          >
            {milestoneBanner}
          </div>
        )}

        {/* Live Chest Depth Meter */}
        {isWorkoutActive && (
          <div
            style={{
              width: '100%',
              maxWidth: 260,
              backgroundColor: 'rgba(18, 22, 26, 0.78)',
              borderRadius: 14,
              padding: '8px 14px',
              marginBottom: 14,
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: 0.8,
                color: debugInfo.proximityScore >= 0.65 ? '#39E66B' : '#929BA3',
                marginBottom: 5,
              }}
            >
              <span>CHEST PROXIMITY DEPTH</span>
              <span>
                {debugInfo.proximityScore >= 0.65 ? 'BOTTOM ZONE ✓' : `${Math.min(100, Math.round(debugInfo.proximityScore * 100))}%`}
              </span>
            </div>
            <div
              style={{
                width: '100%',
                height: 6,
                backgroundColor: 'rgba(255, 255, 255, 0.12)',
                borderRadius: 3,
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              {/* Target threshold marker at 65% */}
              <div
                style={{
                  position: 'absolute',
                  left: '65%',
                  top: 0,
                  bottom: 0,
                  width: 2,
                  backgroundColor: 'rgba(255,255,255,0.5)',
                  zIndex: 2,
                }}
              />
              <div
                style={{
                  width: `${Math.min(100, Math.max(4, Math.round(debugInfo.proximityScore * 100)))}%`,
                  height: '100%',
                  backgroundColor: debugInfo.proximityScore >= 0.65 ? '#39E66B' : '#5E96FF',
                  borderRadius: 3,
                  transition: 'width 0.08s linear, background-color 0.15s ease',
                }}
              />
            </div>
          </div>
        )}

        {/* Workout Stats: Time, Pace & Est. Burn */}
        <div
          style={{
            display: 'flex',
            gap: 20,
            backgroundColor: 'rgba(18, 22, 26, 0.78)',
            padding: '8px 20px',
            borderRadius: 20,
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: '#8E9AA8', fontWeight: 700 }}>TIME</div>
            <div className="tabular-nums" style={{ fontSize: 15, fontWeight: 800, color: '#FFFFFF' }}>
              {formatTimer(elapsedSeconds)}
            </div>
          </div>
          <div style={{ width: 1, backgroundColor: 'rgba(255, 255, 255, 0.1)' }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: '#8E9AA8', fontWeight: 700 }}>PACE</div>
            <div className="tabular-nums" style={{ fontSize: 15, fontWeight: 800, color: '#FFFFFF' }}>
              {elapsedSeconds > 0
                ? `${Math.round((completedReps / (elapsedSeconds / 60)) * 10) / 10} RPM`
                : '0.0 RPM'}
            </div>
          </div>
          <div style={{ width: 1, backgroundColor: 'rgba(255, 255, 255, 0.1)' }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: '#8E9AA8', fontWeight: 700 }}>BURN</div>
            <div className="tabular-nums" style={{ fontSize: 15, fontWeight: 800, color: '#FF9F0A' }}>
              ~{Math.round(completedReps * 0.45 + elapsedSeconds * 0.04)} kcal
            </div>
          </div>
        </div>
      </div>

      {/* Debug Panel Overlay */}
      {showDebug && (
        <div
          style={{
            position: 'absolute',
            bottom: 20,
            left: 20,
            right: 20,
            backgroundColor: 'rgba(18, 22, 26, 0.95)',
            border: '1px solid #232930',
            borderRadius: 16,
            padding: 14,
            fontSize: 12,
            zIndex: 200,
            fontFamily: 'monospace',
          }}
        >
          <div style={{ fontWeight: 700, color: '#39E66B', marginBottom: 4 }}>
            Push-Up Debug Diagnostics
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px' }}>
            <div>State: {debugInfo.state}</div>
            <div>Elbow Angle: {Math.round(debugInfo.avgElbowAngle)}°</div>
            <div>Proximity Score: {debugInfo.proximityScore.toFixed(2)}</div>
            <div>Shoulder Span: {debugInfo.shoulderSpan.toFixed(3)}</div>
            <div>Rejection: {debugInfo.lastRejectionReason}</div>
            <div>Calibrated: {debugInfo.isCalibrated ? 'Yes' : 'No'}</div>
          </div>
        </div>
      )}
    </div>
  );
};
