/**
 * Local Web Audio API Synthesizer for Push-Up Mode.
 * 100% offline, zero external audio dependency, iOS Safari compatible.
 */
class PushUpSoundService {
  private static instance: PushUpSoundService | null = null;
  private audioCtx: AudioContext | null = null;
  private muted = false;

  public static getInstance(): PushUpSoundService {
    if (!PushUpSoundService.instance) {
      PushUpSoundService.instance = new PushUpSoundService();
    }
    return PushUpSoundService.instance;
  }

  private getContext(): AudioContext | null {
    if (this.muted) return null;
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  public setMuted(muted: boolean) {
    this.muted = muted;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    return this.muted;
  }

  /**
   * Crisp celebratory chime for each completed repetition.
   * Sine sweep from 880Hz to 1200Hz with exponential decay.
   */
  public playRepTick() {
    if (this.muted) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      const now = ctx.currentTime;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(1320, now + 0.12);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.18);
    } catch {
      // Audio playback fails gracefully if browser policy restricts
    }
  }

  /**
   * Subtle crisp jump tick for skipping feedback without fatiguing ears.
   */
  public playJumpTick() {
    if (this.muted) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const now = ctx.currentTime;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(660, now);
      osc.frequency.exponentialRampToValueAtTime(920, now + 0.06);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.09);
    } catch {
      // Ignore audio policy errors
    }
  }

  /**
   * Uplifting 2-note chime on milestones (e.g. every 25 jumps or 5 push-ups).
   */
  public playMilestoneChime() {
    if (this.muted) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const freqs = [783.99, 1046.5];
      const startTime = ctx.currentTime;

      freqs.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const t = startTime + i * 0.09;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t);

        gain.gain.setValueAtTime(0.22, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(t);
        osc.stop(t + 0.24);
      });
    } catch {
      // Ignore audio policy errors
    }
  }

  /**
   * 4-note victory fanfare played once upon reaching the target reps (10, 20, 30).
   * Notes: C5 (523Hz), E5 (659Hz), G5 (784Hz), C6 (1046Hz).
   */
  public playTargetFanfare() {
    if (this.muted) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const notes = [523.25, 659.25, 783.99, 1046.5];
      const noteDuration = 0.14;
      const startTime = ctx.currentTime;

      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const t = startTime + idx * noteDuration;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t);

        const duration = idx === notes.length - 1 ? 0.35 : noteDuration;
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(t);
        osc.stop(t + duration + 0.05);
      });
    } catch {
      // Ignore audio policy errors
    }
  }
}

export const pushUpSound = PushUpSoundService.getInstance();

