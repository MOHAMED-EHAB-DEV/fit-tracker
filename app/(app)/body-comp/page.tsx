import React, { Suspense } from "react";
import { Metadata } from "next";
import { Loader2 } from "lucide-react";
import { getFullUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongoose";
import BodyComp from "@/lib/db/models/BodyComp";
import { BodyCompClient, CheckInItem } from "@/components/body-comp/BodyCompClient";

export const metadata: Metadata = {
  title: "Body Composition & Check-Ins — AI Fit Tracker",
  description: "Record weight, body fat %, and private AI progress photo check-ins.",
};

async function BodyCompDataLoader() {
  const user = await getFullUser();
  await getDb();

  let initialCheckIns: CheckInItem[] = [];

  if (user) {
    const rawCheckIns = await BodyComp.find({ userId: user._id })
      .sort({ checkInDate: -1 })
      .limit(30)
      .lean();

    initialCheckIns = rawCheckIns.map((doc: any) => ({
      _id: doc._id.toString(),
      checkInDate: doc.checkInDate ? new Date(doc.checkInDate).toISOString() : new Date().toISOString(),
      dateString: doc.dateString || "",
      weight: doc.weight ?? null,
      bodyFatPercent: doc.bodyFatPercent ?? null,
      measurements: doc.measurements
        ? {
            chest: doc.measurements.chest ?? null,
            waist: doc.measurements.waist ?? null,
            hips: doc.measurements.hips ?? null,
            arms: doc.measurements.arms ?? null,
            thighs: doc.measurements.thighs ?? null,
          }
        : null,
      photos: Array.isArray(doc.photos)
        ? doc.photos.map((p: any) => ({
            cloudinaryPublicId: p.cloudinaryPublicId || "",
            angle: p.angle || "front",
            signedUrl: p.signedUrl || "",
          }))
        : [],
      aiAnalysis: doc.aiAnalysis
        ? {
            qualitativeNotes: doc.aiAnalysis.qualitativeNotes || "",
            estimatedBodyFatPercent: doc.aiAnalysis.estimatedBodyFatPercent ?? null,
            estimatedBodyFatRange: doc.aiAnalysis.estimatedBodyFatRange || "",
            comparedToPrevious: doc.aiAnalysis.comparedToPrevious || "",
            muscleGroupHighlights: doc.aiAnalysis.muscleGroupHighlights || [],
            recommendations: doc.aiAnalysis.recommendations || [],
            modelUsed: doc.aiAnalysis.modelUsed || "Gemini Flash AI",
            generatedAt: doc.aiAnalysis.generatedAt ? new Date(doc.aiAnalysis.generatedAt).toISOString() : null,
          }
        : null,
      notes: doc.notes || "",
      createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : undefined,
    }));
  }

  return <BodyCompClient initialCheckIns={initialCheckIns} />;
}

export default function BodyCompPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[50vh] text-zinc-500 gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
          <span>Loading body composition data...</span>
        </div>
      }
    >
      <BodyCompDataLoader />
    </Suspense>
  );
}
