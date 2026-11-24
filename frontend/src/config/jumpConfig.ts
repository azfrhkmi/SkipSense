/**
 * SkipSense v1.1 - Jump Detection Configuration
 * 
 * Centralized, tunable parameters for real-time skipping jump detection.
 * All spatial thresholds are normalized relative to estimated torso length.
 */
export interface JumpConfig {
  /** Upward displacement fraction of torso to enter TAKEOFF (e.g. 0.045 = ~2.2cm) */
  takeoffThresholdNorm: number;

  /** Minimum upward displacement fraction of torso to confirm AIRBORNE (e.g. 0.080 = ~4.0cm) */
  airborneThresholdNorm: number;

  /** Downward return threshold relative to dynamic ground baseline to enter LANDING */
  landingThresholdNorm: number;

  /** Smoothing factor for Exponential Moving Average (0 = heavy lag, 1 = raw instant) */
  emaAlpha: number;

  /** Minimum refractory cooldown between consecutive jumps in ms (180ms allows up to ~220 JPM) */
  refractoryPeriodMs: number;

  /** Minimum duration in ms of airborne flight phase to reject noise flickers */
  minAirborneDurationMs: number;

  /** Maximum duration in ms before timing out an uncompleted jump back to GROUNDED */
  maxJumpDurationMs: number;

  /** Number of consecutive grounded/stabilized frames required to register landing */
  consecutiveLandingFrames: number;

  /** Minimum landmark visibility confidence score (0.0 to 1.0) */
  minLandmarkVisibility: number;

  /** Rate at which the dynamic ground baseline adapts to foot placement shifts */
  dynamicBaselineAdaptRate: number;

  /** Weight given to hip displacement in combined signal (0.0 to 1.0) */
  hipWeight: number;

  /** Weight given to lower limb (ankle/heel) displacement in combined signal */
  ankleWeight: number;

  /** Number of consecutive low-confidence frames allowed before declaring TRACKING_LOST */
  trackingLostGraceFrames: number;
}

export const DEFAULT_JUMP_CONFIG: JumpConfig = {
  takeoffThresholdNorm: 0.045,
  airborneThresholdNorm: 0.080,
  landingThresholdNorm: 0.045,
  emaAlpha: 0.65,
  refractoryPeriodMs: 180,
  minAirborneDurationMs: 60,
  maxJumpDurationMs: 900,
  consecutiveLandingFrames: 1,
  minLandmarkVisibility: 0.35,
  dynamicBaselineAdaptRate: 0.05,
  hipWeight: 0.55,
  ankleWeight: 0.45,
  trackingLostGraceFrames: 4,
};
