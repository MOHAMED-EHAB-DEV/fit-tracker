"use client";

import React, { useEffect } from "react";
import { STATUS_PRIMARY_CLASS, StatusScreen } from "@/components/shared/StatusScreen";

export default function AuthError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("[auth] page error", error);
  }, [error]);

  return (
    <StatusScreen
      fullScreen
      isError
      title="This page could not load"
      message="Something went wrong on our side. Try again in a moment."
      reference={error?.digest}
      primaryAction={
        <button type="button" onClick={() => retry()} className={STATUS_PRIMARY_CLASS}>
          Try again
        </button>
      }
      secondaryHref="/login"
      secondaryLabel="Go to sign in"
    />
  );
}
