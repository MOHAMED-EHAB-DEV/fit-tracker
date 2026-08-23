import { useEffect, useState } from "react";

export function useAnimationPresence(
  isOpen: boolean,
  durationMs: number = 200
): { shouldRender: boolean; isAnimatingOut: boolean } {
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    if (isOpen) {
      setShouldRender(true);
      setIsAnimatingOut(false);
    } else if (shouldRender) {
      setIsAnimatingOut(true);
      timeoutId = setTimeout(() => {
        setShouldRender(false);
        setIsAnimatingOut(false);
      }, durationMs);
    }

    return () => clearTimeout(timeoutId);
  }, [isOpen, durationMs, shouldRender]);

  return { shouldRender, isAnimatingOut };
}
