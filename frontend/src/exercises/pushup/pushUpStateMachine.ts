import { PushUpConfig } from './pushUpConfig';
import { PushUpFrameMetrics, PushUpState } from './pushUpTypes';

export class PushUpStateMachine {
  private currentState: PushUpState = 'READY';
  private config: PushUpConfig;

  private stateEntryTime = 0;
  private repStartTime = 0;
  private lastRepCountedTime = 0;
  private lowestElbowAngle = 180;
  private highestProximity = 0;

  private lastRejectionReason = 'None';
  private statusMessage = 'READY';

  constructor(config: PushUpConfig) {
    this.config = config;
  }

  public get state(): PushUpState {
    return this.currentState;
  }

  public get rejectionReason(): string {
    return this.lastRejectionReason;
  }

  public get message(): string {
    return this.statusMessage;
  }

  public get lastRepTime(): number {
    return this.lastRepCountedTime;
  }

  public updateConfig(config: PushUpConfig) {
    this.config = config;
  }

  public reset() {
    this.currentState = 'READY';
    this.stateEntryTime = 0;
    this.repStartTime = 0;
    this.lowestElbowAngle = 180;
    this.highestProximity = 0;
    this.lastRejectionReason = 'None';
    this.statusMessage = 'READY';
  }

  /**
   * Steps the state machine with the latest frame metrics.
   * Returns true when a full rep is completed and validated.
   */
  public step(metrics: PushUpFrameMetrics): boolean {
    const { timestampMs, avgElbowAngle, proximityScore, isBodyVisible } = metrics;

    if (!isBodyVisible) {
      this.statusMessage = 'TRACKING LOST';
      return false;
    }

    // Timeout guard: reset if stuck in LOWERING or PUSHING_UP for too long
    if (
      this.currentState !== 'READY' &&
      this.currentState !== 'BOTTOM_REACHED' &&
      timestampMs - this.stateEntryTime > this.config.maxRepDurationMs
    ) {
      this.lastRejectionReason = `Timeout in ${this.currentState} (>${this.config.maxRepDurationMs}ms)`;
      this.transitionTo('READY', timestampMs, 'READY');
      return false;
    }

    let repCompleted = false;

    switch (this.currentState) {
      case 'READY': {
        const timeSinceLastRep = timestampMs - this.lastRepCountedTime;
        this.statusMessage = 'READY';

        // Check if user has started lowering towards phone
        const hasStartedLowering =
          avgElbowAngle < 135 || proximityScore > 0.35;

        if (hasStartedLowering) {
          if (timeSinceLastRep < this.config.refractoryPeriodMs) {
            this.lastRejectionReason = `Refractory cooldown (${Math.round(timeSinceLastRep)}ms)`;
            return false;
          }

          this.repStartTime = timestampMs;
          this.lowestElbowAngle = avgElbowAngle;
          this.highestProximity = proximityScore;
          this.transitionTo('LOWERING', timestampMs, 'LOWER YOUR BODY');
        }
        break;
      }

      case 'LOWERING': {
        this.statusMessage = 'LOWER YOUR BODY';
        if (avgElbowAngle < this.lowestElbowAngle) {
          this.lowestElbowAngle = avgElbowAngle;
        }
        if (proximityScore > this.highestProximity) {
          this.highestProximity = proximityScore;
        }

        // Check if bottom position reached (elbows flexed and chest near phone)
        const isBottomAngle = avgElbowAngle <= this.config.bottomElbowAngleMax;
        const isBottomProximity = proximityScore >= this.config.bottomProximityMin;

        if (isBottomAngle || isBottomProximity) {
          this.transitionTo('BOTTOM_REACHED', timestampMs, 'BOTTOM POSITION DETECTED');
          break;
        }

        // Abort check: if user returns back to top without reaching bottom (partial rep)
        if (
          avgElbowAngle >= this.config.topElbowAngleMin &&
          proximityScore <= this.config.topProximityMax &&
          timestampMs - this.stateEntryTime > 300
        ) {
          this.lastRejectionReason = `Partial rep: min elbow ${Math.round(this.lowestElbowAngle)}°, proximity ${this.highestProximity.toFixed(2)}`;
          this.transitionTo('READY', timestampMs, 'READY');
        }
        break;
      }

      case 'BOTTOM_REACHED': {
        this.statusMessage = 'BOTTOM POSITION DETECTED';
        if (avgElbowAngle < this.lowestElbowAngle) {
          this.lowestElbowAngle = avgElbowAngle;
        }
        if (proximityScore > this.highestProximity) {
          this.highestProximity = proximityScore;
        }

        // Note: Holding at bottom does NOT trigger reps.
        // User must push back up to transition to PUSHING_UP.
        const isPushingUp =
          avgElbowAngle > this.config.bottomElbowAngleMax + 10 ||
          proximityScore < this.highestProximity - 0.15;

        if (isPushingUp) {
          this.transitionTo('PUSHING_UP', timestampMs, 'PUSH UP');
        }

        // If held for over 10 seconds at bottom, reset to READY
        if (timestampMs - this.stateEntryTime > 10000) {
          this.lastRejectionReason = 'Held at bottom too long (>10s)';
          this.transitionTo('READY', timestampMs, 'READY');
        }
        break;
      }

      case 'PUSHING_UP': {
        this.statusMessage = 'PUSH UP';

        // Check if returned to top position (arms extended, proximity returned to top)
        const isTopAngle = avgElbowAngle >= this.config.topElbowAngleMin;
        const isTopProximity = proximityScore <= this.config.topProximityMax;

        if (isTopAngle && isTopProximity) {
          const repDuration = timestampMs - this.repStartTime;

          // Validate minimum rep duration to filter out rapid wiggles
          if (repDuration >= this.config.minRepDurationMs) {
            this.lastRepCountedTime = timestampMs;
            this.transitionTo('REP_COMPLETED', timestampMs, 'REP COMPLETED');
            repCompleted = true;
          } else {
            this.lastRejectionReason = `Rep too fast (${repDuration}ms < ${this.config.minRepDurationMs}ms)`;
            this.transitionTo('READY', timestampMs, 'READY');
          }
        }
        break;
      }

      case 'REP_COMPLETED': {
        // Immediate transition to ready for next repetition
        this.transitionTo('READY', timestampMs, 'READY');
        break;
      }
    }

    return repCompleted;
  }

  private transitionTo(newState: PushUpState, timestampMs: number, statusMsg: string) {
    this.currentState = newState;
    this.stateEntryTime = timestampMs;
    this.statusMessage = statusMsg;
  }
}
