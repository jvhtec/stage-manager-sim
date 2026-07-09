import { useEffect, useRef, useState } from 'react';

/**
 * Tweens a displayed number toward `value` over `durationMs` using
 * requestAnimationFrame. No animation library dependency — this is the HUD's
 * only numeric motion until the juice pass adds framer-motion for richer
 * effects (see docs/game-feel-plan.md workstream D).
 */
export function useCountUp(value: number, durationMs = 600): number {
  const [displayed, setDisplayed] = useState(value);
  const fromRef = useRef(value);
  const frameRef = useRef<number>();

  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    if (from === to) return;

    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / durationMs);
      // Ease-out cubic — fast start, gentle settle.
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = from + (to - from) * eased;
      setDisplayed(current);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
      }
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return displayed;
}
