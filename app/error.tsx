"use client";

import React, { useEffect } from "react";
import { STATUS_PRIMARY_CLASS, StatusScreen } from "@/components/shared/StatusScreen";

export default function RootError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("[app] page error", error);
  }, [error]);

  return (
    <StatusScreen
      fullScreen
      isError
      title="This page could not load"
      message="Something went wrong on our side. Nothing you saved has been lost. Try again; if it keeps happening, check your connection."
      reference={error?.digest}
      primaryAction={
        <button type="button" onClick={() => retry()} className={STATUS_PRIMARY_CLASS}>
          Try again
        </button>
      }
      secondaryHref="/"
      secondaryLabel="Go to Today"
    />
  );
}
