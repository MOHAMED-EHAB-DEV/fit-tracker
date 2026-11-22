"use client";

import { useEffect, useState } from "react";

/** True once the window has scrolled away from the top (sticky top bars turn to glass). */
export function useScrolled(enabled: boolean = true): boolean {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    const update = () => setScrolled(window.scrollY > 2);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, [enabled]);
  return enabled && scrolled;
}

export default useScrolled;
