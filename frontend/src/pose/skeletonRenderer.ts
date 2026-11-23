import { NormalizedLandmark, POSE_CONNECTIONS, WorkoutStatus } from '../types/pose';

export interface SkeletonRenderOptions {
  status: WorkoutStatus;
  mirrored?: boolean; // Set true if canvas itself is NOT CSS-mirrored
}

export class SkeletonRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not get 2D canvas context');
    this.ctx = context;
  }

  public clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  public render(landmarks: NormalizedLandmark[], options: SkeletonRenderOptions) {
    this.clear();
    if (!landmarks || landmarks.length === 0) return;

    const width = this.canvas.width;
    const height = this.canvas.height;
    const ctx = this.ctx;

    // Pick color palette based on status
    const colors = this.getStatusColors(options.status);

    ctx.save();

    // 1. Draw Bones / Connections
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = colors.boneColor;
    ctx.shadowColor = colors.glowColor;
    ctx.shadowBlur = 8;

    for (const [fromIdx, toIdx] of POSE_CONNECTIONS) {
      const from = landmarks[fromIdx];
      const to = landmarks[toIdx];

      if (!from || !to) continue;
      // Skip if visibility is very low
      if ((from.visibility ?? 1.0) < 0.35 || (to.visibility ?? 1.0) < 0.35) continue;

      const fromX = options.mirrored ? (1.0 - from.x) * width : from.x * width;
      const fromY = from.y * height;
      const toX = options.mirrored ? (1.0 - to.x) * width : to.x * width;
      const toY = to.y * height;

      ctx.beginPath();
      ctx.moveTo(fromX, fromY);
      ctx.lineTo(toX, toY);
      ctx.stroke();
    }

    // 2. Draw Joints (circular dots with inner center)
    ctx.shadowBlur = 4;
    for (let i = 0; i < landmarks.length; i++) {
      const lm = landmarks[i];
      if (!lm || (lm.visibility ?? 1.0) < 0.35) continue;

      const x = options.mirrored ? (1.0 - lm.x) * width : lm.x * width;
      const y = lm.y * height;

      // Outer joint dot
      ctx.beginPath();
      ctx.arc(x, y, 4.5, 0, 2 * Math.PI);
      ctx.fillStyle = colors.jointColor;
      ctx.fill();

      // Inner highlight
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, 2 * Math.PI);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
    }

    ctx.restore();
  }

  private getStatusColors(status: WorkoutStatus): {
    boneColor: string;
    jointColor: string;
    glowColor: string;
  } {
    switch (status) {
      case 'ACTIVE':
        return {
          boneColor: '#39E66B',
          jointColor: '#28B854',
          glowColor: 'rgba(57, 230, 107, 0.5)',
        };
      case 'PAUSED':
        return {
          boneColor: '#F5B942',
          jointColor: '#E09C25',
          glowColor: 'rgba(245, 185, 66, 0.4)',
        };
      case 'COUNTDOWN':
      case 'CALIBRATING':
        return {
          boneColor: '#39E66B',
          jointColor: '#28B854',
          glowColor: 'rgba(57, 230, 107, 0.4)',
        };
      case 'TRACKING_LOST':
        return {
          boneColor: '#F05252',
          jointColor: '#C83232',
          glowColor: 'rgba(240, 82, 82, 0.5)',
        };
      case 'IDLE':
      default:
        return {
          boneColor: '#929BA3',
          jointColor: '#6B7280',
          glowColor: 'rgba(146, 155, 163, 0.3)',
        };
    }
  }
}
