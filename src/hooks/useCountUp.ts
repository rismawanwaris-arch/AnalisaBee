import { useEffect, useRef, useState } from "react";

/**
 * Smoothly animates a numeric value from its previous value (or 0 on mount)
 * to `target` using an ease-out cubic curve. Respects `prefers-reduced-motion`.
 */
export function useCountUp(target: number | undefined, durationMs = 650): number {
  const [display, setDisplay] = useState<number>(target ?? 0);
  const prevTargetRef = useRef<number>(0);

  useEffect(() => {
    if (target === undefined) return;
    if (
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      prevTargetRef.current = target;
      const timer = setTimeout(() => setDisplay(target), 0);
      return () => clearTimeout(timer);
    }

    const startVal = prevTargetRef.current;
    const delta = target - startVal;
    if (delta === 0) {
      const timer = setTimeout(() => setDisplay(target), 0);
      return () => clearTimeout(timer);
    }

    let rafId = 0;
    const startTime = performance.now();

    function step(now: number) {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(startVal + delta * eased));
      if (t < 1) {
        rafId = requestAnimationFrame(step);
      } else {
        prevTargetRef.current = target!;
      }
    }

    rafId = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(rafId);
      prevTargetRef.current = target;
    };
  }, [target, durationMs]);

  return display;
}
