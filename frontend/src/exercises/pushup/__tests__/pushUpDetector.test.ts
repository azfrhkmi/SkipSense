import { describe, it, expect, beforeEach } from 'vitest';
import { PushUpDetector } from '../pushUpDetector';
import { PushUpProcessor } from '../pushUpProcessor';
import { NormalizedLandmark, POSE_LANDMARKS } from '../../../types/pose';

/**
 * Creates mathematically precise pose landmarks for push-up simulation.
 * In upward view (phone on floor under chest):
 * - Shoulder span expands as user lowers towards phone.
 * - Elbow angle flexes from ~165° (top) to ~85° (bottom).
 */
function createPushUpPose(options: {
  elbowAngle?: number;       // degrees, default 165
  shoulderSpan?: number;     // normalized width, default 0.24 (top)
  visibility?: number;
} = {}): NormalizedLandmark[] {
  const angle = options.elbowAngle ?? 165;
  const span = options.shoulderSpan ?? 0.24;
  const vis = options.visibility ?? 0.95;

  const landmarks: NormalizedLandmark[] = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    z: 0.0,
    visibility: vis,
  }));

  // Nose (midline top)
  landmarks[POSE_LANDMARKS.NOSE] = { x: 0.5, y: 0.30, z: 0.0, visibility: vis };

  // Shoulders: centered at x=0.5, y=0.42
  const leftShoulderX = 0.5 - span / 2;
  const rightShoulderX = 0.5 + span / 2;
  landmarks[POSE_LANDMARKS.LEFT_SHOULDER] = { x: leftShoulderX, y: 0.42, z: 0.0, visibility: vis };
  landmarks[POSE_LANDMARKS.RIGHT_SHOULDER] = { x: rightShoulderX, y: 0.42, z: 0.0, visibility: vis };

  // Wrists on floor: outside shoulder line
  const leftWristX = leftShoulderX - 0.12;
  const rightWristX = rightShoulderX + 0.12;
  landmarks[POSE_LANDMARKS.LEFT_WRIST] = { x: leftWristX, y: 0.42, z: 0.0, visibility: vis };
  landmarks[POSE_LANDMARKS.RIGHT_WRIST] = { x: rightWristX, y: 0.42, z: 0.0, visibility: vis };

  // Elbows calculated using trigonometry so angle equals exactly options.elbowAngle
  const halfAngleRad = ((Math.min(179, Math.max(30, angle))) / 2) * (Math.PI / 180);
  const leftDist = 0.06;
  const leftH = leftDist / Math.tan(halfAngleRad);
  landmarks[POSE_LANDMARKS.LEFT_ELBOW] = {
    x: (leftShoulderX + leftWristX) / 2,
    y: 0.42 + leftH,
    z: 0.0,
    visibility: vis,
  };

  const rightDist = 0.06;
  const rightH = rightDist / Math.tan(halfAngleRad);
  landmarks[POSE_LANDMARKS.RIGHT_ELBOW] = {
    x: (rightShoulderX + rightWristX) / 2,
    y: 0.42 + rightH,
    z: 0.0,
    visibility: vis,
  };

  // Hips
  landmarks[POSE_LANDMARKS.LEFT_HIP] = { x: 0.47, y: 0.70, z: 0.0, visibility: vis };
  landmarks[POSE_LANDMARKS.RIGHT_HIP] = { x: 0.53, y: 0.70, z: 0.0, visibility: vis };

  return landmarks;
}

/**
 * Simulates a single push-up repetition trajectory.
 */
function simulatePushUp(
  detector: PushUpDetector,
  startTimeMs: number,
  options: {
    durationMs?: number;
    bottomAngle?: number;
    bottomSpan?: number;
    holdBottomMs?: number;
    frameIntervalMs?: number;
  } = {}
): number {
  const durationMs = options.durationMs ?? 1500;
  const bottomAngle = options.bottomAngle ?? 85;
  const bottomSpan = options.bottomSpan ?? 0.44;
  const holdBottomMs = options.holdBottomMs ?? 0;
  const frameIntervalMs = options.frameIntervalMs ?? 33; // ~30 fps

  const halfDuration = (durationMs - holdBottomMs) / 2;
  let currentTime = startTimeMs;

  // 1. Lowering phase (top 165° -> bottomAngle, span 0.24 -> bottomSpan)
  const loweringFrames = Math.max(3, Math.floor(halfDuration / frameIntervalMs));
  for (let i = 0; i <= loweringFrames; i++) {
    const t = i / loweringFrames;
    const angle = 165 - t * (165 - bottomAngle);
    const span = 0.24 + t * (bottomSpan - 0.24);
    const pose = createPushUpPose({ elbowAngle: angle, shoulderSpan: span });
    detector.processFrame(pose, currentTime);
    currentTime += frameIntervalMs;
  }

  // 2. Optional hold at bottom
  if (holdBottomMs > 0) {
    const holdFrames = Math.floor(holdBottomMs / frameIntervalMs);
    for (let i = 0; i < holdFrames; i++) {
      const pose = createPushUpPose({ elbowAngle: bottomAngle, shoulderSpan: bottomSpan });
      detector.processFrame(pose, currentTime);
      currentTime += frameIntervalMs;
    }
  }

  // 3. Pushing up phase (bottomAngle -> 165°, bottomSpan -> 0.24)
  const pushingFrames = Math.max(3, Math.floor(halfDuration / frameIntervalMs));
  for (let i = 0; i <= pushingFrames; i++) {
    const t = i / pushingFrames;
    const angle = bottomAngle + t * (165 - bottomAngle);
    const span = bottomSpan - t * (bottomSpan - 0.24);
    const pose = createPushUpPose({ elbowAngle: angle, shoulderSpan: span });
    detector.processFrame(pose, currentTime);
    currentTime += frameIntervalMs;
  }

  // Settle at top
  for (let i = 0; i < 3; i++) {
    const pose = createPushUpPose({ elbowAngle: 165, shoulderSpan: 0.24 });
    detector.processFrame(pose, currentTime);
    currentTime += frameIntervalMs;
  }

  return currentTime;
}

describe('PushUpProcessor', () => {
  it('calculates 90 degree elbow angle accurately', () => {
    const shoulder = { x: 0.38, y: 0.42, z: 0 };
    const wrist = { x: 0.26, y: 0.42, z: 0 };
    // At 90 deg, E = (0.32, 0.42 + 0.06)
    const elbow = { x: 0.32, y: 0.48, z: 0 };

    const angle = PushUpProcessor.calculateAngle(shoulder, elbow, wrist);
    expect(Math.round(angle)).toBe(90);
  });

  it('calculates straight 180 degree arm accurately', () => {
    const shoulder = { x: 0.40, y: 0.40, z: 0 };
    const elbow = { x: 0.30, y: 0.40, z: 0 };
    const wrist = { x: 0.20, y: 0.40, z: 0 };

    const angle = PushUpProcessor.calculateAngle(shoulder, elbow, wrist);
    expect(Math.round(angle)).toBe(180);
  });
});

describe('PushUpDetector', () => {
  let detector: PushUpDetector;

  beforeEach(() => {
    detector = new PushUpDetector({ mode: '10' });
  });

  it('remains at 0 reps when static at top position', () => {
    let t = 1000;
    for (let i = 0; i < 20; i++) {
      const pose = createPushUpPose({ elbowAngle: 165, shoulderSpan: 0.24 });
      detector.processFrame(pose, t);
      t += 50;
    }
    expect(detector.completedReps).toBe(0);
    expect(detector.debugInfo.state).toBe('READY');
  });

  it('counts 1 rep on full range of motion', () => {
    simulatePushUp(detector, 1000, {
      durationMs: 1400,
      bottomAngle: 85,
      bottomSpan: 0.44,
    });
    expect(detector.completedReps).toBe(1);
  });

  it('rejects partial push-ups (incomplete depth)', () => {
    // Only bends elbows to 130 degrees (does not reach <= 105)
    simulatePushUp(detector, 1000, {
      durationMs: 1200,
      bottomAngle: 130,
      bottomSpan: 0.28,
    });
    expect(detector.completedReps).toBe(0);
  });

  it('rejects unrealistically fast wiggles (< 500ms)', () => {
    simulatePushUp(detector, 1000, {
      durationMs: 300, // Too fast
      bottomAngle: 85,
      bottomSpan: 0.44,
    });
    expect(detector.completedReps).toBe(0);
  });

  it('does NOT multi-count while holding at bottom position', () => {
    // Holds at bottom for 2.5 seconds
    simulatePushUp(detector, 1000, {
      durationMs: 4000,
      holdBottomMs: 2500,
      bottomAngle: 85,
      bottomSpan: 0.44,
    });
    // Must be exactly 1 completed rep upon returning to top
    expect(detector.completedReps).toBe(1);
  });

  it('stops and sets isTargetReached in 10-Rep Mode', () => {
    let t = 1000;
    for (let r = 0; r < 10; r++) {
      t = simulatePushUp(detector, t + 450, { durationMs: 1200 });
    }
    expect(detector.completedReps).toBe(10);
    expect(detector.isTargetReached).toBe(true);

    // Any further frame should not increase count once target is reached
    simulatePushUp(detector, t + 500, { durationMs: 1200 });
    expect(detector.completedReps).toBe(10);
  });

  it('supports 20-Rep Mode', () => {
    const d20 = new PushUpDetector({ mode: '20' });
    let t = 1000;
    for (let r = 0; r < 20; r++) {
      t = simulatePushUp(d20, t + 450, { durationMs: 1100 });
    }
    expect(d20.completedReps).toBe(20);
    expect(d20.isTargetReached).toBe(true);
  });

  it('supports Freedom Mode beyond 10 and 30 reps without stopping', () => {
    const dFreedom = new PushUpDetector({ mode: 'freedom' });
    let t = 1000;
    for (let r = 0; r < 12; r++) {
      t = simulatePushUp(dFreedom, t + 450, { durationMs: 1000 });
    }
    expect(dFreedom.completedReps).toBe(12);
    expect(dFreedom.isTargetReached).toBe(false);
  });

  it('handles temporary tracking loss gracefully', () => {
    let t = 1000;
    // Top position
    for (let i = 0; i < 5; i++) {
      detector.processFrame(createPushUpPose(), t);
      t += 50;
    }
    // Tracking lost (low visibility)
    for (let i = 0; i < 5; i++) {
      detector.processFrame(createPushUpPose({ visibility: 0.1 }), t);
      t += 50;
    }
    expect(detector.debugInfo.statusMessage).toBe('TRACKING LOST');

    // Normal rep after tracking recovered
    t = simulatePushUp(detector, t + 100, { durationMs: 1300 });
    expect(detector.completedReps).toBe(1);
  });
});
