"use client";

import React from "react";
import Image from "next/image";
import { Calendar, Camera, CheckCircle2, FileText, Pencil, Ruler, Sparkles, Trash2, TrendingUp } from "lucide-react";
import type { WeightUnit } from "@/lib/fitness/units";
import type { CheckInAnalysisDTO, CheckInDTO } from "@/lib/body-comp/dto";
import { MEASUREMENT_KEYS } from "@/lib/validation/body-comp";
import { displayLength, displayWeight, lengthUnitFor } from "@/lib/body-comp/units";
import { formatDateString, formatTimeInZone } from "@/lib/time";

export function AnalysisView({ analysis, title = "AI physique analysis" }: { analysis: Omit<CheckInAnalysisDTO, "generatedAt" | "modelUsed"> & { modelUsed?: string }; title?: string }) {
  return (
    <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="text-sm font-extrabold text-emerald-400 flex items-center gap-2">
          <Sparkles className="w-4 h-4" aria-hidden="true" />
          {title}
        </span>
        <span className="flex items-center gap-2 flex-wrap">
          {analysis.estimatedBodyFatPercent !== null && (
            <span className="text-sm font-black px-2.5 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 tabular-nums">
              ~{analysis.estimatedBodyFatPercent}% BF
            </span>
          )}
          {analysis.estimatedBodyFatRange && (
            <span className="text-xs text-zinc-300">Range {analysis.estimatedBodyFatRange}</span>
          )}
        </span>
      </div>
      {analysis.qualitativeNotes && <p className="text-sm text-zinc-200 leading-relaxed">{analysis.qualitativeNotes}</p>}
      {analysis.comparedToPrevious && (
        <p className="p-2.5 rounded-xl bg-zinc-950/60 border border-white/6 flex items-start gap-2 text-sm text-zinc-300">
          <TrendingUp className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" aria-hidden="true" />
          <span>
            <span className="font-bold text-teal-300 me-1">Comparison:</span>
            {analysis.comparedToPrevious}
          </span>
        </p>
      )}
      {analysis.muscleGroupHighlights.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Standout muscle groups">
          {analysis.muscleGroupHighlights.map((item, i) => (
            <li key={i} className="text-xs font-semibold px-2.5 py-0.5 rounded-lg bg-zinc-900 text-zinc-200 border border-white/10">
              {item}
            </li>
          ))}
        </ul>
      )}
      {analysis.recommendations.length > 0 && (
        <ul className="text-sm text-zinc-300 space-y-1.5 pt-2 border-t border-white/6" aria-label="Recommendations">
          {analysis.recommendations.map((rec, i) => (
            <li key={i} className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
              <span className="leading-snug">{rec}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-zinc-400">
        AI estimate, not a measurement{analysis.modelUsed ? ` · ${analysis.modelUsed}` : ""}.
      </p>
    </div>
  );
}

interface CheckInCardProps {
  item: CheckInDTO;
  weightUnit: WeightUnit;
  timeZone: string;
  onEdit: (item: CheckInDTO) => void;
  onDelete: (item: CheckInDTO) => void;
  onOpenPhoto: (url: string) => void;
  onPhotoError: () => void;
}

const LABELS: Record<string, string> = { chest: "Chest", waist: "Waist", hips: "Hips", arms: "Arms", thighs: "Thighs" };

export function CheckInCard({ item, weightUnit, timeZone, onEdit, onDelete, onOpenPhoto, onPhotoError }: CheckInCardProps) {
  const lengthUnit = lengthUnitFor(weightUnit);
  const dateLabel = item.dateString
    ? formatDateString(item.dateString, { weekday: "short", month: "short", day: "numeric", year: "numeric" })
    : "Unknown date";
  const timeLabel = item.checkInDate ? formatTimeInZone(item.checkInDate, timeZone) : "";
  const aiBf = item.aiAnalysis?.estimatedBodyFatPercent ?? null;
  const photos = item.photos.filter((p) => p.url);
  const missingPhotos = item.photos.length - photos.length;

  return (
    <article className="p-4 sm:p-6 rounded-[28px] bg-zinc-900/85 border border-white/10 space-y-4">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/6">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0" aria-hidden="true">
            <Calendar className="w-4 h-4" />
          </div>
          <h3 className="font-extrabold text-base text-white">
            {dateLabel}
            {timeLabel && <span className="ms-2 text-sm text-zinc-400 font-medium">{timeLabel}</span>}
          </h3>
        </div>
        <div className="flex items-center gap-2 flex-wrap self-end sm:self-auto">
          {item.weightKg !== null && (
            <div className="px-3 py-1.5 rounded-xl bg-zinc-950/80 border border-white/8 text-end">
              <span className="text-xs uppercase font-bold text-zinc-400 block">Weight</span>
              <span className="font-black text-base text-white tabular-nums">
                {displayWeight(item.weightKg, weightUnit)} <span className="text-xs font-normal text-zinc-400">{weightUnit}</span>
              </span>
            </div>
          )}
          {item.bodyFatPercent !== null ? (
            <div className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-end">
              <span className="text-xs uppercase font-bold text-emerald-400 block">Body fat</span>
              <span className="font-black text-base text-emerald-300 tabular-nums">{item.bodyFatPercent}%</span>
            </div>
          ) : (
            aiBf !== null && (
              <div className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-end">
                <span className="text-xs uppercase font-bold text-emerald-400 block">Body fat (AI est.)</span>
                <span className="font-black text-base text-emerald-300 tabular-nums">~{aiBf}%</span>
              </div>
            )
          )}
          <button
            type="button"
            onClick={() => onEdit(item)}
            aria-label={`Edit check-in from ${dateLabel}`}
            className="w-11 h-11 flex items-center justify-center rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white cursor-pointer"
          >
            <Pencil className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(item)}
            aria-label={`Delete check-in from ${dateLabel}`}
            className="w-11 h-11 flex items-center justify-center rounded-xl bg-zinc-800 hover:bg-red-500/15 text-zinc-300 hover:text-red-400 cursor-pointer"
          >
            <Trash2 className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </header>

      {item.photos.length > 0 && (
        <div className="space-y-2">
          <span className="text-xs uppercase font-bold text-zinc-400 tracking-wider flex items-center gap-1.5">
            <Camera className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
            Private photo{item.photos.length > 1 ? "s" : ""}
          </span>
          <div className="flex items-center gap-3 overflow-x-auto pb-1">
            {photos.map((photo, index) => (
              <button
                type="button"
                key={index}
                onClick={() => photo.url && onOpenPhoto(photo.url)}
                className="relative w-28 h-36 sm:w-32 sm:h-40 rounded-2xl overflow-hidden border border-white/10 bg-zinc-950 shrink-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                aria-label={`View ${photo.angle} photo from ${dateLabel} full size`}
              >
                <Image
                  src={photo.url as string}
                  alt=""
                  fill
                  unoptimized
                  sizes="128px"
                  referrerPolicy="no-referrer"
                  onError={onPhotoError}
                  className="object-cover"
                />
              </button>
            ))}
            {missingPhotos > 0 && <p className="text-xs text-zinc-400">A photo could not be loaded.</p>}
          </div>
        </div>
      )}

      {item.measurements && (
        <div className="p-3.5 rounded-2xl bg-zinc-950/60 border border-white/8 space-y-2">
          <span className="text-xs uppercase font-bold text-teal-400 tracking-wider flex items-center gap-1.5">
            <Ruler className="w-3.5 h-3.5" aria-hidden="true" />
            Measurements
          </span>
          <dl className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
            {MEASUREMENT_KEYS.map((key) => {
              const value = item.measurements?.[key];
              if (value == null) return null;
              return (
                <div key={key} className="p-2 rounded-xl bg-zinc-900 border border-white/5">
                  <dt className="text-xs text-zinc-400 uppercase font-semibold">{LABELS[key]}</dt>
                  <dd className="font-extrabold text-sm text-white tabular-nums">
                    {displayLength(value, lengthUnit)} {lengthUnit}
                  </dd>
                </div>
              );
            })}
          </dl>
        </div>
      )}

      {item.notes && (
        <p className="p-3.5 rounded-2xl bg-zinc-950/40 border border-white/6 flex items-start gap-2.5 text-sm text-zinc-300 leading-relaxed">
          <FileText className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" aria-hidden="true" />
          <span>{item.notes}</span>
        </p>
      )}

      {item.aiAnalysis && <AnalysisView analysis={item.aiAnalysis} />}
    </article>
  );
}
