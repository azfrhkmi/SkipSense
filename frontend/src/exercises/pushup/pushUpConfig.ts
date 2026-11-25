export interface PushUpConfig {
  // Angle thresholds (degrees)
  topElbowAngleMin: number;       // Elbows extended: >= 145 deg
  bottomElbowAngleMax: number;    // Elbows flexed: <= 105 deg
  
  // Proximity threshold (0.0 = top, 1.0 = bottom practice depth)
  bottomProximityMin: number;     // Must reach at least this fraction (e.g. 0.70)
  topProximityMax: number;        // Must return to top (<= 0.35)

  // Temporal thresholds
  minRepDurationMs: number;       // Rep cannot be faster than 500ms
  maxRepDurationMs: number;       // Phase timeout 5000ms
  refractoryPeriodMs: number;     // 400ms cooldown after rep
  
  // Landmark visibility
  minLandmarkVisibility: number;  // 0.40

  // Smoothing
  emaAlpha: number;               // 0.60
}

export const DEFAULT_PUSHUP_CONFIG: PushUpConfig = {
  topElbowAngleMin: 140,
  bottomElbowAngleMax: 105,
  bottomProximityMin: 0.65,
  topProximityMax: 0.35,
  minRepDurationMs: 500,
  maxRepDurationMs: 5000,
  refractoryPeriodMs: 400,
  minLandmarkVisibility: 0.40,
  emaAlpha: 0.60,
};

