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
 * Supports realistic variable landing baseline (e.g. landing on balls of feet).
 */
function simulateJump(
  detector: JumpDetector,
  startTimestampMs: number,
  options: {
    jumpHeight?: number;
    durationMs?: number;
    frameIntervalMs?: number;
    groundedHipY?: number;
    groundedAnkleY?: number;
    landingHipY?: number;
    landingAnkleY?: number;
  } = {}
): { endTimestampMs: number; countIncremented: boolean } {
  const jumpHeight = options.jumpHeight ?? 0.045; // 4.5% of screen height ~ 18% of torso
  const durationMs = options.durationMs ?? 280;   // 280ms realistic skipping jump
  const frameIntervalMs = options.frameIntervalMs ?? 25;
  const startHipY = options.groundedHipY ?? 0.55;
  const startAnkleY = options.groundedAnkleY ?? 0.88;
  const endHipY = options.landingHipY ?? startHipY;
  const endAnkleY = options.landingAnkleY ?? startAnkleY;

  let currentTime = startTimestampMs;
  const numFrames = Math.max(4, Math.floor(durationMs / frameIntervalMs));
  let jumpOccurred = false;

  for (let i = 0; i <= numFrames; i++) {
    const tNorm = i / numFrames;
    // Parabolic arc
    const currentDisplacement = 4.0 * jumpHeight * tNorm * (1.0 - tNorm);

    // Linear interpolate landing shift
    const baseHip = startHipY + (endHipY - startHipY) * tNorm;
    const baseAnkle = startAnkleY + (endAnkleY - startAnkleY) * tNorm;

    const hipY = baseHip - currentDisplacement;
    const ankleY = baseAnkle - currentDisplacement;
    const shoulderY = hipY - 0.25;

    const pose = createBasePose({ hipY, ankleY, shoulderY });
    const counted = detector.processFrame(pose, currentTime);
    if (counted) jumpOccurred = true;

    currentTime += frameIntervalMs;
  }

  // Follow with grounded landing frames
  for (let j = 0; j < 3; j++) {
    const groundedPose = createBasePose({
      hipY: endHipY,
      ankleY: endAnkleY,
      shoulderY: endHipY - 0.25,
    });
    const counted = detector.processFrame(groundedPose, currentTime);
    if (counted) jumpOccurred = true;
    currentTime += frameIntervalMs;
  }

  return { endTimestampMs: currentTime, countIncremented: jumpOccurred };
}

describe('SkipSense v1.1 JumpDetector Accuracy Tests', () => {
  let detector: JumpDetector;

  beforeEach(() => {
    detector = new JumpDetector();
    // Calibrate baseline: hipY = 0.55, ankleY = 0.88, torsoLength = 0.25
    detector.setBaseline(0.55, 0.88, 0.25);
  });

  // 1. Standing still -> 0 counts
  it('Scenario 1: standing still for 10 seconds counts 0 jumps', () => {
    let time = 1000;
    for (let i = 0; i < 300; i++) {
      const sway = Math.sin(i / 10) * 0.0015;
      const pose = createBasePose({ hipY: 0.55 + sway, ankleY: 0.88 + sway });
      detector.processFrame(pose, time);
      time += 33;
    }
    expect(detector.totalJumps).toBe(0);
  });

  // 2. Walking -> 0 counts
  it('Scenario 2: walking with alternating leg lifts and level torso counts 0 jumps', () => {
    let time = 1000;
    for (let step = 0; step < 12; step++) {
      for (let i = 0; i < 15; i++) {
        const t = i / 15;
        const lift = Math.sin(t * Math.PI) * 0.06;
        const leftAnkleY = step % 2 === 0 ? 0.88 - lift : 0.88;
        const rightAnkleY = step % 2 === 1 ? 0.88 - lift : 0.88;
        const pose = createBasePose({
          hipY: 0.55, // Torso stays level
          leftAnkleY,
          rightAnkleY,
        });
        detector.processFrame(pose, time);
        time += 30;
      }
    }
    expect(detector.totalJumps).toBe(0);
  });

  // 3. Bending knees / squatting -> 0 counts
  it('Scenario 3: bending knees / squatting (downward hip displacement) counts 0 jumps', () => {
    let time = 1000;
    for (let rep = 0; rep < 5; rep++) {
      for (let i = 0; i < 20; i++) {
        const t = i / 20;
        const squatDepth = Math.sin(t * Math.PI) * 0.09;
        const pose = createBasePose({
          hipY: 0.55 + squatDepth,
          ankleY: 0.88,
          shoulderY: 0.30 + squatDepth,
        });
        detector.processFrame(pose, time);
        time += 30;
      }
    }
    expect(detector.totalJumps).toBe(0);
  });

  // 4. Small jumps (2-3cm / low rapid skipping) -> counts correctly!
  it('Scenario 4: detects small rapid skipping jumps (jumpHeight = 0.035)', () => {
    let time = 1000;
    for (let j = 0; j < 5; j++) {
      const res = simulateJump(detector, time, {
        jumpHeight: 0.035, // Low jump (~14% of torso)
        durationMs: 240,
        frameIntervalMs: 25,
      });
      time = res.endTimestampMs + 200;
    }
    expect(detector.totalJumps).toBe(5);
  });

  // 5. Normal skipping -> counts correctly
  it('Scenario 5: normal skipping jumps count accurately (10 jumps = 10 counts)', () => {
    let time = 1000;
    for (let j = 0; j < 10; j++) {
      const res = simulateJump(detector, time, {
        jumpHeight: 0.055,
        durationMs: 280,
        frameIntervalMs: 25,
      });
      time = res.endTimestampMs + 200;
    }
    expect(detector.totalJumps).toBe(10);
  });

  // 6. Fast consecutive jumps (160+ JPM, ~300ms cycle) -> no dropped or duplicate counts
  it('Scenario 6: fast consecutive skipping (160+ JPM) counts each jump without dropping', () => {
    let time = 1000;
    // 160 JPM = ~375ms per cycle (220ms airborne + landing, 155ms ground transition)
    for (let j = 0; j < 15; j++) {
      const res = simulateJump(detector, time, {
        jumpHeight: 0.045,
        durationMs: 220,
        frameIntervalMs: 20,
      });
      time = res.endTimestampMs + 150;
    }
    expect(detector.totalJumps).toBe(15);
  });

  // 7. Variable jump height -> counts all correctly
  it('Scenario 7: handles variable jump heights (small, medium, high in mixed sequence)', () => {
    const heights = [0.035, 0.065, 0.04, 0.075, 0.038, 0.055, 0.08, 0.042];
    let time = 1000;
    for (const h of heights) {
      const res = simulateJump(detector, time, {
        jumpHeight: h,
        durationMs: 260,
        frameIntervalMs: 25,
      });
      time = res.endTimestampMs + 200;
    }
    expect(detector.totalJumps).toBe(heights.length);
  });

  // 8. Slightly different landing positions (balls of feet / stance shifts) -> counts correctly!
  it('Scenario 8: adapts to shifted landing positions on the balls of feet', () => {
    let time = 1000;
    let currentHip = 0.55;
    let currentAnkle = 0.88;

    // Simulate 5 jumps where user stays on balls of feet (ankles 0.86 instead of 0.88, hips 0.54 instead of 0.55)
    for (let j = 0; j < 5; j++) {
      const targetHip = 0.54;
      const targetAnkle = 0.86;
      const res = simulateJump(detector, time, {
        jumpHeight: 0.045,
        durationMs: 250,
        groundedHipY: currentHip,
        groundedAnkleY: currentAnkle,
        landingHipY: targetHip,
        landingAnkleY: targetAnkle,
      });
      currentHip = targetHip;
      currentAnkle = targetAnkle;
      time = res.endTimestampMs + 200;
    }
    expect(detector.totalJumps).toBe(5);
  });

  // 9. Missing ankle landmarks -> suspends detection safely
  it('Scenario 9: missing ankle landmarks suspends detection without false count', () => {
    let time = 1000;
    const pose = createBasePose({ hipY: 0.48, ankleY: 0.80 });
    (pose as any)[POSE_LANDMARKS.LEFT_ANKLE] = null;
    (pose as any)[POSE_LANDMARKS.RIGHT_ANKLE] = null;

    const counted = detector.processFrame(pose, time);
    expect(counted).toBe(false);
    expect(detector.totalJumps).toBe(0);
  });

  // 10. Temporary tracking loss -> recovers safely and preserves count
  it('Scenario 10: temporary tracking loss preserves existing count and recovers', () => {
    let time = 1000;
    // 3 successful jumps
    for (let j = 0; j < 3; j++) {
      const res = simulateJump(detector, time, { jumpHeight: 0.05 });
      time = res.endTimestampMs + 220;
    }
    expect(detector.totalJumps).toBe(3);

    // 20 blank/tracking loss frames
    for (let k = 0; k < 20; k++) {
      detector.processFrame([], time);
      time += 30;
    }
    expect(detector.totalJumps).toBe(3);

    // 2 more jumps after recovery
    for (let j = 0; j < 2; j++) {
      const res = simulateJump(detector, time, { jumpHeight: 0.05 });
      time = res.endTimestampMs + 220;
    }
    expect(detector.totalJumps).toBe(5);
  });

  // 11. Refractory period -> prevents duplicate counting of same jump
  it('Scenario 11: refractory period prevents duplicate counting within 180ms', () => {
    let time = 1000;
    const res = simulateJump(detector, time, { jumpHeight: 0.05 });
    expect(detector.totalJumps).toBe(1);

    // Immediate upward spike 60ms after landing (should be rejected by refractory period)
    const quickTime = res.endTimestampMs + 60;
    const spikePose = createBasePose({ hipY: 0.50, ankleY: 0.83 });
    const duplicate = detector.processFrame(spikePose, quickTime);
    expect(duplicate).toBe(false);
    expect(detector.totalJumps).toBe(1);
  });

  // 12. COMPARATIVE BENCHMARK: Old v1.0 algorithm vs New v1.1 algorithm on real skipping dataset
  it('Scenario 12: Benchmark comparison shows v1.1 solves false-negative problem on realistic skipping', () => {
    // Old v1.0 config
    const oldDetector = new JumpDetector({
      config: {
        takeoffThresholdNorm: 0.08,
        airborneThresholdNorm: 0.16,
        landingThresholdNorm: 0.07,
        emaAlpha: 0.4,
        refractoryPeriodMs: 280,
        consecutiveLandingFrames: 2,
        dynamicBaselineAdaptRate: 0.0, // Fixed baseline in v1.0
      },
    });
    oldDetector.setBaseline(0.55, 0.88, 0.25);

    // New v1.1 detector
    const newDetector = new JumpDetector();
    newDetector.setBaseline(0.55, 0.88, 0.25);

    // Simulate 35 realistic skipping jumps:
    // Skipping involves rapid small jumps (height 0.035 - 0.050) while staying on balls of feet (Y: 0.86)
    let timeOld = 1000;
    let timeNew = 1000;
    const TOTAL_TEST_JUMPS = 35;

    for (let j = 0; j < TOTAL_TEST_JUMPS; j++) {
      // Natural variations in skipping height (small 3-4.5cm jumps)
      const h = 0.035 + (j % 4) * 0.005; // 0.035 to 0.050
      const duration = 240 + (j % 3) * 20;

      // Old detector
      const resOld = simulateJump(oldDetector, timeOld, {
        jumpHeight: h,
        durationMs: duration,
        landingAnkleY: 0.865, // slightly off-baseline as in real skipping
        landingHipY: 0.542,
      });
      timeOld = resOld.endTimestampMs + 180;

      // New detector
      const resNew = simulateJump(newDetector, timeNew, {
        jumpHeight: h,
        durationMs: duration,
        landingAnkleY: 0.865,
        landingHipY: 0.542,
      });
      timeNew = resNew.endTimestampMs + 180;
    }

    console.log(`[BENCHMARK] Out of ${TOTAL_TEST_JUMPS} realistic skipping jumps:`);
    console.log(`  - Old v1.0 algorithm detected: ${oldDetector.totalJumps} jumps (${Math.round((oldDetector.totalJumps / TOTAL_TEST_JUMPS) * 100)}%)`);
    console.log(`  - New v1.1 algorithm detected: ${newDetector.totalJumps} jumps (${Math.round((newDetector.totalJumps / TOTAL_TEST_JUMPS) * 100)}%)`);

    // Old detector severely misses low jumps (less than 25% detected, matching user's 6-8 out of 30-50!)
    expect(oldDetector.totalJumps).toBeLessThan(10);

    // New detector detects 100% of the skipping jumps!
    expect(newDetector.totalJumps).toBe(TOTAL_TEST_JUMPS);
  });
});
