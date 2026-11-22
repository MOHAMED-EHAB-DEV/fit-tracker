import React, { Suspense } from "react";
import type { Metadata } from "next";
import { requirePageSession, getFullUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongoose";
import BodyComp from "@/lib/db/models/BodyComp";
import { getTodayDateString } from "@/lib/fitness/timezone";
import { listCheckIns } from "@/lib/body-comp/service";
import { buildWeightHistory } from "@/lib/dashboard/weight";
import { ScreenSkeleton } from "@/components/ui/Skeleton";
import { BodyCompClient } from "@/components/body-comp/BodyCompClient";

export const metadata: Metadata = {
  title: "Body",
  description: "Your weight trend, check-ins with body fat and measurements, and private progress photos.",
};

/** Enough weigh-ins for a 90-day chart, even when logged several times a day. */
const WEIGHT_POINTS = 240;

async function BodyCompDataLoader() {
  const session = await requirePageSession();
  await getDb();
  const [page, weightRows, user] = await Promise.all([
    listCheckIns(session.userId),
    BodyComp.find({ userId: session.userId, weight: { $ne: null } })
      .sort({ checkInDate: -1 })
      .limit(WEIGHT_POINTS)
      .select("_id checkInDate dateString weight bodyFatPercent")
      .lean(),
    getFullUser(),
  ]);

  // Each row through the same plausibility check as the dashboard, keeping its id.
  const weights = weightRows.flatMap((row) => {
    const [point] = buildWeightHistory([row], 1);
    return point ? [{ ...point, id: String(row._id) }] : [];
  });

  return (
    <BodyCompClient
      initialCheckIns={page.checkIns}
      initialHasMore={page.hasMore}
      initialWeights={weights}
      todayStr={getTodayDateString(new Date(), session.timezone)}
      timeZone={session.timezone}
      goal={user?.fitnessProfile?.goal ?? null}
      nowMs={new Date().getTime()}
    />
  );
}

export default function BodyCompPage() {
  return (
    <Suspense fallback={<ScreenSkeleton cards={2} />}>
      <BodyCompDataLoader />
    </Suspense>
  );
}
