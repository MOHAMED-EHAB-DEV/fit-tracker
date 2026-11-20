"use client";

import React, { useSyncExternalStore } from "react";

const subscribe = () => () => undefined;

/**
 * Renders its children only in the browser. Used for screens whose first
 * render depends on data stored on the device (an unsent workout draft), so
 * the server and the browser never disagree about what to show.
 */
export function ClientOnly({ children, fallback = null }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  const isClient = useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );
  return <>{isClient ? children : fallback}</>;
}

export default ClientOnly;
