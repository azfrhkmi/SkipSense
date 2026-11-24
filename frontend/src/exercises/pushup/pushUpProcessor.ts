import { NormalizedLandmark, POSE_LANDMARKS } from '../../types/pose';
import { PushUpConfig } from './pushUpConfig';
import { PushUpCalibrationData, PushUpFrameMetrics } from './pushUpTypes';

export class PushUpProcessor {
  /**
   * Calculates the 2D angle (in degrees) formed by points A-B-C with B as vertex.
   * e.g., Shoulder -> Elbow -> Wrist gives elbow flexion/extension angle.
   */
  public static calculateAngle(
    a: NormalizedLandmark,
    b: NormalizedLandmark,
    c: NormalizedLandmark
  ): number {
    const v1 = { x: a.x - b.x, y: a.y - b.y };
    const v2 = { x: c.x - b.x, y: c.y - b.y };

    const dot = v1.x * v2.x + v1.y * v2.y;
    const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
    const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);

    if (mag1 === 0 || mag2 === 0) return 180;

    const cosTheta = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
    return (Math.acos(cosTheta) * 180) / Math.PI;
  }

  /**
   * Calculates Euclidean distance between two landmarks in normalized screen space.
   */
  public static distance2D(a: NormalizedLandmark, b: NormalizedLandmark): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Extracts push-up frame metrics from MediaPipe pose landmarks.
   */
  public static processFrame(
    landmarks: NormalizedLandmark[],
    timestampMs: number,
    calibration: PushUpCalibrationData,
    config: PushUpConfig
  ): PushUpFrameMetrics {
    if (!landmarks || landmarks.length < 33) {
      return {
        timestampMs,
        leftElbowAngle: 180,
        rightElbowAngle: 180,
        avgElbowAngle: 180,
        shoulderSpan: 0,
        proximityScore: 0,
        headProximity: 0,
        isBodyVisible: false,
        confidence: 0,
        landmarks: [],
      };
    }

    const nose = landmarks[POSE_LANDMARKS.NOSE];
    const leftShoulder = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
    const rightShoulder = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];
    const leftElbow = landmarks[POSE_LANDMARKS.LEFT_ELBOW];
    const rightElbow = landmarks[POSE_LANDMARKS.RIGHT_ELBOW];
    const leftWrist = landmarks[POSE_LANDMARKS.LEFT_WRIST];
    const rightWrist = landmarks[POSE_LANDMARKS.RIGHT_WRIST];

    const keyLandmarks = [
      leftShoulder,
      rightShoulder,
      leftElbow,
      rightElbow,
      leftWrist,
      rightWrist,
    ];

    let totalVis = 0;
    let visibleCount = 0;
    for (const lm of keyLandmarks) {
      const vis = lm.visibility ?? 1.0;
      totalVis += vis;
      if (vis >= config.minLandmarkVisibility) {
        visibleCount++;
      }
    }
    const confidence = totalVis / keyLandmarks.length;
    // Upper body is considered visible if at least 4 of 6 key joints are tracked
    const isBodyVisible = visibleCount >= 4 && confidence >= 0.35;

    // Calculate elbow angles
    const leftAngle = this.calculateAngle(leftShoulder, leftElbow, leftWrist);
    const rightAngle = this.calculateAngle(rightShoulder, rightElbow, rightWrist);

    // If one arm is hidden or poorly visible, favor the more visible arm
    const leftVis = (leftShoulder.visibility ?? 1.0) * (leftElbow.visibility ?? 1.0);
    const rightVis = (rightShoulder.visibility ?? 1.0) * (rightElbow.visibility ?? 1.0);

    let avgAngle = (leftAngle + rightAngle) / 2;
    if (leftVis < 0.3 && rightVis >= 0.5) {
      avgAngle = rightAngle;
    } else if (rightVis < 0.3 && leftVis >= 0.5) {
      avgAngle = leftAngle;
    }

    // Calculate shoulder span (apparent width in camera view)
    const shoulderSpan = this.distance2D(leftShoulder, rightShoulder);

    // Calculate proximity score (0.0 = top / far, 1.0 = bottom / close to phone)
    let proximityScore = 0;
    if (calibration.isCalibrated && calibration.proximityRange > 0.02) {
      // Calibrated relative proximity
      const delta = shoulderSpan - calibration.topShoulderSpan;
      proximityScore = Math.max(0, Math.min(1.5, delta / calibration.proximityRange));
    } else {
      // Default geometric heuristic: shoulder span typically expands from ~0.22 (top) to ~0.42 (bottom)
      const estimatedTop = 0.22;
      const estimatedBottom = 0.42;
      const delta = shoulderSpan - estimatedTop;
      proximityScore = Math.max(0, Math.min(1.5, delta / (estimatedBottom - estimatedTop)));
    }

    // Head proximity (distance between nose and shoulder midpoint)
    const midShoulder = {
      x: (leftShoulder.x + rightShoulder.x) / 2,
      y: (leftShoulder.y + rightShoulder.y) / 2,
      z: 0,
    };
    const headProximity = nose ? this.distance2D(nose, midShoulder as NormalizedLandmark) : 0;

    return {
      timestampMs,
      leftElbowAngle: leftAngle,
      rightElbowAngle: rightAngle,
      avgElbowAngle: avgAngle,
      shoulderSpan,
      proximityScore,
      headProximity,
      isBodyVisible,
      confidence,
      landmarks,
    };
  }
}
