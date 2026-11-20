import React, { Suspense } from "react";
import { Metadata } from "next";
import { Loader2 } from "lucide-react";
import { requirePageSession } from "@/lib/auth/session";
import { getTodayDateString } from "@/lib/fitness/timezone";
import { listCheckIns } from "@/lib/body-comp/service";
import { BodyCompClient } from "@/components/body-comp/BodyCompClient";

export const metadata: Metadata = {
  title: "Body",
  description: "Record weight, body fat %, and private AI progress photo check-ins.",
};

async function BodyCompDataLoader() {
  const session = await requirePageSession();
  const page = await listCheckIns(session.userId);

  return (
    <BodyCompClient
      initialCheckIns={page.checkIns}
      initialHasMore={page.hasMore}
      todayStr={getTodayDateString(new Date(), session.timezone)}
      timeZone={session.timezone}
    />
  );
}

export default function BodyCompPage() {
  return (
    <Suspense
      fallback={
        <div role="status" className="flex items-center justify-center min-h-[50vh] text-zinc-400 gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-emerald-400" aria-hidden="true" />
          <span>Loading body composition data...</span>
        </div>
      }
    >
      <BodyCompDataLoader />
    </Suspense>
  );
}
