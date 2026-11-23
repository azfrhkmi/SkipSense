/**
 * Exponential Moving Average (EMA) and velocity estimation for temporal pose smoothing.
 */
export class MovementSmoother {
  private alpha: number;
  private smoothedValue: number | null = null;
  private prevSmoothedValue: number | null = null;
  private prevTimestamp: number | null = null;
  private estimatedVelocity = 0;

  /**
   * @param alpha Smoothing factor between 0 (heavy smoothing / high inertia) and 1 (no smoothing).
   */
  constructor(alpha = 0.4) {
    this.alpha = Math.max(0.01, Math.min(1.0, alpha));
  }

  public update(val: number, timestampMs: number): { smoothed: number; velocity: number } {
    if (this.smoothedValue === null || this.prevTimestamp === null) {
      this.smoothedValue = val;
      this.prevSmoothedValue = val;
      this.prevTimestamp = timestampMs;
      this.estimatedVelocity = 0;
      return { smoothed: val, velocity: 0 };
    }

    const dtSeconds = Math.max(0.001, (timestampMs - this.prevTimestamp) / 1000.0);

    // EMA update
    this.prevSmoothedValue = this.smoothedValue;
    this.smoothedValue = this.alpha * val + (1.0 - this.alpha) * this.smoothedValue;

    // Numerical derivative for velocity (units/second)
    const rawVelocity = (this.smoothedValue - this.prevSmoothedValue) / dtSeconds;

    // Dampen velocity noise with a secondary EMA filter
    this.estimatedVelocity = 0.5 * rawVelocity + 0.5 * this.estimatedVelocity;
    this.prevTimestamp = timestampMs;

    return {
      smoothed: this.smoothedValue,
      velocity: this.estimatedVelocity,
    };
  }

  public reset(initialValue: number | null = null) {
    this.smoothedValue = initialValue;
    this.prevSmoothedValue = initialValue;
    this.prevTimestamp = null;
    this.estimatedVelocity = 0;
  }

  public get current(): number {
    return this.smoothedValue ?? 0;
  }

  public get velocity(): number {
    return this.estimatedVelocity;
  }
}

