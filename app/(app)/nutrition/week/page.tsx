import Link from "next/link";
import type { Metadata } from "next";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { requirePageUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongoose";
import DailyLog from "@/lib/db/models/DailyLog";
import { dailyTargets } from "@/lib/fitness/targets";
import { buildEnergySeries } from "@/lib/dashboard/energy";
import {
  addDays,
  formatDateString,
  isValidDateString,
  localDateString,
  normalizeWeekStart,
  resolveTimeZone,
  weekDatesOf,
} from "@/lib/time";
import { EARLIEST_LOG_DATE } from "@/lib/nutrition/meal-time";
import { EatNav } from "@/components/nutrition/EatNav";
import { EnergyBalanceChart } from "@/components/nutrition/EnergyBalanceChart";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Eat this week",
  description: "Your week of eating: daily averages, energy balance and each day at a glance.",
};

interface WeekPageProps {
  searchParams: Promise<{ start?: string | string[] }>;
}

const STEP =
  "grid h-9 w-9 shrink-0 place-items-center rounded-chip text-ink-2 transition-colors hover:bg-elevated hover:text-ink";

function average(values: number[]): number | null {
  return values.length > 0 ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
}

export default async function NutritionWeekPage({ searchParams }: WeekPageProps) {
  const user = await requirePageUser();
  const tz = resolveTimeZone(user.preferences?.timezone);
  const todayStr = localDateString(new Date(), tz);
  const weekStart = normalizeWeekStart(user.preferences?.weekStartDay);
  const currentWeek = weekDatesOf(todayStr, weekStart);

  const { start } = await searchParams;
  const requested = typeof start === "string" && isValidDateString(start) ? start : todayStr;
  const anchor = requested > todayStr ? todayStr : requested < EARLIEST_LOG_DATE ? EARLIEST_LOG_DATE : requested;
  const weekDates = weekDatesOf(anchor, weekStart);
  const isCurrentWeek = weekDates[0] === currentWeek[0];
  const previousStart = addDays(weekDates[0], -7);
  const nextStart = addDays(weekDates[0], 7);

  await getDb();
  const logs = await DailyLog.find({ userId: user._id, dateString: { $in: weekDates } })
    .select("dateString caloriesIn caloriesOut macros steps")
    .lean();

  const targets = dailyTargets(user.fitnessProfile);
  const series = buildEnergySeries({
    weekDates,
    todayDateString: todayStr,
    logs: logs.map((log) => ({
      dateString: log.dateString,
      caloriesIn: log.caloriesIn,
      caloriesOut: log.caloriesOut,
      macros: log.macros,
      steps: log.steps,
    })),
    bmr: targets.bmr,
    tdee: targets.tdee,
    targetCalories: targets.calories || null,
  });

  const logged = series.filter((day) => day.hasFoodData && !day.isFuture);
  const averages = [
    { label: "Calories", value: average(logged.map((day) => day.caloriesIn ?? 0)), unit: "kcal" },
    { label: "Protein", value: average(logged.map((day) => day.protein ?? 0)), unit: "g" },
    { label: "Carbs", value: average(logged.map((day) => day.carbs ?? 0)), unit: "g" },
    { label: "Fat", value: average(logged.map((day) => day.fat ?? 0)), unit: "g" },
  ];
  const range = `${formatDateString(weekDates[0], { month: "short", day: "numeric" })} – ${formatDateString(weekDates[6], {
    month: "short",
    day: "numeric",
  })}`;
  const target = targets.calories || null;

  return (
    <div className="space-y-3">
      <EatNav current="week" />

      <div className="space-y-3 lg:grid lg:grid-cols-2 lg:items-start lg:gap-4 lg:space-y-0">
        <div className="space-y-3">
          <nav aria-label="Choose a week" className="flex h-11 items-center justify-between gap-1 rounded-control border border-line bg-surface px-1">
            {weekDates[0] > EARLIEST_LOG_DATE ? (
              <Link href={`/nutrition/week?start=${previousStart}`} aria-label="Previous week" className={STEP}>
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </Link>
            ) : (
              <span className="h-9 w-9" />
            )}
            <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
              <span className="font-mono tabular-nums">{range}</span>
              {isCurrentWeek && <span className="text-xs font-medium text-accent">This week</span>}
            </p>
            {isCurrentWeek ? (
              <span className="h-9 w-9" />
            ) : (
              <Link
                href={nextStart >= currentWeek[0] ? "/nutrition/week" : `/nutrition/week?start=${nextStart}`}
                aria-label="Next week"
                className={STEP}
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            )}
          </nav>

          <section aria-labelledby="averages-title" className="overflow-hidden rounded-card border border-line bg-surface">
            <div className="flex items-center justify-between gap-3 px-3.5 pt-3">
              <h2 id="averages-title" className="text-[13px] font-semibold text-ink-2">
                Daily average
              </h2>
              <span className="text-xs text-ink-3">
                <span className="font-mono tabular-nums">{logged.length}</span> of 7 days logged
              </span>
            </div>
            <dl className="mt-2.5 grid grid-cols-2 border-t border-line sm:grid-cols-4 [&>div]:border-line max-sm:[&>div:nth-child(2n)]:border-s max-sm:[&>div:nth-child(n+3)]:border-t sm:[&>div+div]:border-s">
              {averages.map((cell) => (
                <div key={cell.label} className="min-w-0 px-3.5 py-2.5">
                  <dt className="truncate text-xs text-ink-3">{cell.label}</dt>
                  <dd className="truncate font-mono text-[15px] font-semibold tabular-nums text-ink">
                    {cell.value === null ? "—" : cell.value.toLocaleString()}
                    {cell.value !== null && <span className="text-xs font-normal text-ink-3"> {cell.unit}</span>}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <EnergyBalanceChart data={series} goal={user.fitnessProfile?.goal ?? null} targetCalories={target} tdee={targets.tdee} />
        </div>

        <section aria-labelledby="days-title" className="space-y-2">
          <h2 id="days-title" className="px-0.5 text-[13px] font-semibold text-ink-2">
            Days
          </h2>
          <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
            {series.map((day) => {
              const over = target !== null && day.caloriesIn !== null && day.caloriesIn > target;
              const content = (
                <>
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-sm font-medium", day.isFuture ? "text-ink-3" : "text-ink")}>
                      {day.fullDateLabel}
                      {day.isToday && <span className="ms-1.5 text-xs font-medium text-accent">Today</span>}
                    </span>
                    <span className="mt-0.5 block font-mono text-xs tabular-nums text-ink-3">
                      {day.isFuture
                        ? "Not yet"
                        : day.hasFoodData
                          ? `P ${day.protein ?? 0} g · C ${day.carbs ?? 0} g · F ${day.fat ?? 0} g`
                          : "Nothing logged"}
                    </span>
                  </span>
                  {!day.isFuture && (
                    <span className={cn("shrink-0 font-mono text-sm tabular-nums", over ? "text-warn" : "text-ink")}>
                      {day.caloriesIn !== null ? day.caloriesIn.toLocaleString() : "—"}
                      <span className="text-xs text-ink-3">
                        {target !== null ? ` / ${target.toLocaleString()}` : ""} kcal
                      </span>
                    </span>
                  )}
                  {!day.isFuture && <ChevronRight className="h-4 w-4 shrink-0 text-ink-3" aria-hidden="true" />}
                </>
              );
              return (
                <li key={day.dateString}>
                  {day.isFuture ? (
                    <div className="flex min-h-14 items-center gap-3 px-3.5 py-2.5">{content}</div>
                  ) : (
                    <Link
                      href={day.isToday ? "/nutrition" : `/nutrition?date=${day.dateString}`}
                      className="flex min-h-14 items-center gap-3 px-3.5 py-2.5 transition-colors hover:bg-elevated/60 active:bg-elevated"
                    >
                      {content}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}
