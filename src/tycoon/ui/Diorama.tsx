import { useEffect, useRef } from 'react';

/**
 * A small canvas that redraws an isometric diorama every frame while it's on
 * screen (throttled; slower when the player prefers reduced motion).
 */
export function Diorama({
  draw,
  height = 180,
  label,
}: {
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number, time: number) => void;
  height?: number;
  label: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef(draw);
  drawRef.current = draw;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const reduced = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const frameMs = reduced ? 500 : 1000 / 30;
    let raf = 0;
    let last = 0;
    let width = 0;
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      width = canvas.clientWidth;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      last = 0;
    };
    resize();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    ro?.observe(canvas);
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      if (document.hidden || t - last < frameMs || !width) return;
      last = t;
      ctx.clearRect(0, 0, width, height);
      drawRef.current(ctx, width, height, t);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
    };
  }, [height]);

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={label}
      className="tt-diorama"
      style={{ width: '100%', height, display: 'block' }}
    />
  );
}
