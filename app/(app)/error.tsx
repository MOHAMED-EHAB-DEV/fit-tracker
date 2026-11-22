"use client";

import React, { useEffect } from "react";
import { STATUS_PRIMARY_CLASS, StatusScreen } from "@/components/shared/StatusScreen";

export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("[app] section error", error);
  }, [error]);

  return (
    <StatusScreen
      isError
      title="This screen could not load"
      message="Something went wrong while loading your data. Nothing you saved has been lost. Try again; if it keeps happening, check your connection."
      reference={error?.digest}
      primaryAction={
        <button type="button" onClick={() => retry()} className={STATUS_PRIMARY_CLASS}>
          Try again
        </button>
      }
      secondaryHref="/dashboard"
      secondaryLabel="Go to Today"
    />
  );
}
