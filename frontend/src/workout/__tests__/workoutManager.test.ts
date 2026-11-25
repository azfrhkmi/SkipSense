import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorkoutManager } from '../workoutManager';
import { WorkoutTimer } from '../workoutTimer';
import { NormalizedLandmark, POSE_LANDMARKS } from '../../types/pose';

function createMockPose(hipY = 0.55, ankleY = 0.88, shoulderY = 0.30): NormalizedLandmark[] {
  const landmarks: NormalizedLandmark[] = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    z: 0.0,
    visibility: 0.95,
  }));
  landmarks[POSE_LANDMARKS.NOSE] = { x: 0.5, y: 0.2, z: 0, visibility: 0.95 };
  landmarks[POSE_LANDMARKS.LEFT_SHOULDER] = { x: 0.45, y: shoulderY, z: 0, visibility: 0.95 };
  landmarks[POSE_LANDMARKS.RIGHT_SHOULDER] = { x: 0.55, y: shoulderY, z: 0, visibility: 0.95 };
  landmarks[POSE_LANDMARKS.LEFT_HIP] = { x: 0.47, y: hipY, z: 0, visibility: 0.95 };
  landmarks[POSE_LANDMARKS.RIGHT_HIP] = { x: 0.53, y: hipY, z: 0, visibility: 0.95 };
  landmarks[POSE_LANDMARKS.LEFT_KNEE] = { x: 0.47, y: 0.72, z: 0, visibility: 0.95 };
  landmarks[POSE_LANDMARKS.RIGHT_KNEE] = { x: 0.53, y: 0.72, z: 0, visibility: 0.95 };
  landmarks[POSE_LANDMARKS.LEFT_ANKLE] = { x: 0.47, y: ankleY, z: 0, visibility: 0.95 };
  landmarks[POSE_LANDMARKS.RIGHT_ANKLE] = { x: 0.53, y: ankleY, z: 0, visibility: 0.95 };
  return landmarks;
}

describe('WorkoutTimer', () => {
  let timer: WorkoutTimer;

  beforeEach(() => {
    timer = new WorkoutTimer();
  });

  it('correctly tracks active seconds when active', () => {
    timer.update(true, false, 1000);
    timer.update(true, false, 3000);
    expect(timer.activeSeconds).toBe(2);
    expect(timer.restSeconds).toBe(0);
    expect(timer.totalSeconds).toBe(2);
  });

  it('correctly tracks rest seconds when paused', () => {
    timer.update(true, false, 1000);
    timer.update(true, false, 3000); // 2s active
    timer.update(false, true, 4000); // 1s rest
    timer.update(false, true, 6000); // 2s more rest
    expect(timer.activeSeconds).toBe(2);
    expect(timer.restSeconds).toBe(3);
    expect(timer.totalSeconds).toBe(5);
  });
});

describe('WorkoutManager Lifecycle and Auto-Pause/Resume', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('transitions through calibration and countdown to active state', () => {
    const onStatusChange = vi.fn();
    const onCountChange = vi.fn();
    const onTimerTick = vi.fn();
    const onCountdownTick = vi.fn();
    const onPositionFeedback = vi.fn();
    const onDebugUpdate = vi.fn();
    const onWorkoutComplete = vi.fn();

    const manager = new WorkoutManager({
      onStatusChange,
      onCountChange,
      onTimerTick,
      onCountdownTick,
      onPositionFeedback,
      onDebugUpdate,
      onWorkoutComplete,
    });

    manager.startWorkoutFlow();
    expect(manager.currentStatus).toBe('CALIBRATING');

    // Feed 16 stable frames to complete calibration
    let time = 1000;
    const stablePose = createMockPose();
    for (let i = 0; i < 16; i++) {
      manager.processFrame(stablePose, time);
      time += 33;
    }

    expect(manager.currentStatus).toBe('COUNTDOWN');
    expect(onCountdownTick).toHaveBeenCalledWith(3);

    // Advance 3 seconds for countdown (3 -> 2 -> 1 -> 0 -> ACTIVE)
    vi.advanceTimersByTime(3000);
    expect(manager.currentStatus).toBe('ACTIVE');
  });

  it('keeps active timer running continuously during brief rests by default (does not auto-pause)', () => {
    const onStatusChange = vi.fn();
    const manager = new WorkoutManager({
      onStatusChange,
      onCountChange: vi.fn(),
      onTimerTick: vi.fn(),
      onCountdownTick: vi.fn(),
      onPositionFeedback: vi.fn(),
      onDebugUpdate: vi.fn(),
      onWorkoutComplete: vi.fn(),
    });

    manager.startWorkoutFlow();
    // Calibrate
    let time = 1000;
    const pose = createMockPose();
    for (let i = 0; i < 16; i++) {
      manager.processFrame(pose, time);
      time += 33;
    }
    vi.advanceTimersByTime(3000);
    expect(manager.currentStatus).toBe('ACTIVE');

    // Idle for 6 seconds in ACTIVE state without jumps (taking a breather)
    const startTime = time;
    while (time - startTime < 6000) {
      manager.processFrame(pose, time);
      time += 100;
    }

    // Must remain ACTIVE and continue counting activeSeconds with zero restSeconds
    expect(manager.currentStatus).toBe('ACTIVE');
    expect(manager.activeSeconds).toBeGreaterThanOrEqual(5);
    expect(manager.restSeconds).toBe(0);
  });

  it('auto-pauses after 5 seconds only when autoPauseEnabled is explicitly true', () => {
    const onStatusChange = vi.fn();
    const manager = new WorkoutManager(
      {
        onStatusChange,
        onCountChange: vi.fn(),
        onTimerTick: vi.fn(),
        onCountdownTick: vi.fn(),
        onPositionFeedback: vi.fn(),
        onDebugUpdate: vi.fn(),
        onWorkoutComplete: vi.fn(),
      },
      { autoPauseEnabled: true }
    );

    manager.startWorkoutFlow();
    let time = 1000;
    const pose = createMockPose();
    for (let i = 0; i < 16; i++) {
      manager.processFrame(pose, time);
      time += 33;
    }
    vi.advanceTimersByTime(3000);
    expect(manager.currentStatus).toBe('ACTIVE');

    const startTime = time;
    while (time - startTime < 5100) {
      manager.processFrame(pose, time);
      time += 100;
    }

    expect(manager.currentStatus).toBe('PAUSED');
  });

  it('finishes workout and calculates complete summary data', () => {
    const onWorkoutComplete = vi.fn();
    const manager = new WorkoutManager({
      onStatusChange: vi.fn(),
      onCountChange: vi.fn(),
      onTimerTick: vi.fn(),
      onCountdownTick: vi.fn(),
      onPositionFeedback: vi.fn(),
      onDebugUpdate: vi.fn(),
      onWorkoutComplete,
    });

    manager.startWorkoutFlow();
    const session = manager.finishWorkout();

    expect(manager.currentStatus).toBe('FINISHED');
    expect(session.total_jumps).toBe(0);
    expect(session.session_date).toBeDefined();
    expect(session.active_duration_seconds).toBe(0);
    expect(onWorkoutComplete).toHaveBeenCalledWith(session);
  });
});

