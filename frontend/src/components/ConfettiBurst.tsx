import React, { useEffect, useRef } from 'react';

interface ConfettiBurstProps {
  active?: boolean;
  durationMs?: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  vRot: number;
  alpha: number;
}

const COLORS = ['#39E66B', '#5E96FF', '#FF9F0A', '#FF375F', '#A855F7', '#FFFFFF'];

/**
 * Lightweight client-side HTML5 Canvas confetti burst for workout celebrations.
 */
export const ConfettiBurst: React.FC<ConfettiBurstProps> = ({
  active = true,
  durationMs = 3000,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles: Particle[] = Array.from({ length: 75 }, () => {
      const startX = canvas.width * (0.2 + Math.random() * 0.6);
      const startY = canvas.height * 0.28;
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.9;
      const speed = 4 + Math.random() * 10;
      return {
        x: startX,
        y: startY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        size: 5 + Math.random() * 6,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 0.25,
        alpha: 1,
      };
    });

    const startTime = performance.now();
    let frameId = 0;

    const animate = (now: number) => {
      const elapsed = now - startTime;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (elapsed > durationMs) {
        return;
      }

      const fadeProgress = Math.max(0, (elapsed - durationMs * 0.6) / (durationMs * 0.4));

      for (const p of particles) {
        p.vy += 0.24; // gravity
        p.vx *= 0.99; // air drag
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.vRot;
        p.alpha = Math.max(0, 1 - fadeProgress);

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.65);
        ctx.restore();
      }

      frameId = requestAnimationFrame(animate);
    };

    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [active, durationMs]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 1200,
      }}
    />
  );
};

