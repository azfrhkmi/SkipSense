import { JumpState, StateTransitionEvent } from '../types/pose';
import { JumpConfig, DEFAULT_JUMP_CONFIG } from '../config/jumpConfig';

export class JumpStateMachine {
  private currentState: JumpState = 'GROUNDED';
  private config: JumpConfig;
  private stateEntryTime = 0;
  private airborneEntryTime = 0;
  private lastJumpCountedTime = 0;
  private lastAirborneDuration = 0;
  private peakDisplacement = 0;
  private landingConfirmations = 0;

  private lastRejectionReason = 'None';
  private recentTransitions: StateTransitionEvent[] = [];

  constructor(config: Partial<JumpConfig> = {}) {
    this.config = { ...DEFAULT_JUMP_CONFIG, ...config };
  }

  public get state(): JumpState {
    return this.currentState;
  }

  public get lastJumpTime(): number {
    return this.lastJumpCountedTime;
  }

  public get airborneDuration(): number {
    return this.lastAirborneDuration;
  }

  public get rejectionReason(): string {
    return this.lastRejectionReason;
  }

  public get transitions(): StateTransitionEvent[] {
    return this.recentTransitions;
  }

  public updateConfig(config: Partial<JumpConfig>) {
    this.config = { ...this.config, ...config };
  }

  /**
   * Evaluates state transition based on current displacement and velocity.
   *
   * @param normDisplacement Upward displacement scaled to torso length (0 = grounded baseline, >0 = in air)
   * @param velocityUpward Rate of upward displacement change (positive = moving up, negative = descending)
   * @param timestampMs Frame timestamp in ms
   * @param bothFeetAirborne Boolean indicator that both feet/ankles have lifted
   * @param confidence Landmark confidence score
   * @returns boolean true if a jump was completed and confirmed on landing
   */
  public step(
    normDisplacement: number,
    velocityUpward: number,
    timestampMs: number,
    bothFeetAirborne: boolean,
    confidence: number
  ): boolean {
    let jumpCounted = false;

    // 1. Timeout Guard: if stuck in TAKEOFF, AIRBORNE, or LANDING for too long, reset to GROUNDED
    if (
      this.currentState !== 'GROUNDED' &&
      timestampMs - this.stateEntryTime > this.config.maxJumpDurationMs
    ) {
      this.lastRejectionReason = `Timeout in state ${this.currentState} (>${this.config.maxJumpDurationMs}ms)`;
      this.transitionTo('GROUNDED', timestampMs, normDisplacement, velocityUpward, confidence);
      return false;
    }

    switch (this.currentState) {
      case 'GROUNDED': {
        const timeSinceLastJump = timestampMs - this.lastJumpCountedTime;

        // Check if upward movement has started
        if (normDisplacement >= this.config.takeoffThresholdNorm && velocityUpward > 0.08) {
          if (timeSinceLastJump < this.config.refractoryPeriodMs) {
            this.lastRejectionReason = `Refractory period active (${Math.round(timeSinceLastJump)}ms < ${this.config.refractoryPeriodMs}ms)`;
            return false;
          }

          this.peakDisplacement = normDisplacement;
          this.transitionTo('TAKEOFF', timestampMs, normDisplacement, velocityUpward, confidence);
        }
        break;
      }

      case 'TAKEOFF': {
        if (normDisplacement > this.peakDisplacement) {
          this.peakDisplacement = normDisplacement;
        }

        // Abort check: if movement dies out or reverses before airborne threshold
        if (velocityUpward < -0.1 && normDisplacement < this.config.takeoffThresholdNorm * 0.7) {
          this.lastRejectionReason = `Takeoff aborted: insufficient upward lift (peak: ${this.peakDisplacement.toFixed(3)})`;
          this.transitionTo('GROUNDED', timestampMs, normDisplacement, velocityUpward, confidence);
          break;
        }

        // Transition to AIRBORNE: displacement reaches airborne threshold
        if (normDisplacement >= this.config.airborneThresholdNorm) {
          // If both feet confirmed airborne OR displacement is high enough
          if (bothFeetAirborne || normDisplacement >= this.config.airborneThresholdNorm * 1.15) {
            this.airborneEntryTime = timestampMs;
            this.transitionTo('AIRBORNE', timestampMs, normDisplacement, velocityUpward, confidence);
          }
        }
        break;
      }

      case 'AIRBORNE': {
        if (normDisplacement > this.peakDisplacement) {
          this.peakDisplacement = normDisplacement;
        }

        const airborneDuration = timestampMs - this.airborneEntryTime;

        // Apex passed and descent has clearly begun
        const isDescending = velocityUpward < -0.06 || normDisplacement <= this.peakDisplacement * 0.85;

        if (isDescending) {
          if (airborneDuration < this.config.minAirborneDurationMs) {
            // Noise flicker check
            if (velocityUpward < -0.3) {
              this.lastRejectionReason = `Airborne phase too short (${Math.round(airborneDuration)}ms < ${this.config.minAirborneDurationMs}ms)`;
              this.transitionTo('GROUNDED', timestampMs, normDisplacement, velocityUpward, confidence);
              break;
            }
          }

          this.lastAirborneDuration = airborneDuration;
          this.landingConfirmations = 0;
          this.transitionTo('LANDING', timestampMs, normDisplacement, velocityUpward, confidence);
        }
        break;
      }

      case 'LANDING': {
        // Landing conditions:
        // A: Displacement returned below landing threshold
        const nearGround = normDisplacement <= this.config.landingThresholdNorm;

        // B: Downward velocity has slowed and stabilized (impact/contact completed)
        const velocityStabilized = velocityUpward >= -0.05 && normDisplacement <= this.config.landingThresholdNorm * 1.25;

        // C: Downward movement reached local ground contact
        if (nearGround || velocityStabilized) {
          this.landingConfirmations++;

          if (this.landingConfirmations >= this.config.consecutiveLandingFrames) {
            // CONFIRMED LANDING: COUNT JUMP!
            jumpCounted = true;
            this.lastJumpCountedTime = timestampMs;
            this.lastRejectionReason = 'None (Jump Successful)';
            this.transitionTo('COUNTED', timestampMs, normDisplacement, velocityUpward, confidence);
          }
        }
        break;
      }

      case 'COUNTED': {
        // Immediately return to GROUNDED ready for the next skip cycle
        this.transitionTo('GROUNDED', timestampMs, normDisplacement, velocityUpward, confidence);
        break;
      }
    }

    return jumpCounted;
  }

  private transitionTo(
    newState: JumpState,
    timestampMs: number,
    displacement: number,
    velocity: number,
    confidence: number
  ) {
    const event: StateTransitionEvent = {
      from: this.currentState,
      to: newState,
      timestamp: timestampMs,
      displacement,
      velocity,
      confidence,
    };

    this.recentTransitions.unshift(event);
    if (this.recentTransitions.length > 8) {
      this.recentTransitions.pop();
    }

    this.currentState = newState;
    this.stateEntryTime = timestampMs;
  }

  public reset(timestampMs = 0) {
    this.currentState = 'GROUNDED';
    this.stateEntryTime = timestampMs;
    this.airborneEntryTime = 0;
    this.lastJumpCountedTime = 0;
    this.lastAirborneDuration = 0;
    this.peakDisplacement = 0;
    this.landingConfirmations = 0;
    this.lastRejectionReason = 'None';
  }
}
