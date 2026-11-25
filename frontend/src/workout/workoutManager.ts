import { NormalizedLandmark, WorkoutStatus, JumpDebugInfo } from '../types/pose';
import { WorkoutSessionData } from '../types/workout';
import { JumpDetector } from '../counter/jumpDetector';
import { PoseProcessor } from '../pose/poseProcessor';
import { WorkoutTimer } from './workoutTimer';
import { DEFAULT_JUMP_CONFIG } from '../config/jumpConfig';

export interface WorkoutCallbacks {
  onStatusChange: (status: WorkoutStatus) => void;
  onCountChange: (count: number) => void;
  onTimerTick: (activeSec: number, restSec: number, currentPace: number) => void;
  onCountdownTick: (remainingSeconds: number) => void;
  onPositionFeedback: (message: string) => void;
  onDebugUpdate: (debug: JumpDebugInfo) => void;
  onWorkoutComplete: (session: WorkoutSessionData) => void;
}

export interface WorkoutManagerOptions {
  autoPauseEnabled?: boolean;
}

export class WorkoutManager {
  private jumpDetector: JumpDetector;
  private poseProcessor: PoseProcessor;
  private timer: WorkoutTimer;
  private callbacks: WorkoutCallbacks;
  private autoPauseEnabled: boolean;

  private status: WorkoutStatus = 'IDLE';
  private countdownTimerId: any = null;
  private countdownSeconds = 3;
  private startTime: string | null = null;

  // Auto-pause duration (only active when autoPauseEnabled is true)
  private readonly AUTO_PAUSE_MS = 5000;
  private lastJumpOrActivityTime = 0;

  // Consecutive tracking loss debouncer to avoid single-frame motion blur dropouts
  private trackingLostFrames = 0;

  constructor(callbacks: WorkoutCallbacks, options: WorkoutManagerOptions = {}) {
    this.callbacks = callbacks;
    this.autoPauseEnabled = options.autoPauseEnabled ?? false;
    this.jumpDetector = new JumpDetector();
    this.poseProcessor = new PoseProcessor();
    this.timer = new WorkoutTimer();
  }

  public get currentStatus(): WorkoutStatus {
    return this.status;
  }

  public get totalJumps(): number {
    return this.jumpDetector.totalJumps;
  }

  public get activeSeconds(): number {
    return this.timer.activeSeconds;
  }

  public get restSeconds(): number {
    return this.timer.restSeconds;
  }

  public startWorkoutFlow() {
    this.status = 'CALIBRATING';
    this.callbacks.onStatusChange(this.status);
    this.jumpDetector.resetAll();
    this.poseProcessor.reset();
    this.timer.reset();
    this.callbacks.onCountChange(0);
    this.countdownSeconds = 3;
    this.lastJumpOrActivityTime = 0;
    this.trackingLostFrames = 0;
  }

  /**
   * Main per-frame logic called by the video loop.
   */
  public processFrame(landmarks: NormalizedLandmark[], timestampMs: number) {
    // Forward debug info
    this.callbacks.onDebugUpdate(this.jumpDetector.debugInfo);

    // 1. Evaluate body position
    const positionStatus = this.poseProcessor.evaluatePosition(landmarks);
    this.callbacks.onPositionFeedback(positionStatus.message);

    // 2. Handle state-specific logic
    switch (this.status) {
      case 'CALIBRATING': {
        if (!positionStatus.isFullyVisible || !positionStatus.isCentered || !positionStatus.isFacingCamera) {
          return;
        }

        const calibrated = this.jumpDetector.addCalibrationFrame(landmarks);
        if (calibrated) {
          this.startCountdown();
        }
        break;
      }

      case 'COUNTDOWN': {
        // If user moves out of position during countdown, abort countdown
        if (!positionStatus.isFullyVisible || !positionStatus.isCentered) {
          this.abortCountdown('Position lost. Please re-center for countdown.');
        }
        break;
      }

      case 'ACTIVE': {
        if (this.lastJumpOrActivityTime === 0) {
          this.lastJumpOrActivityTime = timestampMs;
        }

        // Keep continuous timer advancing on every frame unless auto-pause stops tracking
        if (!positionStatus.isFullyVisible || landmarks.length === 0) {
          if (!this.autoPauseEnabled) {
            const timerStats = this.timer.update(true, false, timestampMs);
            this.callbacks.onTimerTick(
              timerStats.activeSeconds,
              timerStats.restSeconds,
              timerStats.currentPaceJpm
            );
          }

          this.trackingLostFrames++;
          if (this.trackingLostFrames >= DEFAULT_JUMP_CONFIG.trackingLostGraceFrames) {
            this.status = 'TRACKING_LOST';
            this.callbacks.onStatusChange(this.status);
            this.callbacks.onPositionFeedback('TRACKING LOST – Step back into frame');
          }
          return;
        }

        this.trackingLostFrames = 0;

        // Process jump
        const jumpCounted = this.jumpDetector.processFrame(landmarks, timestampMs);
        if (jumpCounted) {
          this.lastJumpOrActivityTime = timestampMs;
          this.timer.recordJump(timestampMs);
          this.callbacks.onCountChange(this.jumpDetector.totalJumps);
        }

        // Update timer continuously while workout is active
        const timerStats = this.timer.update(true, false, timestampMs);
        this.callbacks.onTimerTick(
          timerStats.activeSeconds,
          timerStats.restSeconds,
          timerStats.currentPaceJpm
        );

        // Optional auto-pause check (disabled by default so brief breaths don't pause timer)
        if (
          this.autoPauseEnabled &&
          this.lastJumpOrActivityTime > 0 &&
          timestampMs - this.lastJumpOrActivityTime >= this.AUTO_PAUSE_MS
        ) {
          this.status = 'PAUSED';
          this.callbacks.onStatusChange(this.status);
        }
        break;
      }

      case 'PAUSED': {
        // While paused, timer accumulates rest time
        const timerStats = this.timer.update(false, true, timestampMs);
        this.callbacks.onTimerTick(
          timerStats.activeSeconds,
          timerStats.restSeconds,
          timerStats.currentPaceJpm
        );

        if (!positionStatus.isFullyVisible || landmarks.length === 0) {
          return;
        }

        // Auto-resume: if user performs a new jump
        const jumpCounted = this.jumpDetector.processFrame(landmarks, timestampMs);
        if (jumpCounted) {
          // Resume actively!
          this.status = 'ACTIVE';
          this.lastJumpOrActivityTime = timestampMs;
          this.timer.recordJump(timestampMs);
          this.callbacks.onStatusChange(this.status);
          this.callbacks.onCountChange(this.jumpDetector.totalJumps);
        }
        break;
      }

      case 'TRACKING_LOST': {
        // Keep workout clock running continuously unless auto-pause mode is explicitly enabled
        const timerStats = this.timer.update(!this.autoPauseEnabled, false, timestampMs);
        if (!this.autoPauseEnabled) {
          this.callbacks.onTimerTick(
            timerStats.activeSeconds,
            timerStats.restSeconds,
            timerStats.currentPaceJpm
          );
        }

        // If tracking returns and user is stable, resume active state
        if (positionStatus.isFullyVisible && positionStatus.isCentered) {
          this.trackingLostFrames = 0;
          this.status = 'ACTIVE';
          this.lastJumpOrActivityTime = timestampMs;
          this.callbacks.onStatusChange(this.status);
        }
        break;
      }

      case 'IDLE':
      case 'FINISHED':
      default:
        break;
    }
  }

  private startCountdown() {
    this.status = 'COUNTDOWN';
    this.countdownSeconds = 3;
    this.callbacks.onStatusChange(this.status);
    this.callbacks.onCountdownTick(this.countdownSeconds);

    if (this.countdownTimerId) clearInterval(this.countdownTimerId);

    this.countdownTimerId = setInterval(() => {
      this.countdownSeconds--;
      if (this.countdownSeconds > 0) {
        this.callbacks.onCountdownTick(this.countdownSeconds);
      } else {
        clearInterval(this.countdownTimerId!);
        this.countdownTimerId = null;
        this.activateWorkout();
      }
    }, 1000);
  }

  private abortCountdown(message: string) {
    if (this.countdownTimerId) {
      clearInterval(this.countdownTimerId);
      this.countdownTimerId = null;
    }
    this.status = 'CALIBRATING';
    this.callbacks.onStatusChange(this.status);
    this.callbacks.onPositionFeedback(message);
    this.jumpDetector.resetAll();
  }

  private activateWorkout() {
    this.status = 'ACTIVE';
    this.startTime = new Date().toISOString();
    this.lastJumpOrActivityTime = 0;
    this.trackingLostFrames = 0;
    this.callbacks.onStatusChange(this.status);
    this.callbacks.onCountChange(0);
  }

  public finishWorkout(): WorkoutSessionData {
    if (this.countdownTimerId) {
      clearInterval(this.countdownTimerId);
      this.countdownTimerId = null;
    }

    this.status = 'FINISHED';
    this.callbacks.onStatusChange(this.status);

    const endTime = new Date().toISOString();
    const activeSec = this.timer.activeSeconds;
    const restSec = this.timer.restSeconds;
    const totalSec = this.timer.totalSeconds;
    const totalJumps = this.jumpDetector.totalJumps;

    const avgPace = activeSec > 0 ? Math.round((totalJumps / (activeSec / 60.0)) * 10) / 10 : 0;
    const maxPace = this.timer.maxPace;

    const sessionData: WorkoutSessionData = {
      start_time: this.startTime || new Date(Date.now() - totalSec * 1000).toISOString(),
      end_time: endTime,
      session_date: new Date().toISOString().split('T')[0],
      total_jumps: totalJumps,
      active_duration_seconds: activeSec,
      rest_duration_seconds: restSec,
      total_duration_seconds: totalSec,
      average_jumps_per_minute: avgPace,
      max_jumps_per_minute: maxPace,
      created_at: endTime,
    };

    this.callbacks.onWorkoutComplete(sessionData);
    return sessionData;
  }

  public reset() {
    if (this.countdownTimerId) {
      clearInterval(this.countdownTimerId);
      this.countdownTimerId = null;
    }
    this.status = 'IDLE';
    this.trackingLostFrames = 0;
    this.jumpDetector.resetAll();
    this.poseProcessor.reset();
    this.timer.reset();
  }
}
