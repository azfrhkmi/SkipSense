export interface TimerStats {
  activeSeconds: number;
  restSeconds: number;
  totalSeconds: number;
  currentPaceJpm: number;
  averagePaceJpm: number;
  maxPaceJpm: number;
}

export class WorkoutTimer {
  private activeMs = 0;
  private restMs = 0;
  private lastTickMs: number | null = null;
  private maxObservedPace = 0;

  // Window for recent jumps pace calculation (last 10 seconds)
  private recentJumpTimestamps: number[] = [];

  public update(isWorkoutActive: boolean, isWorkoutPaused: boolean, currentTimestampMs: number): TimerStats {
    if (this.lastTickMs !== null) {
      const deltaMs = Math.max(0, currentTimestampMs - this.lastTickMs);
      if (isWorkoutActive) {
        this.activeMs += deltaMs;
      } else if (isWorkoutPaused) {
        this.restMs += deltaMs;
      }
    }
    this.lastTickMs = currentTimestampMs;

    // Prune jumps older than 10 seconds for instantaneous pace calculation
    const cutoff = currentTimestampMs - 10000;
    this.recentJumpTimestamps = this.recentJumpTimestamps.filter((t) => t >= cutoff);

    const currentPace = this.calculateInstantaneousPace();
    if (isWorkoutActive && currentPace > this.maxObservedPace) {
      this.maxObservedPace = currentPace;
    }

    const activeSec = this.activeMs / 1000.0;
    const restSec = this.restMs / 1000.0;
    const totalSec = activeSec + restSec;

    return {
      activeSeconds: Math.floor(activeSec),
      restSeconds: Math.floor(restSec),
      totalSeconds: Math.floor(totalSec),
      currentPaceJpm: currentPace,
      averagePaceJpm: 0, // Computed by manager with total jumps
      maxPaceJpm: this.maxObservedPace,
    };
  }

  public recordJump(timestampMs: number) {
    this.recentJumpTimestamps.push(timestampMs);
  }

  public calculateInstantaneousPace(): number {
    if (this.recentJumpTimestamps.length < 2) return 0;
    const count = this.recentJumpTimestamps.length;
    const windowStart = this.recentJumpTimestamps[0];
    const windowEnd = this.recentJumpTimestamps[count - 1];
    const windowSec = (windowEnd - windowStart) / 1000.0;
    if (windowSec < 1.0) return 0;
    return Math.round(((count - 1) / windowSec) * 60);
  }

  public reset() {
    this.activeMs = 0;
    this.restMs = 0;
    this.lastTickMs = null;
    this.maxObservedPace = 0;
    this.recentJumpTimestamps = [];
  }

  public get activeSeconds(): number {
    return Math.floor(this.activeMs / 1000.0);
  }

  public get restSeconds(): number {
    return Math.floor(this.restMs / 1000.0);
  }

  public get totalSeconds(): number {
    return Math.floor((this.activeMs + this.restMs) / 1000.0);
  }

  public get maxPace(): number {
    return this.maxObservedPace;
  }
}

