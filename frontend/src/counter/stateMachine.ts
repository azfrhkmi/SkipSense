import { JumpState } from '../types/pose';

export interface StateMachineConfig {
  takeoffThresholdNorm: number;    // e.g. 0.08 of torso height
  airborneThresholdNorm: number;   // e.g. 0.16 of torso height
  landingThresholdNorm: number;    // e.g. 0.07 of torso height
  refractoryPeriodMs: number;      // e.g. 280ms
  consecutiveLandingFrames: number;// e.g. 2 frames to confirm landing
  maxJumpDurationMs: number;       // e.g. 1000ms (jump cannot float in air longer than this)
}

export const DEFAULT_STATE_MACHINE_CONFIG: StateMachineConfig = {
  takeoffThresholdNorm: 0.08,
  airborneThresholdNorm: 0.16,
  landingThresholdNorm: 0.07,
  refractoryPeriodMs: 280,
  consecutiveLandingFrames: 2,
  maxJumpDurationMs: 1200,
};

export class JumpStateMachine {
  private currentState: JumpState = 'GROUNDED';
  private config: StateMachineConfig;
  private stateEntryTime = 0;
  private lastJumpCountedTime = 0;
  private landingConfirmations = 0;

  constructor(config: Partial<StateMachineConfig> = {}) {
    this.config = { ...DEFAULT_STATE_MACHINE_CONFIG, ...config };
  }

  public get state(): JumpState {
    return this.currentState;
  }

  public get lastJumpTime(): number {
    return this.lastJumpCountedTime;
  }

  /**
   * Updates state based on normalized vertical displacement (positive = upward jump)
   * and vertical movement velocity (negative = moving up, positive = moving down in y-screen coords;
   * here normalizedDisplacement is defined such that higher in air = higher positive displacement).
   *
   * @param normDisplacement Upward displacement scaled to torso length (0 = grounded baseline, >0 = in air)
   * @param velocityUpward Rate of upward displacement change (positive = moving up, negative = falling down)
   * @param timestampMs Current frame timestamp in ms
   * @param bothFeetAirborne Boolean indicator that both ankles/feet have lifted
   * @returns true if a completed jump is confirmed on LANDING during this update
   */
  public step(
    normDisplacement: number,
    velocityUpward: number,
    timestampMs: number,
    bothFeetAirborne: boolean
  ): boolean {
    let jumpCounted = false;

    // Timeout guard: if stuck in TAKEOFF or AIRBORNE for too long, reset to GROUNDED
    if (
      (this.currentState === 'TAKEOFF' || this.currentState === 'AIRBORNE') &&
      timestampMs - this.stateEntryTime > this.config.maxJumpDurationMs
    ) {
      this.transitionTo('GROUNDED', timestampMs);
    }

    switch (this.currentState) {
      case 'GROUNDED': {
        // Must respect refractory period before starting next jump takeoff
        const timeSinceLastJump = timestampMs - this.lastJumpCountedTime;
        if (timeSinceLastJump >= this.config.refractoryPeriodMs) {
          // Check for takeoff: displacement crosses takeoff threshold with upward velocity
          if (normDisplacement >= this.config.takeoffThresholdNorm && velocityUpward > 0.15) {
            this.transitionTo('TAKEOFF', timestampMs);
          }
        }
        break;
      }

      case 'TAKEOFF': {
        // If movement aborts before reaching airborne threshold
        if (normDisplacement < this.config.takeoffThresholdNorm * 0.5 && velocityUpward < 0) {
          this.transitionTo('GROUNDED', timestampMs);
          break;
        }

        // Ascending into AIRBORNE phase
        if (normDisplacement >= this.config.airborneThresholdNorm && bothFeetAirborne) {
          this.transitionTo('AIRBORNE', timestampMs);
        }
        break;
      }

      case 'AIRBORNE': {
        // Apex reached and starting downward descent towards landing
        if (velocityUpward < 0 && normDisplacement <= this.config.airborneThresholdNorm * 0.85) {
          this.landingConfirmations = 0;
          this.transitionTo('LANDING', timestampMs);
        }
        break;
      }

      case 'LANDING': {
        // Approaching baseline
        if (normDisplacement <= this.config.landingThresholdNorm) {
          this.landingConfirmations++;
          if (this.landingConfirmations >= this.config.consecutiveLandingFrames) {
            // CONFIRMED LANDING: Count jump!
            this.transitionTo('COUNTED', timestampMs);
            this.lastJumpCountedTime = timestampMs;
            jumpCounted = true;
          }
        }
        break;
      }

      case 'COUNTED': {
        // Stay in counted for current frame, then return to grounded
        this.transitionTo('GROUNDED', timestampMs);
        break;
      }
    }

    return jumpCounted;
  }

  private transitionTo(newState: JumpState, timestampMs: number) {
    this.currentState = newState;
    this.stateEntryTime = timestampMs;
  }

  public reset(timestampMs = 0) {
    this.currentState = 'GROUNDED';
    this.stateEntryTime = timestampMs;
    this.lastJumpCountedTime = 0;
    this.landingConfirmations = 0;
  }
}
