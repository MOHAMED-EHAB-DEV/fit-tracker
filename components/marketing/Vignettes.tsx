import React from "react";
import { Bell, Check, ChevronRight, Play, Sparkles, Trophy } from "lucide-react";
import { ProgressTrack } from "@/components/ui/ProgressTrack";
import { buttonClasses } from "@/components/ui/button-styles";
import { DEMO_USER_COLOURS as USER_COLOURS } from "@/lib/marketing/demo";
import { cn } from "@/lib/utils";

/*
 * Static previews of real FitTracker screens for the landing page, drawn with
 * the app's own tokens and primitives (no screenshots). Each one is a single
 * image to assistive technology (role="img" + a description).
 */

function Frame({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div role="img" aria-label={label} className={cn("relative overflow-hidden rounded-card border border-line bg-surface", className)}>
      {children}
    </div>
  );
}

function Mono({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("font-mono tabular-nums", className)}>{children}</span>;
}

function TopBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-11 items-center justify-between border-b border-line px-3.5 text-[13px] font-semibold">
      {children}
    </div>
  );
}

function Muted({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("text-xs font-normal text-ink-3", className)}>{children}</span>;
}

/** A static look-alike of a button (previews are not interactive). */
function FakeButton({
  variant = "primary",
  className,
  children,
}: {
  variant?: "primary" | "secondary";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span aria-hidden="true" className={buttonClasses({ variant, size: "sm", className: cn("pointer-events-none", className) })}>
      {children}
    </span>
  );
}

function TickBox({ done }: { done?: boolean }) {
  return (
    <span
      className={cn(
        "grid h-[26px] w-[26px] shrink-0 place-items-center rounded-chip border-[1.5px]",
        done ? "border-ink bg-ink text-ink-inverse" : "border-line-strong"
      )}
    >
      {done && <Check className="h-4 w-4" strokeWidth={2.25} />}
    </span>
  );
}

function ColourBar({ colour, className }: { colour: string; className?: string }) {
  return <span className={cn("h-7 w-[3px] shrink-0 rounded-full", className)} style={{ backgroundColor: colour }} />;
}

const WEEK = [
  { day: "M", state: "done" },
  { day: "T", state: "done" },
  { day: "W", state: "" },
  { day: "T", state: "done" },
  { day: "F", state: "" },
  { day: "S", state: "today" },
  { day: "S", state: "" },
] as const;

/** Today: workout hero and the fuel ledger. */
export function TodayVignette() {
  return (
    <Frame label="Preview of the Today screen: the planned workout Upper body A with a Start workout button, 750 kcal left of 2,400, protein 142 of 180 g, steps and water.">
      <TopBar>
        <span>Sat, Nov 21</span>
        <Muted>Today</Muted>
      </TopBar>
      <div className="flex flex-col gap-3 p-3.5">
        <div className="rounded-card border border-line bg-canvas p-3.5">
          <div className="mb-3 grid grid-cols-7 gap-1.5 border-b border-line pb-3">
            {WEEK.map((cell, index) => (
              <div
                key={index}
                className={cn(
                  "flex flex-col items-center gap-[5px] text-xs",
                  cell.state === "today" ? "font-semibold text-ink" : "text-ink-3"
                )}
              >
                <span>{cell.day}</span>
                <span
                  className={cn(
                    "h-1 w-[18px] rounded-[2px]",
                    cell.state === "done" ? "bg-ink" : cell.state === "today" ? "bg-accent" : "bg-elevated"
                  )}
                />
              </div>
            ))}
          </div>
          <div className="mb-0.5 flex items-baseline justify-between">
            <span className="text-base font-semibold">Upper body A</span>
            <Muted>Scheduled</Muted>
          </div>
          <p className="mb-3 text-xs text-ink-3">6 exercises · 18 sets</p>
          <FakeButton className="min-h-[42px] w-full rounded-control text-sm">
            <Play className="h-[15px] w-[15px]" strokeWidth={1.75} />
            Start workout
          </FakeButton>
        </div>

        <div className="overflow-hidden rounded-card border border-line bg-canvas">
          <div className="p-3.5">
            <div className="mb-2 flex items-baseline justify-between">
              <div>
                <Mono className="text-[28px] leading-none font-medium tracking-[-0.03em]">750</Mono>
                <span className="ms-1 text-sm text-ink-2">kcal left</span>
              </div>
              <Muted className="font-mono">1,650 of 2,400</Muted>
            </div>
            <ProgressTrack value={1650} max={2400} />
          </div>
          <div className="grid grid-cols-[1.25fr_1fr_1fr] border-t border-line">
            <div className="flex flex-col gap-1 px-3 py-2.5">
              <span className="text-xs text-ink-3">Protein</span>
              <Mono className="text-sm font-medium whitespace-nowrap">
                142<span className="text-xs font-normal text-ink-3"> / 180 g</span>
              </Mono>
              <ProgressTrack value={142} max={180} size="sm" />
            </div>
            <div className="flex flex-col gap-1 border-s border-line px-3 py-2.5">
              <span className="text-xs text-ink-3">Carbs</span>
              <Mono className="text-sm font-medium">
                158<span className="text-xs font-normal text-ink-3"> g</span>
              </Mono>
            </div>
            <div className="flex flex-col gap-1 border-s border-line px-3 py-2.5">
              <span className="text-xs text-ink-3">Fat</span>
              <Mono className="text-sm font-medium">
                49<span className="text-xs font-normal text-ink-3"> g</span>
              </Mono>
            </div>
          </div>
          <div className="grid grid-cols-[0.84fr_1.16fr] border-t border-line">
            <div className="flex flex-col gap-1 px-3 py-2.5">
              <span className="text-xs text-ink-3">Steps</span>
              <Mono className="text-sm font-medium whitespace-nowrap">
                6,420<span className="text-xs font-normal text-ink-3"> / 10k</span>
              </Mono>
              <ProgressTrack value={6420} max={10000} size="sm" />
            </div>
            <div className="flex items-center justify-between gap-2 border-s border-line px-3 py-2.5">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-xs text-ink-3">Water</span>
                <Mono className="text-sm font-medium whitespace-nowrap">
                  1.5<span className="text-xs font-normal text-ink-3"> / 2.5 L</span>
                </Mono>
                <ProgressTrack value={1.5} max={2.5} size="sm" />
              </div>
              <span className="inline-flex h-9 shrink-0 items-center rounded-chip border border-line-strong bg-elevated px-2 font-mono text-xs font-medium whitespace-nowrap">
                +250 ml
              </span>
            </div>
          </div>
        </div>
      </div>
    </Frame>
  );
}

const SET_GRID = "grid grid-cols-[32px_54px_minmax(0,1fr)_minmax(0,0.9fr)_44px] items-center gap-1.5 px-2.5";

function SetRow({
  badge,
  prev,
  weight,
  reps,
  state,
  pr,
}: {
  badge: string;
  prev: string;
  weight: string;
  reps: string;
  state: "done" | "active";
  pr?: boolean;
}) {
  const active = state === "active";
  return (
    <div
      className={cn(
        SET_GRID,
        "min-h-[46px] border-b border-line py-1",
        active ? "bg-surface shadow-[inset_3px_0_0_var(--accent)]" : "bg-canvas"
      )}
    >
      <span
        className={cn(
          "grid h-8 w-8 place-items-center rounded-chip border text-xs font-semibold",
          active ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface text-ink-2"
        )}
      >
        <Mono>{badge}</Mono>
      </span>
      <Mono className="text-center text-xs text-ink-3">{prev}</Mono>
      {[weight, reps].map((value, index) => (
        <span
          key={index}
          className={cn(
            "flex h-9 items-center justify-center rounded-chip border font-mono text-sm font-medium",
            active ? "border-line-strong bg-elevated text-ink-3" : "border-transparent text-ink-2"
          )}
        >
          {value}
        </span>
      ))}
      <span
        className={cn(
          "grid h-9 w-11 place-items-center rounded-chip border",
          active ? "border-ink bg-ink text-ink-inverse" : "border-line bg-elevated text-ink"
        )}
      >
        <Check className="h-[15px] w-[15px]" strokeWidth={2} />
      </span>
      {pr && (
        <span className="col-[2/5] flex items-center gap-1 text-xs font-semibold text-warn">
          <Trophy className="h-3 w-3" strokeWidth={2} />
          New PR
        </span>
      )}
    </div>
  );
}

/** The live workout: the set ledger under a glass dock with the rest timer. */
export function SessionVignette() {
  return (
    <Frame label="Preview of a live workout: barbell bench press with three logged sets and a new PR, the active set 3 at 80 kg by 8, a rest timer at 1:18 and a Log set button.">
      <TopBar>
        <span>Upper body A</span>
        <span className="flex items-center gap-2.5">
          <Muted className="font-mono">24:10</Muted>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-ok">
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            Saved
          </span>
        </span>
      </TopBar>
      <div className="relative h-[3px] border-b border-line bg-elevated">
        <div className="h-full bg-ink" style={{ width: "27.8%" }} />
        <div className="absolute inset-0 grid grid-cols-6">
          {Array.from({ length: 6 }, (_, index) => (
            <span key={index} className="border-e-[1.5px] border-canvas last:border-e-0" />
          ))}
        </div>
      </div>
      <div className="relative pb-[108px]">
        <div className="flex items-start justify-between gap-2 px-3 pt-3 pb-2.5">
          <div>
            <p className="text-base font-semibold tracking-[-0.015em]">Barbell bench press</p>
            <p className="text-xs text-ink-3">
              Last time · <Mono>80×8, 80×8, 80×7</Mono>
            </p>
          </div>
          <span className="inline-flex h-[26px] items-center rounded-chip border border-line bg-canvas px-2 font-mono text-xs text-ink-2">
            2:00
          </span>
        </div>
        <div className={cn(SET_GRID, "h-[26px] border-y border-line bg-recessed text-xs font-medium text-ink-3")}>
          <span className="text-center">Set</span>
          <span className="text-center">Prev</span>
          <span className="text-center">kg</span>
          <span className="text-center">Reps</span>
          <span className="text-center">Done</span>
        </div>
        <SetRow badge="W" prev="60×10" weight="60" reps="10" state="done" />
        <SetRow badge="1" prev="80×8" weight="80" reps="8" state="done" />
        <SetRow badge="2" prev="80×8" weight="82.5" reps="8" state="done" pr />
        <SetRow badge="3" prev="80×7" weight="80" reps="8" state="active" />
        {[
          ["Incline dumbbell press", "30 kg × 10"],
          ["Weighted pull-up", "+10 kg × 8"],
        ].map(([name, last]) => (
          <div key={name} className="flex items-center justify-between border-b border-line p-3">
            <div>
              <p className="text-sm font-semibold">{name}</p>
              <p className="mt-0.5 text-xs text-ink-3">
                <Mono>0 / 3</Mono> sets · Last <Mono>{last}</Mono>
              </p>
            </div>
            <ChevronRight className="h-[15px] w-[15px] text-ink-3" />
          </div>
        ))}

        <div className="glass-chrome absolute inset-x-0 bottom-0 z-[1]">
          <div className="glass-live border-b border-(--glass-border) px-3 py-2">
            <ProgressTrack value={65} max={100} size="sm" tone="accent" />
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="h-[7px] w-[7px] rounded-full bg-accent animate-live" />
                <Muted>Rest</Muted>
                <Mono className="text-[19px] font-semibold tracking-[-0.02em] text-accent">01:18</Mono>
              </div>
              <div className="flex gap-[5px]">
                {["-15s", "+15s"].map((label) => (
                  <span
                    key={label}
                    className="inline-flex h-7 items-center rounded-chip border border-line bg-elevated px-2 font-mono text-xs font-medium"
                  >
                    {label}
                  </span>
                ))}
                <span className="inline-flex h-7 items-center rounded-chip border border-line bg-elevated px-2 text-xs font-medium text-ink-2">
                  Skip
                </span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-[auto_1fr] gap-2 px-3 pt-2 pb-2.5">
            <FakeButton variant="secondary" className="min-h-[38px] text-ink-2">
              Finish
            </FakeButton>
            <FakeButton className="min-h-[38px] w-full">
              Log set <Mono>3 · 80 kg × 8</Mono>
            </FakeButton>
          </div>
        </div>
      </div>
    </Frame>
  );
}

const PLAN_WEEK = [
  { day: "M", tag: "U-A" },
  { day: "T", tag: "L-A" },
  { day: "W", tag: "Rest", rest: true },
  { day: "T", tag: "U-B" },
  { day: "F", tag: "Rest", rest: true },
  { day: "S", tag: "U-A", today: true },
  { day: "S", tag: "+", open: true },
];

/** Train: the week plan strip and routines. */
export function TrainVignette() {
  return (
    <Frame label="Preview of Train: a seven-day plan with routines assigned to days and a list of routines with Start buttons.">
      <div className="flex flex-col gap-3 p-3.5">
        <div>
          <div className="mb-2 flex justify-between text-xs text-ink-3">
            <span className="font-semibold text-ink-2">Week plan</span>
            <span>Tap day to assign</span>
          </div>
          <div className="grid grid-cols-7 gap-[5px]">
            {PLAN_WEEK.map((cell, index) => (
              <div
                key={index}
                className={cn(
                  "flex flex-col items-center gap-[3px] rounded-chip border px-0.5 py-[7px] text-xs",
                  cell.today
                    ? "border-accent bg-accent-soft font-semibold text-accent"
                    : cell.open
                      ? "border-dashed border-line-strong bg-transparent text-ink-3"
                      : "border-line bg-elevated"
                )}
              >
                <span className={cell.today || cell.open ? undefined : "text-ink-3"}>{cell.day}</span>
                <span className={cell.rest ? "text-ink-3" : undefined}>{cell.tag}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="divide-y divide-line overflow-hidden rounded-card border border-line bg-canvas">
          {[
            ["Upper body A", "6", "3d"],
            ["Lower body A", "5", "2d"],
          ].map(([name, count, ago]) => (
            <div key={name} className="flex items-center justify-between gap-2.5 px-3 py-[11px]">
              <div>
                <p className="text-sm font-semibold">{name}</p>
                <p className="mt-0.5 text-xs text-ink-3">
                  <Mono>{count}</Mono> exercises · Last <Mono>{ago}</Mono> ago
                </p>
              </div>
              <FakeButton variant="secondary" className="min-h-8">
                Start
              </FakeButton>
            </div>
          ))}
        </div>
      </div>
    </Frame>
  );
}

function SuggestedPreview({ meta, title, detail }: { meta: string; title: string; detail: string }) {
  return (
    <div className="flex flex-col gap-2.5 rounded-card border-[1.5px] border-dashed border-line-strong bg-canvas p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex h-6 items-center gap-1.5 rounded-chip border border-line bg-elevated px-2 text-xs font-medium text-ink-2">
          <Sparkles className="h-3 w-3" strokeWidth={1.75} />
          Suggested
        </span>
        <Muted>{meta}</Muted>
      </div>
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <Mono className="mt-0.5 block text-xs text-ink-3">{detail}</Mono>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <FakeButton className="w-full">Accept</FakeButton>
        <FakeButton variant="secondary" className="w-full">
          Dismiss
        </FakeButton>
      </div>
    </div>
  );
}

/** Eat: a photo scan waiting for review, and a logged meal. */
export function EatVignette() {
  return (
    <Frame label="Preview of Eat: a photo scan suggesting grilled salmon and quinoa at 540 kcal with Accept and Dismiss, and a logged chicken rice bowl.">
      <div className="flex flex-col gap-3 p-3.5">
        <SuggestedPreview
          meta="Photo scan · Review before saving"
          title="Grilled salmon and quinoa"
          detail="540 kcal · 44 g P · 38 g C · 22 g F"
        />
        <div className="rounded-card border border-line bg-canvas">
          <div className="flex items-center justify-between gap-2.5 px-3 py-[11px]">
            <div>
              <p className="text-sm font-semibold">Chicken rice bowl</p>
              <Mono className="mt-0.5 block text-xs text-ink-3">13:15 · 54 g P</Mono>
            </div>
            <Mono className="text-sm font-medium">
              680<span className="text-xs font-normal text-ink-3"> kcal</span>
            </Mono>
          </div>
        </div>
      </div>
    </Frame>
  );
}

const DOTS_FULL = [1, 1, 1, 1, 1, 1, 1];
const DOTS_TODAY = [1, 1, 1, 0, 1, 1, 2];

function DayDots({ values }: { values: number[] }) {
  return (
    <div className="mt-[5px] flex gap-1">
      {values.map((value, index) => (
        <span
          key={index}
          className={cn("h-1 w-3 rounded-[2px]", value === 1 ? "bg-ink-2" : value === 2 ? "bg-accent" : "bg-elevated")}
        />
      ))}
    </div>
  );
}

/** Plan: a planner event and two habits. */
export function PlanVignette() {
  return (
    <Frame label="Preview of Plan: a weekly physio reminder at 18:30 and two daily habits with seven-day completion strips.">
      <div className="p-3.5">
        <div className="divide-y divide-line overflow-hidden rounded-card border border-line bg-canvas">
          <div className="flex items-center justify-between gap-2.5 px-3 py-[11px]">
            <div className="flex items-center gap-2.5">
              <ColourBar colour={USER_COLOURS.sky} />
              <div>
                <p className="text-sm font-semibold">Physio shoulder check</p>
                <Mono className="mt-0.5 block text-xs text-ink-3">18:30 · Weekly reminder</Mono>
              </div>
            </div>
            <Bell className="h-[15px] w-[15px] text-ink-3" strokeWidth={1.75} />
          </div>
          <div className="flex items-center justify-between gap-2.5 px-3 py-[11px]">
            <div className="flex items-center gap-2.5">
              <ColourBar colour={USER_COLOURS.teal} />
              <div>
                <p className="text-sm font-semibold">Creatine 5 g</p>
                <DayDots values={DOTS_FULL} />
              </div>
            </div>
            <TickBox done />
          </div>
          <div className="flex items-center justify-between gap-2.5 px-3 py-[11px]">
            <div className="flex items-center gap-2.5">
              <ColourBar colour={USER_COLOURS.violet} />
              <div>
                <p className="text-sm font-semibold">Evening walk · 20 min</p>
                <DayDots values={DOTS_TODAY} />
              </div>
            </div>
            <TickBox />
          </div>
        </div>
      </div>
    </Frame>
  );
}

/** Body: the weight trend with daily points and a 7-day average. */
export function BodyVignette() {
  const dots: Array<[number, number]> = [
    [40, 48],
    [78, 42],
    [116, 58],
    [154, 54],
    [192, 68],
    [230, 64],
    [268, 76],
  ];
  return (
    <Frame label="Preview of Body: latest weight 78.4 kg, down 0.6 kg over 30 days, with a trend chart of daily weigh-ins and a 7-day average line.">
      <div className="p-3.5">
        <div className="rounded-card border border-line bg-canvas p-3.5">
          <div className="mb-2.5 flex items-baseline justify-between">
            <div>
              <Mono className="text-[28px] leading-none font-medium tracking-[-0.03em]">78.4</Mono>
              <span className="ms-1 text-sm text-ink-2">kg</span>
            </div>
            <Mono className="text-xs font-medium text-ok">-0.6 kg</Mono>
          </div>
          <svg className="block h-auto w-full" viewBox="0 0 328 118" aria-hidden="true">
            <line x1="28" y1="14" x2="322" y2="14" stroke="var(--line)" strokeWidth="1" strokeDasharray="2 3" />
            <line x1="28" y1="54" x2="322" y2="54" stroke="var(--line)" strokeWidth="1" strokeDasharray="2 3" />
            <line x1="28" y1="94" x2="322" y2="94" stroke="var(--line)" strokeWidth="1" />
            {[
              [18, "80"],
              [58, "79"],
              [98, "78"],
            ].map(([y, label]) => (
              <text key={label} x="22" y={y} textAnchor="end" fill="var(--ink-3)" fontSize="11" fontFamily="var(--font-mono)">
                {label}
              </text>
            ))}
            {dots.map(([cx, cy]) => (
              <circle key={cx} cx={cx} cy={cy} r="2.6" fill="var(--ink-2)" />
            ))}
            <path
              d="M 40 48 C 90 50, 140 56, 192 64 C 242 70, 282 75, 314 78"
              fill="none"
              stroke="var(--accent)"
              strokeWidth="2.25"
              strokeLinecap="round"
            />
            <circle cx="314" cy="78" r="4" fill="var(--accent)" stroke="var(--canvas)" strokeWidth="2" />
            <text x="34" y="113" fill="var(--ink-3)" fontSize="11" fontFamily="var(--font-mono)">
              Oct 23
            </text>
            <text x="322" y="113" textAnchor="end" fill="var(--ink-3)" fontSize="11" fontFamily="var(--font-mono)">
              Nov 21
            </text>
          </svg>
        </div>
      </div>
    </Frame>
  );
}

/** Coach: a question, the answer, and a proposal waiting for approval. */
export function CoachVignette() {
  return (
    <Frame label="Preview of Coach: a question about raising a bench press target, the answer, and a suggested routine update with Accept and Dismiss.">
      <div className="flex flex-col gap-3 p-3.5">
        <p className="max-w-[85%] self-end rounded-control bg-elevated px-3 py-2.5 text-[13px] leading-[1.45]">
          Should I raise my bench press target for Upper body A?
        </p>
        <p className="rounded-control border border-line bg-canvas px-3 py-2.5 text-[13px] leading-[1.45] text-ink-2">
          You completed 82.5 kg for 8 reps on your latest session. You can update the routine target below.
        </p>
        <SuggestedPreview meta="Routine update" title="Barbell bench press" detail="80 kg → 82.5 kg · 3 × 8" />
      </div>
    </Frame>
  );
}

/** Android widgets: steps, a planner reminder and the calories widget. */
export function WidgetsVignette() {
  return (
    <div role="img" aria-label="Previews of the Android widgets: step counter, planner reminder and calories left." className="grid grid-cols-2 gap-3">
      <div className="flex flex-col gap-2 rounded-card border border-line bg-surface p-3.5">
        <span className="text-xs text-ink-3">Step counter</span>
        <Mono className="text-xl font-medium">
          6,420<span className="text-xs font-normal text-ink-3"> / 10k</span>
        </Mono>
        <ProgressTrack value={6420} max={10000} size="sm" />
      </div>
      <div className="flex flex-col gap-2 rounded-card border border-line bg-surface p-3.5">
        <span className="flex items-center justify-between text-xs text-ink-3">
          Planner reminder
          <Bell className="h-[13px] w-[13px] text-accent" strokeWidth={1.75} />
        </span>
        <p className="text-sm font-semibold">Upper body A</p>
        <Mono className="text-xs text-ink-3">17:30 · Scheduled</Mono>
      </div>
      <div className="col-span-2 flex flex-col gap-2 rounded-card border border-line bg-surface p-3.5">
        <div className="flex items-baseline justify-between gap-2">
          <div>
            <span className="mb-0.5 block text-xs text-ink-3">Home-screen widget</span>
            <Mono className="text-xl font-medium">750</Mono> <Muted>kcal left</Muted>
          </div>
          <Muted className="font-mono">142 g P · 1.5 L water</Muted>
        </div>
        <ProgressTrack value={1650} max={2400} size="sm" tone="accent" />
      </div>
    </div>
  );
}
