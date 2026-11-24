import { NormalizedLandmark, POSE_LANDMARKS, JumpDebugInfo } from '../types/pose';
import { MovementSmoother } from './movementSmoother';
import { JumpStateMachine } from './stateMachine';
import { JumpConfig, DEFAULT_JUMP_CONFIG } from '../config/jumpConfig';

export interface JumpDetectorOptions {
  config?: Partial<JumpConfig>;
}

export class JumpDetector {
  private config: JumpConfig;
  private stateMachine: JumpStateMachine;
  private hipSmoother: MovementSmoother;
  private lowerSmoother: MovementSmoother;

  // Static calibration references
  private baselineHipY: number | null = null;
  private _baselineLowerY: number | null = null;
  private baselineTorsoLength: number | null = null;
  private calibrationSamples: { hipY: number; lowerY: number; torso: number }[] = [];
  private isCalibrated = false;

  // Dynamic ground baseline that adapts to jumping on balls of feet / stance shifts
  private dynamicHipY: number | null = null;
  private dynamicLowerY: number | null = null;
  private dynamicLeftFootY: number | null = null;
  private dynamicRightFootY: number | null = null;

  private jumpCount = 0;
  private lastDebugInfo: JumpDebugInfo;
  private frameCount = 0;
  private lastFpsTimestamp = 0;
  private currentFps = 0;
  private inferenceCount = 0;
  private lastInferenceTimestamp = 0;
  private currentInferenceFps = 0;

  constructor(options: JumpDetectorOptions = {}) {
    this.config = { ...DEFAULT_JUMP_CONFIG, ...options.config };
    this.stateMachine = new JumpStateMachine(this.config);
    this.hipSmoother = new MovementSmoother(this.config.emaAlpha);
    this.lowerSmoother = new MovementSmoother(this.config.emaAlpha);

    this.lastDebugInfo = {
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
      threshold: this.config.airborneThresholdNorm,
      fps: 0,
      inferenceFps: 0,
      lastRejectionReason: 'None',
      movementDirection: 'STABLE',
      recentTransitions: [],
    };
  }

  public get totalJumps(): number {
    return this.jumpCount;
  }

  public get initialBaselineLowerY(): number {
    return this._baselineLowerY ?? 0;
  }

  public get calibrated(): boolean {
    return this.isCalibrated;
  }

  public get debugInfo(): JumpDebugInfo {
    return this.lastDebugInfo;
  }

  public get currentConfig(): JumpConfig {
    return this.config;
  }

  public updateConfig(newConfig: Partial<JumpConfig>) {
    this.config = { ...this.config, ...newConfig };
    this.stateMachine.updateConfig(this.config);
    this.hipSmoother.setAlpha(this.config.emaAlpha);
    this.lowerSmoother.setAlpha(this.config.emaAlpha);
  }

  /**
   * Resets counter and state machine without clearing calibration
   */
  public resetCount() {
    this.jumpCount = 0;
    this.stateMachine.reset();
  }

  /**
   * Resets full detector including calibration
   */
  public resetAll() {
    this.jumpCount = 0;
    this.isCalibrated = false;
    this.baselineHipY = null;
    this._baselineLowerY = null;
    this.baselineTorsoLength = null;
    this.dynamicHipY = null;
    this.dynamicLowerY = null;
    this.dynamicLeftFootY = null;
    this.dynamicRightFootY = null;
    this.calibrationSamples = [];
    this.stateMachine.reset();
    this.hipSmoother.reset();
    this.lowerSmoother.reset();
  }

  /**
   * Calibrates standing baseline using consecutive standing frames.
   */
  public addCalibrationFrame(landmarks: NormalizedLandmark[]): boolean {
    const confidence = this.getLowerBodyConfidence(landmarks);
    if (confidence < this.config.minLandmarkVisibility) return false;

    const leftHip = landmarks[POSE_LANDMARKS.LEFT_HIP];
    const rightHip = landmarks[POSE_LANDMARKS.RIGHT_HIP];
    const leftAnkle = landmarks[POSE_LANDMARKS.LEFT_ANKLE];
    const rightAnkle = landmarks[POSE_LANDMARKS.RIGHT_ANKLE];
    const leftShoulder = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
    const rightShoulder = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];

    const hipMid = this.getMidpoint(leftHip, rightHip);
    const ankleMid = this.getMidpoint(leftAnkle, rightAnkle);
    const shoulderMid = this.getMidpoint(leftShoulder, rightShoulder);

    const torsoLength = Math.hypot(hipMid.x - shoulderMid.x, hipMid.y - shoulderMid.y);
    if (torsoLength < 0.05) return false;

    this.calibrationSamples.push({
      hipY: hipMid.y,
      lowerY: ankleMid.y,
      torso: torsoLength,
    });

    // 15 stable frames lock in calibration
    if (this.calibrationSamples.length >= 15) {
      const avgHip =
        this.calibrationSamples.reduce((sum, s) => sum + s.hipY, 0) /
        this.calibrationSamples.length;
      const avgLower =
        this.calibrationSamples.reduce((sum, s) => sum + s.lowerY, 0) /
        this.calibrationSamples.length;
      const avgTorso =
        this.calibrationSamples.reduce((sum, s) => sum + s.torso, 0) /
        this.calibrationSamples.length;

      this.baselineHipY = avgHip;
      this._baselineLowerY = avgLower;
      this.baselineTorsoLength = avgTorso;

      // Initialize dynamic baseline to initial standing height
      this.dynamicHipY = avgHip;
      this.dynamicLowerY = avgLower;
      this.dynamicLeftFootY = leftAnkle.y;
      this.dynamicRightFootY = rightAnkle.y;

      this.isCalibrated = true;
      this.hipSmoother.reset(avgHip);
      this.lowerSmoother.reset(avgLower);
      return true;
    }

    return false;
  }

  /**
   * Sets baseline manually (for testing or predefined setups)
   */
  public setBaseline(baselineHipY: number, baselineLowerY: number, torsoLength: number) {
    this.baselineHipY = baselineHipY;
    this._baselineLowerY = baselineLowerY;
    this.baselineTorsoLength = torsoLength;
    this.dynamicHipY = baselineHipY;
    this.dynamicLowerY = baselineLowerY;
    this.dynamicLeftFootY = baselineLowerY;
    this.dynamicRightFootY = baselineLowerY;
    this.isCalibrated = true;
    this.hipSmoother.reset(baselineHipY);
    this.lowerSmoother.reset(baselineLowerY);
  }

  /**
   * Processes a video frame containing detected pose landmarks.
   */
  public processFrame(landmarks: NormalizedLandmark[], timestampMs: number): boolean {
    this.updateFps(timestampMs);
    this.updateInferenceFps(timestampMs);

    // 1. Verify confidence of lower-body landmarks
    const confidence = this.getLowerBodyConfidence(landmarks);
    if (confidence < this.config.minLandmarkVisibility) {
      this.updateDebugInfo(0, 0, 0, 0, confidence, timestampMs, 'Rejected: low landmark visibility');
      return false;
    }

    if (!this.isCalibrated || this.dynamicHipY === null || this.dynamicLowerY === null || !this.baselineTorsoLength) {
      this.updateDebugInfo(0, 0, 0, 0, confidence, timestampMs, 'Rejected: not calibrated');
      return false;
    }

    // 2. Extract landmark positions
    const leftHip = landmarks[POSE_LANDMARKS.LEFT_HIP];
    const rightHip = landmarks[POSE_LANDMARKS.RIGHT_HIP];
    const leftAnkle = landmarks[POSE_LANDMARKS.LEFT_ANKLE];
    const rightAnkle = landmarks[POSE_LANDMARKS.RIGHT_ANKLE];
    const leftHeel = landmarks[POSE_LANDMARKS.LEFT_HEEL] || leftAnkle;
    const rightHeel = landmarks[POSE_LANDMARKS.RIGHT_HEEL] || rightAnkle;
    const leftFootIdx = landmarks[POSE_LANDMARKS.LEFT_FOOT_INDEX] || leftAnkle;
    const rightFootIdx = landmarks[POSE_LANDMARKS.RIGHT_FOOT_INDEX] || rightAnkle;
    const leftShoulder = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
    const rightShoulder = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];

    const rawHipY = (leftHip.y + rightHip.y) / 2.0;

    // Weighted lower-limb height: incorporates ankles (50%), heels (30%), and foot indices (20%)
    const rawLeftFoot = 0.5 * leftAnkle.y + 0.3 * leftHeel.y + 0.2 * leftFootIdx.y;
    const rawRightFoot = 0.5 * rightAnkle.y + 0.3 * rightHeel.y + 0.2 * rightFootIdx.y;
    const rawLowerY = (rawLeftFoot + rawRightFoot) / 2.0;

    // Torso length scale normalization
    const shoulderMid = this.getMidpoint(leftShoulder, rightShoulder);
    const hipMid = this.getMidpoint(leftHip, rightHip);
    const currentTorso = Math.hypot(hipMid.x - shoulderMid.x, hipMid.y - shoulderMid.y);
    const torsoScale = Math.max(0.1, currentTorso || this.baselineTorsoLength);

    // 3. Smooth coordinates & calculate velocity
    const hipResult = this.hipSmoother.update(rawHipY, timestampMs);
    const lowerResult = this.lowerSmoother.update(rawLowerY, timestampMs);

    // Coordinate system: y goes down (0 = top, 1 = bottom).
    // Upward displacement = (dynamicBaselineY - currentSmoothedY) / torsoScale
    const hipDisplacementNorm = (this.dynamicHipY - hipResult.smoothed) / torsoScale;
    const lowerDisplacementNorm = (this.dynamicLowerY - lowerResult.smoothed) / torsoScale;

    // Upward velocity (positive = moving up, negative = descending)
    const hipVelocityUpward = -hipResult.velocity / torsoScale;
    const lowerVelocityUpward = -lowerResult.velocity / torsoScale;
    const combinedVelocityUpward =
      this.config.hipWeight * hipVelocityUpward + this.config.ankleWeight * lowerVelocityUpward;

    // Combined displacement signal
    const combinedDisplacement =
      this.config.hipWeight * hipDisplacementNorm + this.config.ankleWeight * lowerDisplacementNorm;

    // 4. Anti-False Detection Checks

    // Check A: Squatting / Bending knees
    // In squatting, hips drop DOWN (hipDisplacementNorm is negative, hips drop towards ankles while ankles stay flat).
    if (hipDisplacementNorm < -0.035 && lowerDisplacementNorm < 0.02) {
      this.updateDebugInfo(
        combinedDisplacement,
        combinedVelocityUpward,
        hipVelocityUpward,
        lowerVelocityUpward,
        confidence,
        timestampMs,
        'Rejected: knee bend / squatting (downward hip displacement)',
        hipResult.smoothed,
        lowerResult.smoothed
      );
      return false;
    }

    // Check B: Walking / Asymmetric leg lift
    // In walking, one foot lifts while the other is planted flat, with minimal hip lift
    const leftLift = (this.dynamicLeftFootY! - rawLeftFoot) / torsoScale;
    const rightLift = (this.dynamicRightFootY! - rawRightFoot) / torsoScale;
    const footLiftDiff = Math.abs(leftLift - rightLift);

    if (footLiftDiff > 0.055 && hipDisplacementNorm < 0.035) {
      this.updateDebugInfo(
        combinedDisplacement,
        combinedVelocityUpward,
        hipVelocityUpward,
        lowerVelocityUpward,
        confidence,
        timestampMs,
        'Rejected: walking / asymmetric foot movement',
        hipResult.smoothed,
        lowerResult.smoothed
      );
      return false;
    }

    // Both feet airborne indicator
    const minFootLift = Math.min(leftLift, rightLift);
    const bothFeetAirborne =
      (minFootLift > 0.025 && combinedDisplacement > 0.04) ||
      combinedDisplacement >= this.config.airborneThresholdNorm * 1.1;

    // 5. Dynamic Grounded Baseline Envelope Adaptation
    // When the user is grounded or landing, adapt baseline towards local ground contact
    if (
      (this.stateMachine.state === 'GROUNDED' || this.stateMachine.state === 'LANDING') &&
      combinedDisplacement < 0.045 &&
      Math.abs(combinedVelocityUpward) < 0.15
    ) {
      const adapt = this.config.dynamicBaselineAdaptRate; // e.g. 0.05
      this.dynamicHipY = (1.0 - adapt) * this.dynamicHipY + adapt * hipResult.smoothed;
      this.dynamicLowerY = (1.0 - adapt) * this.dynamicLowerY + adapt * lowerResult.smoothed;
      this.dynamicLeftFootY = (1.0 - adapt) * this.dynamicLeftFootY! + adapt * rawLeftFoot;
      this.dynamicRightFootY = (1.0 - adapt) * this.dynamicRightFootY! + adapt * rawRightFoot;
    }

    // 6. Update State Machine
    const jumpCounted = this.stateMachine.step(
      combinedDisplacement,
      combinedVelocityUpward,
      timestampMs,
      bothFeetAirborne,
      confidence
    );

    if (jumpCounted) {
      this.jumpCount++;
    }

    // 7. Update Debug Info
    this.updateDebugInfo(
      combinedDisplacement,
      combinedVelocityUpward,
      hipVelocityUpward,
      lowerVelocityUpward,
      confidence,
      timestampMs,
      this.stateMachine.rejectionReason,
      hipResult.smoothed,
      lowerResult.smoothed
    );

    return jumpCounted;
  }

  private updateFps(timestampMs: number) {
    this.frameCount++;
    if (this.lastFpsTimestamp === 0) {
      this.lastFpsTimestamp = timestampMs;
    } else {
      const elapsed = timestampMs - this.lastFpsTimestamp;
      if (elapsed >= 1000) {
        this.currentFps = Math.round((this.frameCount * 1000) / elapsed);
        this.frameCount = 0;
        this.lastFpsTimestamp = timestampMs;
      }
    }
  }

  private updateInferenceFps(timestampMs: number) {
    this.inferenceCount++;
    if (this.lastInferenceTimestamp === 0) {
      this.lastInferenceTimestamp = timestampMs;
    } else {
      const elapsed = timestampMs - this.lastInferenceTimestamp;
      if (elapsed >= 1000) {
        this.currentInferenceFps = Math.round((this.inferenceCount * 1000) / elapsed);
        this.inferenceCount = 0;
        this.lastInferenceTimestamp = timestampMs;
      }
    }
  }

  private updateDebugInfo(
    displacementNorm: number,
    velocity: number,
    hipVelocity: number,
    ankleVelocity: number,
    confidence: number,
    timestampMs: number,
    rejectionReason: string,
    hipY?: number,
    ankleY?: number
  ) {
    const timeSinceLastJump =
      this.stateMachine.lastJumpTime > 0 ? timestampMs - this.stateMachine.lastJumpTime : 0;

    const direction: 'UP' | 'DOWN' | 'STABLE' =
      velocity > 0.06 ? 'UP' : velocity < -0.06 ? 'DOWN' : 'STABLE';

    this.lastDebugInfo = {
      state: this.stateMachine.state,
      totalJumps: this.jumpCount,
      hipY: hipY ?? this.hipSmoother.current,
      ankleY: ankleY ?? this.lowerSmoother.current,
      baselineHipY: this.baselineHipY ?? 0,
      dynamicBaselineY: this.dynamicHipY ?? 0,
      displacementNorm,
      velocity,
      hipVelocity,
      ankleVelocity,
      landmarkConfidence: confidence,
      isAirborne: this.stateMachine.state === 'AIRBORNE',
      airborneDurationMs: this.stateMachine.airborneDuration,
      lastJumpTime: this.stateMachine.lastJumpTime,
      timeSinceLastJumpMs: Math.round(timeSinceLastJump),
      threshold: this.config.airborneThresholdNorm,
      fps: this.currentFps,
      inferenceFps: this.currentInferenceFps,
      lastRejectionReason: rejectionReason,
      movementDirection: direction,
      recentTransitions: this.stateMachine.transitions,
    };
  }

  private getLowerBodyConfidence(landmarks: NormalizedLandmark[]): number {
    const requiredIndices = [
      POSE_LANDMARKS.LEFT_HIP,
      POSE_LANDMARKS.RIGHT_HIP,
      POSE_LANDMARKS.LEFT_KNEE,
      POSE_LANDMARKS.RIGHT_KNEE,
      POSE_LANDMARKS.LEFT_ANKLE,
      POSE_LANDMARKS.RIGHT_ANKLE,
    ];

    let totalConf = 0;
    for (const idx of requiredIndices) {
      const lm = landmarks[idx];
      if (!lm) return 0;
      const vis = lm.visibility !== undefined ? lm.visibility : 1.0;
      totalConf += vis;
    }
    return totalConf / requiredIndices.length;
  }

  private getMidpoint(a: NormalizedLandmark, b: NormalizedLandmark): { x: number; y: number } {
    return {
      x: (a.x + b.x) / 2.0,
      y: (a.y + b.y) / 2.0,
    };
  }
}
