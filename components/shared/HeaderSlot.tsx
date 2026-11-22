"use client";

import React, { createContext, useContext, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Lets a screen put a control into the shared page header (which the app
 * layout renders), e.g. Today's streak chip:
 *
 *   <HeaderActions><StreakChip … /></HeaderActions>
 *
 * The header renders <HeaderSlotTarget />; the content is portalled there
 * after hydration, so keep it small and fixed-size.
 */
const HeaderSlotContext = createContext<{
  target: HTMLElement | null;
  setTarget: (element: HTMLElement | null) => void;
} | null>(null);

export function HeaderSlotProvider({ children }: { children: React.ReactNode }) {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  return <HeaderSlotContext.Provider value={{ target, setTarget }}>{children}</HeaderSlotContext.Provider>;
}

/** Where header actions from the current screen appear. */
export function HeaderSlotTarget() {
  const slot = useContext(HeaderSlotContext);
  return <span ref={slot?.setTarget} className="flex items-center" />;
}

/** Renders its children in the page header. */
export function HeaderActions({ children }: { children: React.ReactNode }) {
  const slot = useContext(HeaderSlotContext);
  if (!slot?.target) return null;
  return createPortal(children, slot.target);
}

export default HeaderActions;
