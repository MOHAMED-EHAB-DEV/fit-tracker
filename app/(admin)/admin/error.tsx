"use client";

import React, { useEffect } from "react";
import { STATUS_PRIMARY_CLASS, StatusScreen } from "@/components/shared/StatusScreen";

export default function AdminError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("Admin panel error:", error);
  }, [error]);

  return (
    <StatusScreen
      isError
      title="This admin page could not load"
      message="The data could not be read, usually because of a temporary database or network problem. Try again; if it keeps failing, check the server logs."
      reference={error?.digest}
      primaryAction={
        <button type="button" onClick={() => retry()} className={STATUS_PRIMARY_CLASS}>
          Try again
        </button>
      }
      secondaryHref="/admin/dashboard"
      secondaryLabel="Admin dashboard"
    />
  );
}
