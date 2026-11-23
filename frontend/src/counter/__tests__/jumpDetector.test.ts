import { describe, it, expect, beforeEach } from 'vitest';
import { JumpDetector } from '../jumpDetector';
import { NormalizedLandmark, POSE_LANDMARKS } from '../../types/pose';

function createBasePose(options: {
  hipY?: number;
  ankleY?: number;
  leftAnkleY?: number;
  rightAnkleY?: number;
  shoulderY?: number;
  wristY?: number;
  visibility?: number;
} = {}): NormalizedLandmark[] {
  const hipY = options.hipY ?? 0.55;
  const leftAnkleY = options.leftAnkleY ?? options.ankleY ?? 0.88;
  const rightAnkleY = options.rightAnkleY ?? options.ankleY ?? 0.88;
  const shoulderY = options.shoulderY ?? 0.30;
  const wristY = options.wristY ?? 0.45;
  const vis = options.visibility ?? 0.95;

  const landmarks: NormalizedLandmark[] = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    z: 0.0,
    visibility: vis,
  }));

  // Shoulders (torso anchor)
  landmarks[POSE_LANDMARKS.LEFT_SHOULDER] = { x: 0.45, y: shoulderY, z: 0, visibility: vis };
  landmarks[POSE_LANDMARKS.RIGHT_SHOULDER] = { x: 0.55, y: shoulderY, z: 0, visibility: vis };

  // Wrists
  landmarks[POSE_LANDMARKS.LEFT_WRIST] = { x: 0.35, y: wristY, z: 0, visibility: vis };
  landmarks[POSE_LANDMARKS.RIGHT_WRIST] = { x: 0.65, y: wristY, z: 0, visibility: vis };

  // Hips
  landmarks[POSE_LANDMARKS.LEFT_HIP] = { x: 0.47, y: hipY, z: 0, visibility: vis };
  landmarks[POSE_LANDMARKS.RIGHT_HIP] = { x: 0.53, y: hipY, z: 0, visibility: vis };

  // Knees
  const kneeY = (hipY + (leftAnkleY + rightAnkleY) / 2) / 2;
  landmarks[POSE_LANDMARKS.LEFT_KNEE] = { x: 0.47, y: kneeY, z: 0, visibility: vis };
  landmarks[POSE_LANDMARKS.RIGHT_KNEE] = { x: 0.53, y: kneeY, z: 0, visibility: vis };

  // Ankles
  landmarks[POSE_LANDMARKS.LEFT_ANKLE] = { x: 0.47, y: leftAnkleY, z: 0, visibility: vis };
  landmarks[POSE_LANDMARKS.RIGHT_ANKLE] = { x: 0.53, y: rightAnkleY, z: 0, visibility: vis };

  // Heels and feet
  landmarks[POSE_LANDMARKS.LEFT_HEEL] = { x: 0.47, y: leftAnkleY + 0.02, z: 0, visibility: vis };
  landmarks[POSE_LANDMARKS.RIGHT_HEEL] = { x: 0.53, y: rightAnkleY + 0.02, z: 0, visibility: vis };
  landmarks[POSE_LANDMARKS.LEFT_FOOT_INDEX] = { x: 0.47, y: leftAnkleY + 0.04, z: 0, visibility: vis };
  landmarks[POSE_LANDMARKS.RIGHT_FOOT_INDEX] = { x: 0.53, y: rightAnkleY + 0.04, z: 0, visibility: vis };

  return landmarks;
}

/**
 * Simulates a single complete jump trajectory over time.
 * @param startTimestampMs starting timestamp
 * @param jumpHeight maximum normalized height displacement (e.g. 0.06 = ~24% of torso)
 * @param durationMs total jump duration (e.g. 360ms)
 * @param frameIntervalMs frame step interval (e.g. 30ms ~ 33fps)
 */
function simulateJump(
  detector: JumpDetector,
  startTimestampMs: number,
  jumpHeight = 0.065,
  durationMs = 360,
  frameIntervalMs = 30
): { endTimestampMs: number; countIncremented: boolean } {
  let currentTime = startTimestampMs;
  const numFrames = Math.floor(durationMs / frameIntervalMs);
  let jumpOccurred = false;

  for (let i = 0; i <= numFrames; i++) {
    // Parabolic trajectory: h = 4 * jumpHeight * (t/T) * (1 - t/T)
    const tNorm = i / numFrames;
    const currentDisplacement = 4.0 * jumpHeight * tNorm * (1.0 - tNorm);

    const hipY = 0.55 - currentDisplacement;
    const ankleY = 0.88 - currentDisplacement;
    const shoulderY = 0.30 - currentDisplacement;

    const pose = createBasePose({ hipY, ankleY, shoulderY });
    const counted = detector.processFrame(pose, currentTime);
    if (counted) jumpOccurred = true;

    currentTime += frameIntervalMs;
  }

  // Feed a couple of grounded frames to confirm landing
  for (let j = 0; j < 3; j++) {
    const groundedPose = createBasePose({ hipY: 0.55, ankleY: 0.88, shoulderY: 0.30 });
    const counted = detector.processFrame(groundedPose, currentTime);
    if (counted) jumpOccurred = true;
    currentTime += frameIntervalMs;
  }

  return { endTimestampMs: currentTime, countIncremented: jumpOccurred };
}

describe('JumpDetector Unit Tests', () => {
  let detector: JumpDetector;

  beforeEach(() => {
    detector = new JumpDetector({ minLandmarkConfidence: 0.5 });
    // Calibrate baseline: hipY = 0.55, ankleY = 0.88, torsoLength = 0.25
    detector.setBaseline(0.55, 0.88, 0.25);
  });

  // Scenario 1: Standing still for 10 seconds -> 0 jumps
  it('Scenario 1: standing still for 10 seconds counts 0 jumps', () => {
    let time = 1000;
    for (let i = 0; i < 300; i++) { // 300 frames @ 33ms = 10 seconds
      // Small natural micro-sway (±0.001)
      const sway = Math.sin(i / 10) * 0.001;
      const pose = createBasePose({ hipY: 0.55 + sway, ankleY: 0.88 + sway });
      detector.processFrame(pose, time);
      time += 33;
    }
    expect(detector.totalJumps).toBe(0);
  });

  // Scenario 2: Walking -> 0 jumps
  it('Scenario 2: walking (alternating leg lifts with level torso) counts 0 jumps', () => {
    let time = 1000;
    for (let step = 0; step < 10; step++) {
      for (let i = 0; i < 15; i++) {
        const t = i / 15;
        const lift = Math.sin(t * Math.PI) * 0.05;
        // In walking, one ankle lifts while other stays grounded, and hips remain level
        const leftAnkleY = step % 2 === 0 ? 0.88 - lift : 0.88;
        const rightAnkleY = step % 2 === 1 ? 0.88 - lift : 0.88;
        const pose = createBasePose({
          hipY: 0.55, // Torso stays level
          leftAnkleY,
          rightAnkleY,
        });
        detector.processFrame(pose, time);
        time += 33;
      }
    }
    expect(detector.totalJumps).toBe(0);
  });

  // Scenario 3: Bending knees -> 0 jumps
  it('Scenario 3: bending knees / squatting (hips move down) counts 0 jumps', () => {
    let time = 1000;
    for (let rep = 0; rep < 5; rep++) {
      for (let i = 0; i < 20; i++) {
        const t = i / 20;
        const squatDepth = Math.sin(t * Math.PI) * 0.08;
        // When squatting, hips move DOWN (+y in screen space) and ankles stay grounded
        const pose = createBasePose({
          hipY: 0.55 + squatDepth,
          ankleY: 0.88,
          shoulderY: 0.30 + squatDepth,
        });
        detector.processFrame(pose, time);
        time += 33;
      }
    }
    expect(detector.totalJumps).toBe(0);
  });

  // Scenario 4: Moving arms -> 0 jumps
  it('Scenario 4: waving / moving arms counts 0 jumps', () => {
    let time = 1000;
    for (let i = 0; i < 100; i++) {
      const armWave = Math.sin(i / 5) * 0.25;
      const pose = createBasePose({
        wristY: 0.45 + armWave,
        hipY: 0.55,
        ankleY: 0.88,
      });
      detector.processFrame(pose, time);
      time += 33;
    }
    expect(detector.totalJumps).toBe(0);
  });

  // Scenario 5: One complete jump -> exactly 1 jump
  it('Scenario 5: one complete jump counts exactly 1 jump', () => {
    const res = simulateJump(detector, 1000, 0.065, 360, 30);
    expect(res.countIncremented).toBe(true);
    expect(detector.totalJumps).toBe(1);
  });

  // Scenario 6: Ten complete jumps -> exactly 10 jumps
  it('Scenario 6: ten complete jumps counts exactly 10 jumps', () => {
    let time = 1000;
    for (let j = 0; j < 10; j++) {
      const res = simulateJump(detector, time, 0.065, 360, 30);
      time = res.endTimestampMs + 320; // 320ms rest between jumps (above refractory period)
    }
    expect(detector.totalJumps).toBe(10);
  });

  // Scenario 7: Twenty consecutive jumps -> exactly 20 jumps
  it('Scenario 7: twenty consecutive jumps counts exactly 20 jumps', () => {
    let time = 1000;
    for (let j = 0; j < 20; j++) {
      const res = simulateJump(detector, time, 0.065, 360, 30);
      time = res.endTimestampMs + 300;
    }
    expect(detector.totalJumps).toBe(20);
  });

  // Scenario 8: Fast consecutive jumps -> no duplicate counting during refractory period
  it('Scenario 8: fast consecutive jumps prevent duplicate counting during refractory period', () => {
    let time = 1000;
    // Jump 1
    const res1 = simulateJump(detector, time, 0.065, 300, 30);
    expect(detector.totalJumps).toBe(1);

    // Attempt second takeoff ONLY 100ms after jump 1 landing (within 280ms refractory period)
    time = res1.endTimestampMs + 80;
    const pose = createBasePose({ hipY: 0.50, ankleY: 0.83 });
    detector.processFrame(pose, time);
    // Should still be 1
    expect(detector.totalJumps).toBe(1);
  });

  // Scenario 9: Missing ankle landmarks -> no unreliable count
  it('Scenario 9: missing ankle landmarks suspends detection and prevents unreliable count', () => {
    let time = 1000;
    const pose = createBasePose({ hipY: 0.48, ankleY: 0.80 });
    // Blank out ankles
    (pose as any)[POSE_LANDMARKS.LEFT_ANKLE] = null;
    (pose as any)[POSE_LANDMARKS.RIGHT_ANKLE] = null;

    const counted = detector.processFrame(pose, time);
    expect(counted).toBe(false);
    expect(detector.totalJumps).toBe(0);
  });

  // Scenario 10: Low confidence landmarks -> suspends detection
  it('Scenario 10: low-confidence landmarks suspend detection', () => {
    let time = 1000;
    for (let i = 0; i < 20; i++) {
      // Very low visibility (0.2 < minConfidence 0.5)
      const pose = createBasePose({
        hipY: 0.48,
        ankleY: 0.80,
        visibility: 0.2,
      });
      detector.processFrame(pose, time);
      time += 33;
    }
    expect(detector.totalJumps).toBe(0);
  });

  // Scenario 11: Camera tracking loss -> preserves existing count
  it('Scenario 11: camera tracking loss preserves existing count without resetting', () => {
    // 3 valid jumps first
    let time = 1000;
    for (let j = 0; j < 3; j++) {
      const res = simulateJump(detector, time, 0.065, 360, 30);
      time = res.endTimestampMs + 320;
    }
    expect(detector.totalJumps).toBe(3);

    // Tracking lost: empty frame or missing landmarks
    for (let k = 0; k < 30; k++) {
      detector.processFrame([], time);
      time += 33;
    }

    // Count is strictly preserved at 3
    expect(detector.totalJumps).toBe(3);
  });

  // Scenario 12: Landing confirmation -> count occurs only on landing, not takeoff or airborne
  it('Scenario 12: count happens strictly on landing, never on takeoff or airborne', () => {
    let time = 1000;
    // Frame 1-3: Grounded
    detector.processFrame(createBasePose({ hipY: 0.55, ankleY: 0.88 }), time);
    time += 30;
    expect(detector.totalJumps).toBe(0);

    // Frame 4-6: Takeoff ascending
    detector.processFrame(createBasePose({ hipY: 0.52, ankleY: 0.85 }), time);
    time += 30;
    detector.processFrame(createBasePose({ hipY: 0.50, ankleY: 0.83 }), time);
    time += 30;
    expect(detector.debugInfo.state === 'TAKEOFF' || detector.debugInfo.state === 'AIRBORNE').toBe(true);
    expect(detector.totalJumps).toBe(0); // MUST NOT COUNT AT TAKEOFF

    // Frame 7-9: Peak Airborne
    detector.processFrame(createBasePose({ hipY: 0.48, ankleY: 0.80 }), time);
    time += 30;
    expect(detector.totalJumps).toBe(0); // MUST NOT COUNT AT AIRBORNE

    // Frame 10-14: Descending into Landing and Grounded
    detector.processFrame(createBasePose({ hipY: 0.51, ankleY: 0.84 }), time);
    time += 30;
    detector.processFrame(createBasePose({ hipY: 0.54, ankleY: 0.87 }), time);
    time += 30;
    detector.processFrame(createBasePose({ hipY: 0.55, ankleY: 0.88 }), time);
    time += 30;
    detector.processFrame(createBasePose({ hipY: 0.55, ankleY: 0.88 }), time);
    time += 30;
    detector.processFrame(createBasePose({ hipY: 0.55, ankleY: 0.88 }), time);
    time += 30;

    // After landing confirmed: Count +1
    expect(detector.totalJumps).toBe(1);
  });
});
