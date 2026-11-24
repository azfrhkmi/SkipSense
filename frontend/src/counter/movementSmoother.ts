import { DEFAULT_JUMP_CONFIG } from '../config/jumpConfig';

/**
 * Exponential Moving Average (EMA) and velocity estimation for temporal pose smoothing.
 * Tuned for rapid skipping jumps with low phase delay.
 */
export class MovementSmoother {
  private alpha: number;
  private smoothedValue: number | null = null;
  private prevSmoothedValue: number | null = null;
  private prevTimestamp: number | null = null;
  private estimatedVelocity = 0;

  /**
   * @param alpha Smoothing factor between 0.01 (heavy smoothing / high inertia) and 1.0 (no smoothing).
   */
  constructor(alpha: number = DEFAULT_JUMP_CONFIG.emaAlpha) {
    this.alpha = Math.max(0.01, Math.min(1.0, alpha));
  }

  public setAlpha(alpha: number) {
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

    // Protect against non-monotonic or zero dt
    const dtSeconds = Math.max(0.005, (timestampMs - this.prevTimestamp) / 1000.0);

    // EMA update
    this.prevSmoothedValue = this.smoothedValue;
    this.smoothedValue = this.alpha * val + (1.0 - this.alpha) * this.smoothedValue;

    // Numerical derivative for velocity (units/second)
    const rawVelocity = (this.smoothedValue - this.prevSmoothedValue) / dtSeconds;

    // Low-latency velocity filter (0.7 / 0.3) to catch rapid transitions promptly
    this.estimatedVelocity = 0.7 * rawVelocity + 0.3 * this.estimatedVelocity;
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
