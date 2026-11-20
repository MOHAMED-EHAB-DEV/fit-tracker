import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { STATUS_PRIMARY_CLASS, StatusScreen } from "@/components/shared/StatusScreen";

export const metadata: Metadata = { title: "Page not found" };

export default function RootNotFound() {
  return (
    <StatusScreen
      fullScreen
      title="Page not found"
      message="This address does not exist, or what it pointed to has been deleted."
      primaryAction={
        <Link href="/" className={STATUS_PRIMARY_CLASS}>
          Go to Today
        </Link>
      }
    />
  );
}
