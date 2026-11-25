import { NormalizedLandmark } from '../../types/pose';

export type PushUpMode = '10' | '20' | '30' | 'freedom';

export type PushUpState =
  | 'READY'            // Top position, arms extended
  | 'LOWERING'         // Descending towards phone
  | 'BOTTOM_REACHED'   // Deep position (~15cm / calibrated proximity reached)
  | 'PUSHING_UP'       // Ascending back up
  | 'REP_COMPLETED';   // Returned to top position, rep counted

export type PushUpCalibrationState =
  | 'INSTRUCTION'      // Prompt phone placement on floor
  | 'CALIBRATING_TOP'  // Hold top plank position (arms extended)
  | 'CALIBRATING_BOTTOM' // Do one slow practice push-up to record bottom depth
  | 'COMPLETED';       // Calibrated and ready for countdown

export interface PushUpCalibrationData {
  topShoulderSpan: number;       // Apparent shoulder span at top (smaller)
  bottomShoulderSpan: number;    // Apparent shoulder span at bottom (larger)
  topElbowAngle: number;         // Elbow angle at top (~150-180 deg)
  bottomElbowAngle: number;      // Elbow angle at bottom (~70-100 deg)
  proximityRange: number;        // bottomSpan - topSpan
  isCalibrated: boolean;
}

export interface PushUpFrameMetrics {
  timestampMs: number;
  leftElbowAngle: number;
  rightElbowAngle: number;
  avgElbowAngle: number;
  shoulderSpan: number;          // Distance between shoulders
  proximityScore: number;        // 0.0 (top) to 1.0 (bottom) based on calibration/defaults
  headProximity: number;         // Nose to shoulder midpoint or depth indicator
  isBodyVisible: boolean;
  confidence: number;
  landmarks: NormalizedLandmark[];
}

export interface PushUpDebugInfo {
  state: PushUpState;
  completedReps: number;
  targetReps: number | null;
  mode: PushUpMode;
  avgElbowAngle: number;
  shoulderSpan: number;
  proximityScore: number;        // 0 (top) to 1 (bottom)
  stateDurationMs: number;
  repPaceRpm: number;
  lastRejectionReason: string;
  isCalibrated: boolean;
  statusMessage: string;
}

