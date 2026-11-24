import { NormalizedLandmark } from '../../types/pose';
import { MovementSmoother } from '../../counter/movementSmoother';
import { PushUpConfig, DEFAULT_PUSHUP_CONFIG } from './pushUpConfig';
import { PushUpProcessor } from './pushUpProcessor';
import { PushUpStateMachine } from './pushUpStateMachine';
import { pushUpSound } from './pushUpSound';
import {
  PushUpCalibrationData,
  PushUpCalibrationState,
  PushUpDebugInfo,
  PushUpMode,
} from './pushUpTypes';

export interface PushUpDetectorOptions {
  mode?: PushUpMode;
  config?: Partial<PushUpConfig>;
}

export class PushUpDetector {
  private config: PushUpConfig;
  private mode: PushUpMode;
  private stateMachine: PushUpStateMachine;

  // Smoothers for metrics to prevent jitter
  private elbowAngleSmoother: MovementSmoother;
  private shoulderSpanSmoother: MovementSmoother;

  // Calibration state
  private calibrationState: PushUpCalibrationState = 'INSTRUCTION';
  private calibrationData: PushUpCalibrationData = {
    topShoulderSpan: 0.24,
    bottomShoulderSpan: 0.44,
    topElbowAngle: 165,
    bottomElbowAngle: 85,
    proximityRange: 0.20,
    isCalibrated: false,
  };
  private topCalibrationSamples: { span: number; angle: number }[] = [];
  private bottomCalibrationSamples: { span: number; angle: number }[] = [];

  private repCount = 0;
  private targetReps: number | null = 10;
  private targetReached = false;

  private workoutStartTime = 0;
  private lastDebugInfo: PushUpDebugInfo;

  constructor(options: PushUpDetectorOptions = {}) {
    this.mode = options.mode || '10';
    this.targetReps = this.mode === 'freedom' ? null : parseInt(this.mode, 10);
    this.config = { ...DEFAULT_PUSHUP_CONFIG, ...options.config };

    this.stateMachine = new PushUpStateMachine(this.config);
    this.elbowAngleSmoother = new MovementSmoother(this.config.emaAlpha);
    this.shoulderSpanSmoother = new MovementSmoother(this.config.emaAlpha);

    this.lastDebugInfo = {
      state: 'READY',
      completedReps: 0,
      targetReps: this.targetReps,
      mode: this.mode,
      avgElbowAngle: 180,
      shoulderSpan: 0,
      proximityScore: 0,
      stateDurationMs: 0,
      repPaceRpm: 0,
      lastRejectionReason: 'None',
      isCalibrated: false,
      statusMessage: 'READY',
    };
  }

  public get completedReps(): number {
    return this.repCount;
  }

  public get isTargetReached(): boolean {
    return this.targetReached;
  }

  public get currentMode(): PushUpMode {
    return this.mode;
  }

  public get currentTargetReps(): number | null {
    return this.targetReps;
  }

  public get currentCalibrationState(): PushUpCalibrationState {
    return this.calibrationState;
  }

  public get calibration(): PushUpCalibrationData {
    return this.calibrationData;
  }

  public get debugInfo(): PushUpDebugInfo {
    return this.lastDebugInfo;
  }

  public setMode(mode: PushUpMode) {
    this.mode = mode;
    this.targetReps = mode === 'freedom' ? null : parseInt(mode, 10);
    this.targetReached = false;
  }

  public setCalibrationState(state: PushUpCalibrationState) {
    this.calibrationState = state;
    if (state === 'CALIBRATING_TOP') {
      this.topCalibrationSamples = [];
    } else if (state === 'CALIBRATING_BOTTOM') {
      this.bottomCalibrationSamples = [];
    }
  }

  /**
   * Feed calibration samples during the calibration steps.
   */
  public addCalibrationSample(landmarks: NormalizedLandmark[], timestampMs: number): boolean {
    const rawMetrics = PushUpProcessor.processFrame(
      landmarks,
      timestampMs,
      this.calibrationData,
      this.config
    );
    if (!rawMetrics.isBodyVisible) return false;

    if (this.calibrationState === 'CALIBRATING_TOP') {
      this.topCalibrationSamples.push({
        span: rawMetrics.shoulderSpan,
        angle: rawMetrics.avgElbowAngle,
      });
      if (this.topCalibrationSamples.length >= 15) {
        // Compute average top baseline
        const avgSpan =
          this.topCalibrationSamples.reduce((s, x) => s + x.span, 0) /
          this.topCalibrationSamples.length;
        const avgAngle =
          this.topCalibrationSamples.reduce((s, x) => s + x.angle, 0) /
          this.topCalibrationSamples.length;

        this.calibrationData.topShoulderSpan = avgSpan;
        this.calibrationData.topElbowAngle = avgAngle;
        return true; // Finished top calibration step
      }
    } else if (this.calibrationState === 'CALIBRATING_BOTTOM') {
      this.bottomCalibrationSamples.push({
        span: rawMetrics.shoulderSpan,
        angle: rawMetrics.avgElbowAngle,
      });
      if (this.bottomCalibrationSamples.length >= 15) {
        // Pick max shoulder span and min elbow angle from practice rep
        const maxSpan = Math.max(...this.bottomCalibrationSamples.map((x) => x.span));
        const minAngle = Math.min(...this.bottomCalibrationSamples.map((x) => x.angle));

        this.calibrationData.bottomShoulderSpan = maxSpan;
        this.calibrationData.bottomElbowAngle = minAngle;
        this.calibrationData.proximityRange = Math.max(
          0.05,
          maxSpan - this.calibrationData.topShoulderSpan
        );
        this.calibrationData.isCalibrated = true;
        this.calibrationState = 'COMPLETED';
        return true; // Finished bottom calibration step
      }
    }

    return false;
  }

  /**
   * Processes a video frame during an active workout session.
   * Returns true if a repetition was just counted.
   */
  public processFrame(landmarks: NormalizedLandmark[], timestampMs: number): boolean {
    if (this.targetReached) {
      return false;
    }

    if (this.workoutStartTime === 0) {
      this.workoutStartTime = timestampMs;
    }

    const rawMetrics = PushUpProcessor.processFrame(
      landmarks,
      timestampMs,
      this.calibrationData,
      this.config
    );

    // Apply EMA smoothing to elbow angle and shoulder span
    const smoothedAngle = this.elbowAngleSmoother.update(rawMetrics.avgElbowAngle, timestampMs).smoothed;
    const smoothedSpan = this.shoulderSpanSmoother.update(rawMetrics.shoulderSpan, timestampMs).smoothed;

    // Recalculate proximity score with smoothed shoulder span
    let smoothedProximity = rawMetrics.proximityScore;
    if (this.calibrationData.isCalibrated && this.calibrationData.proximityRange > 0.02) {
      const delta = smoothedSpan - this.calibrationData.topShoulderSpan;
      smoothedProximity = Math.max(
        0,
        Math.min(1.5, delta / this.calibrationData.proximityRange)
      );
    }

    const smoothedMetrics = {
      ...rawMetrics,
      avgElbowAngle: smoothedAngle,
      shoulderSpan: smoothedSpan,
      proximityScore: smoothedProximity,
    };

    const repCompleted = this.stateMachine.step(smoothedMetrics);

    if (repCompleted) {
      this.repCount++;
      pushUpSound.playRepTick();

      // Check if target reps completed in 10 / 20 / 30 mode
      if (this.targetReps !== null && this.repCount >= this.targetReps) {
        this.targetReached = true;
        pushUpSound.playTargetFanfare();
      }
    }

    // Calculate current rep pace (reps per minute)
    const elapsedMinutes = (timestampMs - this.workoutStartTime) / 60000;
    const repPaceRpm = elapsedMinutes > 0 ? this.repCount / elapsedMinutes : 0;

    this.lastDebugInfo = {
      state: this.stateMachine.state,
      completedReps: this.repCount,
      targetReps: this.targetReps,
      mode: this.mode,
      avgElbowAngle: smoothedAngle,
      shoulderSpan: smoothedSpan,
      proximityScore: smoothedProximity,
      stateDurationMs: timestampMs - this.stateMachine.lastRepTime,
      repPaceRpm,
      lastRejectionReason: this.stateMachine.rejectionReason,
      isCalibrated: this.calibrationData.isCalibrated,
      statusMessage: this.stateMachine.message,
    };

    return repCompleted;
  }

  public reset() {
    this.repCount = 0;
    this.targetReached = false;
    this.workoutStartTime = 0;
    this.stateMachine.reset();
    this.elbowAngleSmoother.reset();
    this.shoulderSpanSmoother.reset();
  }
}
