import { NormalizedLandmark, POSE_LANDMARKS, BodyPositionStatus } from '../types/pose';
import { DEFAULT_JUMP_CONFIG } from '../config/jumpConfig';

export class PoseProcessor {
  private prevHipY: number | null = null;
  private stabilityCounter = 0;

  /**
   * Evaluates landmark visibility, centering, framing, and stability.
   */
  public evaluatePosition(landmarks: NormalizedLandmark[]): BodyPositionStatus {
    if (!landmarks || landmarks.length < 33) {
      return {
        isFullyVisible: false,
        isCentered: false,
        isFacingCamera: false,
        isStable: false,
        message: 'No person detected. Step into camera view.',
        confidence: 0,
      };
    }

    const nose = landmarks[POSE_LANDMARKS.NOSE];
    const leftShoulder = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
    const rightShoulder = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];
    const leftHip = landmarks[POSE_LANDMARKS.LEFT_HIP];
    const rightHip = landmarks[POSE_LANDMARKS.RIGHT_HIP];
    const leftKnee = landmarks[POSE_LANDMARKS.LEFT_KNEE];
    const rightKnee = landmarks[POSE_LANDMARKS.RIGHT_KNEE];
    const leftAnkle = landmarks[POSE_LANDMARKS.LEFT_ANKLE];
    const rightAnkle = landmarks[POSE_LANDMARKS.RIGHT_ANKLE];

    // 1. Check Landmark Visibility
    const requiredLandmarks = [
      leftShoulder,
      rightShoulder,
      leftHip,
      rightHip,
      leftKnee,
      rightKnee,
      leftAnkle,
      rightAnkle,
    ];

    let totalVis = 0;
    const minVis = DEFAULT_JUMP_CONFIG.minLandmarkVisibility; // e.g. 0.35
    let lowConfidenceCount = 0;

    for (const lm of requiredLandmarks) {
      const v = lm.visibility ?? 1.0;
      totalVis += v;
      if (v < minVis) {
        lowConfidenceCount++;
      }
    }
    const confidence = totalVis / requiredLandmarks.length;

    // Allow up to 1 landmark to have brief motion blur if overall confidence is reasonable
    if (lowConfidenceCount > 1 || confidence < 0.45) {
      return {
        isFullyVisible: false,
        isCentered: false,
        isFacingCamera: false,
        isStable: false,
        message: 'Body not fully detected. Ensure good lighting.',
        confidence,
      };
    }

    // 2. Check Frame Boundaries (User should be mostly inside frame)
    // Ankles/feet at bottom: if y > 0.98, feet are severely clipped
    const maxAnkleY = Math.max(leftAnkle.y, rightAnkle.y);
    if (maxAnkleY > 0.98) {
      return {
        isFullyVisible: false,
        isCentered: false,
        isFacingCamera: false,
        isStable: false,
        message: 'Your feet are outside the camera frame. Move further away.',
        confidence,
      };
    }

    // Head / nose at top: if nose y < 0.02, head is clipped
    if (nose && nose.y < 0.02) {
      return {
        isFullyVisible: false,
        isCentered: false,
        isFacingCamera: false,
        isStable: false,
        message: 'Head outside camera frame. Tilt camera or step back.',
        confidence,
      };
    }

    // 3. Check Centering (hip center between 0.15 and 0.85)
    const hipCenterX = (leftHip.x + rightHip.x) / 2.0;
    const isCentered = hipCenterX >= 0.15 && hipCenterX <= 0.85;
    if (!isCentered) {
      return {
        isFullyVisible: true,
        isCentered: false,
        isFacingCamera: false,
        isStable: false,
        message: 'Please stand in the center of the frame.',
        confidence,
      };
    }

    // 4. Check Facing Camera (Shoulder width should be prominent and symmetric)
    const shoulderSpan = Math.abs(leftShoulder.x - rightShoulder.x);
    const hipSpan = Math.abs(leftHip.x - rightHip.x);
    const isFacingCamera = shoulderSpan > 0.07 && hipSpan > 0.05;
    if (!isFacingCamera) {
      return {
        isFullyVisible: true,
        isCentered: true,
        isFacingCamera: false,
        isStable: false,
        message: 'Please face the camera directly.',
        confidence,
      };
    }

    // 5. Check Stability for Calibration
    const currentHipY = (leftHip.y + rightHip.y) / 2.0;
    if (this.prevHipY !== null) {
      const delta = Math.abs(currentHipY - this.prevHipY);
      if (delta < 0.015) {
        this.stabilityCounter++;
      } else {
        this.stabilityCounter = Math.max(0, this.stabilityCounter - 2);
      }
    }
    this.prevHipY = currentHipY;
    const isStable = this.stabilityCounter >= 10;

    const message = isStable ? 'Position verified. Hold still...' : 'Hold still for calibration...';

    return {
      isFullyVisible: true,
      isCentered: true,
      isFacingCamera: true,
      isStable,
      message,
      confidence,
    };
  }

  public reset() {
    this.prevHipY = null;
    this.stabilityCounter = 0;
  }
}
