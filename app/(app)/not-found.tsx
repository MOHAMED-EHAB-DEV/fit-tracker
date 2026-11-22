import React from "react";
import Link from "next/link";
import { STATUS_PRIMARY_CLASS, StatusScreen } from "@/components/shared/StatusScreen";

export default function AppNotFound() {
  return (
    <StatusScreen
      title="Not found"
      message="This page does not exist, or the item it showed has been deleted."
      primaryAction={
        <Link href="/dashboard" className={STATUS_PRIMARY_CLASS}>
          Go to Today
        </Link>
      }
      secondaryHref="/workouts"
      secondaryLabel="Go to Train"
    />
  );
}
