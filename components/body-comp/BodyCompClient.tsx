"use client";

import React, { useCallback, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Camera, ChevronRight, Pencil, Scale, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { useUser } from "@/context/UserContext";
import { errorMessage, requestJson } from "@/components/habits/api";
import { useLiveToday } from "@/components/habits/useLiveToday";
import { useUndoableDelete } from "@/hooks/useUndoableDelete";
import { markDashboardStale } from "@/lib/dashboard/stale";
import { displayLength, displayWeight, lengthUnitFor } from "@/lib/body-comp/units";
import { MEASUREMENT_KEYS } from "@/lib/validation/body-comp";
import { weightChangeTone, type WeightPoint } from "@/lib/dashboard/weight";
import type { CheckInDTO } from "@/lib/body-comp/dto";
import { formatDateString, formatTimeInZone } from "@/lib/time";
import { AnalysisView } from "./AnalysisView";
import { CheckInSheet } from "./CheckInSheet";
import { LogWeightSheet } from "./LogWeightSheet";
import { WeightHero } from "./WeightHero";

interface BodyCompClientProps {
  initialCheckIns: CheckInDTO[];
  initialHasMore: boolean;
  /** Recent weigh-ins for the chart (90 days and the latest), with their check-in ids. */
  initialWeights: Array<WeightPoint & { id: string }>;
  todayStr: string;
  timeZone: string;
  goal: "cut" | "maintain" | "bulk" | null;
  nowMs: number;
}

interface ListResponse {
  success: true;
  checkIns: CheckInDTO[];
  hasMore: boolean;
}

const MEASUREMENT_LABELS: Record<string, string> = { chest: "Chest", waist: "Waist", hips: "Hips", arms: "Arms", thighs: "Thighs" };
const byNewest = (a: CheckInDTO, b: CheckInDTO) => b.checkInDate.localeCompare(a.checkInDate);

function weightPointOf(checkIn: CheckInDTO): (WeightPoint & { id: string }) | null {
  if (checkIn.weightKg === null) return null;
  return {
    id: checkIn._id,
    dateString: checkIn.dateString,
    timestamp: new Date(checkIn.checkInDate).getTime(),
    weightKg: checkIn.weightKg,
    bodyFatPercent: checkIn.bodyFatPercent,
  };
}

/** Body: weight hero and chart, Log weight and Check in, and the history of check-ins. */
export function BodyCompClient({ initialCheckIns, initialHasMore, initialWeights, todayStr, timeZone, goal, nowMs }: BodyCompClientProps) {
  const { toast } = useToast();
  const { weightUnit, refreshUser } = useUser();
  const today = useLiveToday(todayStr, timeZone);
  const lengthUnit = lengthUnitFor(weightUnit);

  const [checkIns, setCheckIns] = useState<CheckInDTO[]>(initialCheckIns);
  const [weights, setWeights] = useState(initialWeights);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loadingMore, setLoadingMore] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [checkInSheet, setCheckInSheet] = useState<{ checkIn: CheckInDTO | null } | null>(null);
  const [detail, setDetail] = useState<CheckInDTO | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<CheckInDTO | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const afterMutation = useCallback(
    async (profileWeightKg: number | null) => {
      markDashboardStale();
      if (profileWeightKg !== null) await refreshUser();
    },
    [refreshUser]
  );

  const upsert = (checkIn: CheckInDTO) => {
    setCheckIns((prev) => [checkIn, ...prev.filter((item) => item._id !== checkIn._id)].sort(byNewest));
    setWeights((prev) => {
      const rest = prev.filter((point) => point.id !== checkIn._id);
      const point = weightPointOf(checkIn);
      return point ? [...rest, point] : rest;
    });
  };

  const forget = (id: string) => {
    setCheckIns((prev) => prev.filter((item) => item._id !== id));
    setWeights((prev) => prev.filter((point) => point.id !== id));
  };

  // Check-ins without photos are deleted with Undo; with photos the user confirms first.
  const removal = useUndoableDelete<CheckInDTO>({
    getId: (item) => item._id,
    commit: async (item) => {
      const data = await requestJson<{ success: true; profileWeightKg: number | null }>(`/api/body-comp/${item._id}`, {
        method: "DELETE",
        keepalive: true,
      });
      forget(item._id);
      await afterMutation(data.profileWeightKg);
    },
    message: (item) => `Check-in from ${formatDateString(item.dateString)} deleted`,
    onError: (_item, error) => toast(errorMessage(error, "Could not delete the check-in."), "error"),
  });

  const visible = checkIns.filter((item) => !removal.isHidden(item._id));
  const chartPoints = useMemo(() => weights.filter((point) => !removal.hiddenIds.has(point.id)), [weights, removal.hiddenIds]);
  const latestWeight = chartPoints.length > 0 ? [...chartPoints].sort((a, b) => b.timestamp - a.timestamp)[0] : null;

  const requestDelete = (item: CheckInDTO) => {
    setDetailOpen(false);
    if (item.photos.length > 0) {
      setDeleteError(null);
      setConfirmDelete(item);
    } else {
      removal.remove(item);
    }
  };

  const deleteWithPhotos = async () => {
    if (!confirmDelete || isDeleting) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const data = await requestJson<{ success: true; profileWeightKg: number | null }>(`/api/body-comp/${confirmDelete._id}`, { method: "DELETE" });
      forget(confirmDelete._id);
      setConfirmDelete(null);
      toast("Check-in and photo deleted", "success");
      await afterMutation(data.profileWeightKg);
    } catch (err) {
      setDeleteError(errorMessage(err, "Could not delete the check-in."));
    } finally {
      setIsDeleting(false);
    }
  };

  const loadMore = async () => {
    if (loadingMore || checkIns.length === 0) return;
    setLoadingMore(true);
    try {
      const last = checkIns[checkIns.length - 1];
      const data = await requestJson<ListResponse>(
        `/api/body-comp?limit=30&before=${encodeURIComponent(last.checkInDate)}&beforeId=${encodeURIComponent(last._id)}`
      );
      setCheckIns((prev) => {
        const seen = new Set(prev.map((item) => item._id));
        return [...prev, ...data.checkIns.filter((item) => !seen.has(item._id))];
      });
      setHasMore(data.hasMore);
    } catch (err) {
      toast(errorMessage(err, "Could not load older check-ins."), "error");
    } finally {
      setLoadingMore(false);
    }
  };

  // Signed photo links expire after 15 minutes; re-sign the loaded page once when one fails.
  const lastResignRef = useRef(0);
  const handlePhotoError = async () => {
    const now = Date.now();
    if (now - lastResignRef.current < 60_000) return;
    lastResignRef.current = now;
    try {
      const limit = Math.min(100, Math.max(1, checkIns.length));
      const data = await requestJson<ListResponse>(`/api/body-comp?limit=${limit}`);
      const fresh = new Map(data.checkIns.map((item) => [item._id, item]));
      setCheckIns((prev) => prev.map((item) => fresh.get(item._id) ?? item));
      setDetail((current) => (current ? (fresh.get(current._id) ?? current) : current));
    } catch {
      // The broken image stays; nothing else to do.
    }
  };

  // Weight change against the previous weigh-in, for each history row.
  const previousWeight = (index: number): number | null => {
    for (let next = index + 1; next < visible.length; next++) {
      if (visible[next].weightKg !== null) return visible[next].weightKg;
    }
    return null;
  };

  const actions = (
    <div className="grid grid-cols-[1.25fr_1fr] gap-2">
      <Button size="lg" startContent={<Scale className="h-4 w-4" />} onClick={() => setLogOpen(true)}>
        Log weight
      </Button>
      <Button size="lg" variant="secondary" onClick={() => setCheckInSheet({ checkIn: null })}>
        Check in
      </Button>
    </div>
  );

  return (
    <div className="space-y-3 lg:grid lg:grid-cols-2 lg:items-start lg:gap-4 lg:space-y-0">
      {chartPoints.length === 0 && visible.length === 0 ? (
        <div className="lg:col-span-2">
          <EmptyState
            icon={<Scale className="h-5 w-5" />}
            title="Log your starting weight"
            description="One number is enough. Add body fat, measurements or a private photo any time with Check in."
            actions={
              <>
                <Button startContent={<Scale className="h-4 w-4" />} onClick={() => setLogOpen(true)}>
                  Log weight
                </Button>
                <Button variant="secondary" onClick={() => setCheckInSheet({ checkIn: null })}>
                  Check in
                </Button>
              </>
            }
          />
        </div>
      ) : (
        <>
          <div className="space-y-3">
            <WeightHero points={chartPoints} weightUnit={weightUnit} goal={goal} nowMs={nowMs} />
            {actions}
          </div>

          <section aria-labelledby="history-title" className="space-y-2">
            <SectionHeader
              id="history-title"
              title="History"
              meta={`${visible.length}${hasMore ? "+" : ""} ${visible.length === 1 && !hasMore ? "entry" : "entries"}`}
            />
            <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
              {visible.map((item, index) => {
                const previous = previousWeight(index);
                const delta = item.weightKg !== null && previous !== null ? Math.round((item.weightKg - previous) * 10) / 10 : null;
                const details = [
                  item.bodyFatPercent !== null
                    ? `${item.bodyFatPercent}% body fat`
                    : item.aiAnalysis?.estimatedBodyFatPercent != null
                      ? `~${item.aiAnalysis.estimatedBodyFatPercent}% body fat (AI)`
                      : null,
                  item.measurements ? "Measurements" : null,
                  item.notes ? "Note" : null,
                ].filter(Boolean);
                return (
                  <li key={item._id}>
                    <button
                      type="button"
                      onClick={() => {
                        setDetail(item);
                        setDetailOpen(true);
                      }}
                      aria-haspopup="dialog"
                      className="flex min-h-14 w-full items-center justify-between gap-3 px-3.5 py-2.5 text-start transition-colors hover:bg-elevated/60 cursor-pointer"
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-ink">{formatDateString(item.dateString)}</span>
                        <span className="mt-0.5 block truncate text-xs text-ink-3">
                          {details.length > 0 ? details.join(" · ") : item.weightKg !== null ? "Weight only" : "Photo"}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2.5">
                        {item.photos.length > 0 && <Camera className="h-4 w-4 text-ink-3" aria-label="Has a progress photo" />}
                        {item.weightKg !== null && (
                          <span className="text-end">
                            <span className="block font-mono text-sm font-medium tabular-nums text-ink">
                              {displayWeight(item.weightKg, weightUnit).toFixed(1)}
                              <span className="text-xs font-normal text-ink-3"> {weightUnit}</span>
                            </span>
                            {delta !== null && delta !== 0 && (
                              <span className={`block font-mono text-xs tabular-nums ${weightChangeTone(delta, goal) === "good" ? "text-ok" : "text-ink-3"}`}>
                                {delta > 0 ? "+" : "−"}
                                {displayWeight(Math.abs(delta), weightUnit).toFixed(1)}
                              </span>
                            )}
                          </span>
                        )}
                        <ChevronRight className="h-4 w-4 text-ink-3" aria-hidden="true" />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {hasMore && (
              <Button variant="secondary" fullWidth isLoading={loadingMore} onClick={() => void loadMore()}>
                Load older check-ins
              </Button>
            )}
          </section>
        </>
      )}

      <LogWeightSheet
        isOpen={logOpen}
        onClose={() => setLogOpen(false)}
        weightUnit={weightUnit}
        today={today}
        lastWeight={latestWeight ? String(displayWeight(latestWeight.weightKg, weightUnit)) : null}
        onSaved={(checkIn, profileWeightKg) => {
          upsert(checkIn);
          toast(profileWeightKg !== null ? "Weight logged. Your targets were updated." : "Weight logged", "success");
          void afterMutation(profileWeightKg);
        }}
      />

      <CheckInSheet
        isOpen={Boolean(checkInSheet)}
        onClose={() => setCheckInSheet(null)}
        checkIn={checkInSheet?.checkIn ?? null}
        weightUnit={weightUnit}
        today={today}
        onSaved={(checkIn, profileWeightKg, kind) => {
          upsert(checkIn);
          toast(kind === "updated" ? "Check-in updated" : profileWeightKg !== null ? "Check-in saved. Your targets were updated." : "Check-in saved", "success");
          void afterMutation(profileWeightKg);
        }}
      />

      <Sheet
        isOpen={detailOpen && Boolean(detail)}
        onClose={() => setDetailOpen(false)}
        title={detail ? formatDateString(detail.dateString, { weekday: "long", month: "long", day: "numeric", year: "numeric" }) : "Check-in"}
        description={detail?.checkInDate ? formatTimeInZone(detail.checkInDate, timeZone) : undefined}
        footer={
          detail && (
            <div className="flex w-full items-center justify-between gap-2">
              <Button variant="ghost" className="text-danger hover:text-danger" startContent={<Trash2 className="h-4 w-4" />} onClick={() => requestDelete(detail)}>
                Delete
              </Button>
              <Button
                variant="secondary"
                startContent={<Pencil className="h-4 w-4" />}
                onClick={() => {
                  setDetailOpen(false);
                  setCheckInSheet({ checkIn: detail });
                }}
              >
                Edit
              </Button>
            </div>
          )
        }
      >
        {detail && (
          <div className="space-y-4">
            <dl className="grid grid-cols-2 overflow-hidden rounded-control border border-line bg-surface [&>div+div]:border-s [&>div]:border-line">
              <div className="px-3 py-2.5">
                <dt className="text-xs text-ink-3">Weight</dt>
                <dd className="font-mono text-[17px] font-semibold tabular-nums text-ink">
                  {detail.weightKg !== null ? (
                    <>
                      {displayWeight(detail.weightKg, weightUnit).toFixed(1)}
                      <span className="text-xs font-normal text-ink-3"> {weightUnit}</span>
                    </>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div className="px-3 py-2.5">
                <dt className="text-xs text-ink-3">Body fat (measured)</dt>
                <dd className="font-mono text-[17px] font-semibold tabular-nums text-ink">
                  {detail.bodyFatPercent !== null ? `${detail.bodyFatPercent}%` : "—"}
                </dd>
              </div>
            </dl>

            {detail.photos.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {detail.photos
                  .filter((photo) => photo.url)
                  .map((photo, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => photo.url && setLightboxUrl(photo.url)}
                      aria-label={`View the ${photo.angle} photo full size`}
                      className="relative h-40 w-32 shrink-0 overflow-hidden rounded-control border border-line bg-elevated cursor-pointer"
                    >
                      <Image src={photo.url as string} alt="" fill unoptimized sizes="128px" referrerPolicy="no-referrer" onError={() => void handlePhotoError()} className="object-cover" />
                    </button>
                  ))}
              </div>
            )}

            {detail.measurements && (
              <section aria-label="Measurements">
                <h3 className="mb-1.5 text-[13px] font-medium text-ink-2">Measurements</h3>
                <dl className="divide-y divide-line overflow-hidden rounded-control border border-line bg-surface text-sm">
                  {MEASUREMENT_KEYS.map((key) => {
                    const value = detail.measurements?.[key];
                    if (value == null) return null;
                    return (
                      <div key={key} className="flex items-center justify-between px-3 py-2">
                        <dt className="text-ink-3">{MEASUREMENT_LABELS[key]}</dt>
                        <dd className="font-mono tabular-nums text-ink">
                          {displayLength(value, lengthUnit)} {lengthUnit}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              </section>
            )}

            {detail.notes && <p className="rounded-control border border-line bg-surface px-3 py-2.5 text-sm leading-5 text-ink-2">{detail.notes}</p>}

            {detail.aiAnalysis && (
              <section aria-label="AI estimate" className="rounded-control border border-dashed border-line-strong px-3 py-2.5">
                <AnalysisView analysis={detail.aiAnalysis} />
              </section>
            )}
          </div>
        )}
      </Sheet>

      <ConfirmDialog
        isOpen={Boolean(confirmDelete)}
        onCancel={() => !isDeleting && setConfirmDelete(null)}
        onConfirm={deleteWithPhotos}
        title="Delete this check-in?"
        message={
          confirmDelete
            ? `The check-in from ${formatDateString(confirmDelete.dateString, { month: "short", day: "numeric", year: "numeric" })} and its photo will be deleted permanently. This cannot be undone.`
            : ""
        }
        confirmLabel="Delete permanently"
        destructive
        isWorking={isDeleting}
        error={deleteError}
      />

      <Sheet isOpen={Boolean(lightboxUrl)} onClose={() => setLightboxUrl(null)} title="Progress photo" size="lg">
        {lightboxUrl && (
          <div className="relative h-[70vh] w-full overflow-hidden rounded-control bg-canvas">
            <Image src={lightboxUrl} alt="Progress photo, full size" fill unoptimized referrerPolicy="no-referrer" className="object-contain" />
          </div>
        )}
      </Sheet>
    </div>
  );
}

export default BodyCompClient;
