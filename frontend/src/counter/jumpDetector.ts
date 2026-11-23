import { NormalizedLandmark, POSE_LANDMARKS, JumpDebugInfo } from '../types/pose';
import { MovementSmoother } from './movementSmoother';
import { JumpStateMachine, StateMachineConfig } from './stateMachine';

export interface JumpDetectorOptions {
  minLandmarkConfidence?: number;
  stateMachineConfig?: Partial<StateMachineConfig>;
}

export class JumpDetector {
  private stateMachine: JumpStateMachine;
  private hipSmoother: MovementSmoother;
  private ankleSmoother: MovementSmoother;

  private minConfidence: number;
  private baselineHipY: number | null = null;
  private baselineAnkleY: number | null = null;
  private baselineTorsoLength: number | null = null;
  private calibrationSamples: { hipY: number; ankleY: number; torso: number }[] = [];
  private isCalibrated = false;

  private jumpCount = 0;
  private lastDebugInfo: JumpDebugInfo;
  private frameCount = 0;
  private lastFpsTimestamp = 0;
  private currentFps = 0;

  constructor(options: JumpDetectorOptions = {}) {
    this.minConfidence = options.minLandmarkConfidence ?? 0.5;
    this.stateMachine = new JumpStateMachine(options.stateMachineConfig);
    this.hipSmoother = new MovementSmoother(0.4);
    this.ankleSmoother = new MovementSmoother(0.4);

    this.lastDebugInfo = {
      state: 'GROUNDED',
      hipY: 0,
      ankleY: 0,
      baselineHipY: 0,
      displacementNorm: 0,
      velocity: 0,
      landmarkConfidence: 0,
      isAirborne: false,
      lastJumpTime: 0,
      threshold: 0.16,
      fps: 0,
    };
  }

  public get totalJumps(): number {
    return this.jumpCount;
  }

  public get calibrated(): boolean {
    return this.isCalibrated;
  }

  public get debugInfo(): JumpDebugInfo {
    return this.lastDebugInfo;
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
    this.baselineAnkleY = null;
    this.baselineTorsoLength = null;
    this.calibrationSamples = [];
    this.stateMachine.reset();
    this.hipSmoother.reset();
    this.ankleSmoother.reset();
  }

  /**
   * Calibrates standing baseline using consecutive standing frames.
   */
  public addCalibrationFrame(landmarks: NormalizedLandmark[]): boolean {
    const confidence = this.getLowerBodyConfidence(landmarks);
    if (confidence < this.minConfidence) return false;

    const hipMid = this.getMidpoint(
      landmarks[POSE_LANDMARKS.LEFT_HIP],
      landmarks[POSE_LANDMARKS.RIGHT_HIP]
    );
    const ankleMid = this.getMidpoint(
      landmarks[POSE_LANDMARKS.LEFT_ANKLE],
      landmarks[POSE_LANDMARKS.RIGHT_ANKLE]
    );
    const shoulderMid = this.getMidpoint(
      landmarks[POSE_LANDMARKS.LEFT_SHOULDER],
      landmarks[POSE_LANDMARKS.RIGHT_SHOULDER]
    );

    const torsoLength = Math.hypot(hipMid.x - shoulderMid.x, hipMid.y - shoulderMid.y);
    if (torsoLength < 0.05) return false;

    this.calibrationSamples.push({
      hipY: hipMid.y,
      ankleY: ankleMid.y,
      torso: torsoLength,
    });

    // Need 15 stable frames to lock in baseline
    if (this.calibrationSamples.length >= 15) {
      const avgHip =
        this.calibrationSamples.reduce((sum, s) => sum + s.hipY, 0) /
        this.calibrationSamples.length;
      const avgAnkle =
        this.calibrationSamples.reduce((sum, s) => sum + s.ankleY, 0) /
        this.calibrationSamples.length;
      const avgTorso =
        this.calibrationSamples.reduce((sum, s) => sum + s.torso, 0) /
        this.calibrationSamples.length;

      this.baselineHipY = avgHip;
      this.baselineAnkleY = avgAnkle;
      this.baselineTorsoLength = avgTorso;
      this.isCalibrated = true;
      this.hipSmoother.reset(avgHip);
      this.ankleSmoother.reset(avgAnkle);
      return true;
    }

    return false;
  }

  /**
   * Sets baseline manually (useful for tests or predefined calibration)
   */
  public setBaseline(baselineHipY: number, baselineAnkleY: number, torsoLength: number) {
    this.baselineHipY = baselineHipY;
    this.baselineAnkleY = baselineAnkleY;
    this.baselineTorsoLength = torsoLength;
    this.isCalibrated = true;
    this.hipSmoother.reset(baselineHipY);
    this.ankleSmoother.reset(baselineAnkleY);
  }

  /**
   * Processes a video frame containing detected pose landmarks.
   * @param landmarks 33 MediaPipe pose landmarks
   * @param timestampMs Frame timestamp in milliseconds
   * @returns boolean true if a jump was completed and counted in this frame
   */
  public processFrame(landmarks: NormalizedLandmark[], timestampMs: number): boolean {
    this.updateFps(timestampMs);

    // 1. Verify confidence of essential lower-body landmarks
    const confidence = this.getLowerBodyConfidence(landmarks);
    if (confidence < this.minConfidence) {
      this.updateDebugInfo(0, 0, confidence, timestampMs);
      return false;
    }

    // Must be calibrated before jumping
    if (!this.isCalibrated || this.baselineHipY === null || !this.baselineTorsoLength) {
      this.updateDebugInfo(0, 0, confidence, timestampMs);
      return false;
    }

    // 2. Extract key landmark positions
    const leftHip = landmarks[POSE_LANDMARKS.LEFT_HIP];
    const rightHip = landmarks[POSE_LANDMARKS.RIGHT_HIP];
    const leftAnkle = landmarks[POSE_LANDMARKS.LEFT_ANKLE];
    const rightAnkle = landmarks[POSE_LANDMARKS.RIGHT_ANKLE];
    const leftShoulder = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
    const rightShoulder = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];

    const rawHipY = (leftHip.y + rightHip.y) / 2.0;
    const rawAnkleY = (leftAnkle.y + rightAnkle.y) / 2.0;

    // Current torso length to normalize scale
    const shoulderMid = this.getMidpoint(leftShoulder, rightShoulder);
    const hipMid = this.getMidpoint(leftHip, rightHip);
    const currentTorso = Math.hypot(hipMid.x - shoulderMid.x, hipMid.y - shoulderMid.y);
    const torsoScale = Math.max(0.1, currentTorso || this.baselineTorsoLength);

    // 3. Smooth coordinates & calculate velocity
    const hipResult = this.hipSmoother.update(rawHipY, timestampMs);
    const ankleResult = this.ankleSmoother.update(rawAnkleY, timestampMs);

    // Coordinate system: y goes down (0 at top, 1 at bottom).
    // An upward jump means current y < baseline y.
    // Upward displacement = (baselineHipY - hipResult.smoothed) / torsoScale
    const hipDisplacementNorm = (this.baselineHipY - hipResult.smoothed) / torsoScale;
    const ankleDisplacementNorm = (this.baselineAnkleY! - ankleResult.smoothed) / torsoScale;

    // Upward velocity (positive when moving up): rate of change of upward displacement
    // Since y is inverted: v_up = - hipResult.velocity / torsoScale
    const velocityUpward = -hipResult.velocity / torsoScale;

    // 4. Combined displacement: requires hips to lift AND ankles to lift
    // In rope skipping, body lifts as a whole.
    // Combined displacement prioritizes synchronized vertical lift
    const combinedDisplacement = 0.6 * hipDisplacementNorm + 0.4 * ankleDisplacementNorm;

    // 5. Anti-false detection checks
    // Check A: Squatting / Bending knees:
    // When bending knees, hips move DOWN (hipDisplacementNorm is negative), while ankles remain flat.
    // So if combinedDisplacement < 0.02, it is not an upward jump.
    // Check B: Walking / Step-ups:
    // In walking, one ankle lifts while the other is grounded (asymmetric).
    // We check that both feet/ankles lift off the ground.
    const leftAnkleLift = (this.baselineAnkleY! - leftAnkle.y) / torsoScale;
    const rightAnkleLift = (this.baselineAnkleY! - rightAnkle.y) / torsoScale;
    const minAnkleLift = Math.min(leftAnkleLift, rightAnkleLift);
    const bothFeetAirborne = minAnkleLift > 0.05 && combinedDisplacement > 0.10;

    // 6. Adaptive baseline drift compensation when grounded
    // If the user has been solidly grounded and stable for a while, slowly adjust baseline (0.5% drift)
    if (
      this.stateMachine.state === 'GROUNDED' &&
      Math.abs(hipDisplacementNorm) < 0.04 &&
      Math.abs(velocityUpward) < 0.1
    ) {
      this.baselineHipY = 0.995 * this.baselineHipY + 0.005 * hipResult.smoothed;
      this.baselineAnkleY = 0.995 * this.baselineAnkleY! + 0.005 * ankleResult.smoothed;
    }

    // 7. Update State Machine
    const jumpCounted = this.stateMachine.step(
      combinedDisplacement,
      velocityUpward,
      timestampMs,
      bothFeetAirborne
    );

    if (jumpCounted) {
      this.jumpCount++;
    }

    // 8. Update debug info
    this.updateDebugInfo(
      combinedDisplacement,
      velocityUpward,
      confidence,
      timestampMs,
      hipResult.smoothed,
      ankleResult.smoothed
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

  private updateDebugInfo(
    displacementNorm: number,
    velocity: number,
    confidence: number,
    _timestampMs: number,
    hipY?: number,
    ankleY?: number
  ) {
    this.lastDebugInfo = {
      state: this.stateMachine.state,
      hipY: hipY ?? this.hipSmoother.current,
      ankleY: ankleY ?? this.ankleSmoother.current,
      baselineHipY: this.baselineHipY ?? 0,
      displacementNorm,
      velocity,
      landmarkConfidence: confidence,
      isAirborne: this.stateMachine.state === 'AIRBORNE',
      lastJumpTime: this.stateMachine.lastJumpTime,
      threshold: 0.16,
      fps: this.currentFps,
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
      // Default to 1.0 if visibility is undefined (e.g. synthetic data)
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
