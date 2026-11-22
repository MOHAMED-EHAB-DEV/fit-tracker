import React from "react";
import { ChartLine, Download, Dumbbell, KeyRound, Lock, MessageSquare, Signal, CalendarDays, Utensils } from "lucide-react";
import {
  BodyVignette,
  CoachVignette,
  EatVignette,
  PlanVignette,
  TrainVignette,
} from "@/components/marketing/Vignettes";

/** Copy for the landing page. Facts only: no invented numbers, ratings or quotes. */

export const PRICE_LINE =
  "Free to use. AI features run on a shared, limited quota; add your own Gemini key in Settings to lift the limit.";

export const GYM_FLOOR_FACTS = [
  {
    title: "One-tap repeated sets",
    body: "Every open set prefills last session's weight and reps, so logging a repeated set takes one tap.",
  },
  {
    title: "Rest timer in the thumb zone",
    body: "The rest timer and the next-set button sit at the bottom edge for one-handed use between sets.",
  },
  {
    title: "Keeps logging offline",
    body: "Workouts save on the device when the gym has no signal and sync once your connection returns.",
  },
] as const;

export interface FeatureRow {
  id: string;
  kicker: string;
  icon: React.ReactNode;
  title: string;
  body: string;
  points: readonly string[];
  preview: React.ReactNode;
}

const ICON = "h-[15px] w-[15px]";

export const FEATURES: readonly FeatureRow[] = [
  {
    id: "train",
    kicker: "Train",
    icon: <Dumbbell className={ICON} strokeWidth={1.75} />,
    title: "Routines, a weekly plan and your complete workout history.",
    body: "Build routines, assign them across a seven-day week, and see personal records as you log each session.",
    points: ["Prefilled set rows and automatic PR detection", "Full workout history and per-exercise records"],
    preview: <TrainVignette />,
  },
  {
    id: "eat",
    kicker: "Eat",
    icon: <Utensils className={ICON} strokeWidth={1.75} />,
    title: "See calories left, and check meal-photo estimates before saving.",
    body: "Track meals and macros against your target, or scan a photo of your plate and review the AI estimate before it is saved.",
    points: ["Remaining calories, protein, carbs and fat", "Photo scans shown as an editable suggestion"],
    preview: <EatVignette />,
  },
  {
    id: "plan",
    kicker: "Plan",
    icon: <CalendarDays className={ICON} strokeWidth={1.75} />,
    title: "A day planner with repeating events, and daily habits.",
    body: "Keep scheduled sessions, repeating reminders and daily habit checklists next to your training.",
    points: ["Repeating schedule events with reminders", "Daily habits with seven-day completion strips"],
    preview: <PlanVignette />,
  },
  {
    id: "body",
    kicker: "Body",
    icon: <ChartLine className={ICON} strokeWidth={1.75} />,
    title: "Weight check-ins, measurements and private photos.",
    body: "Log your weight in seconds, or record a full check-in with body fat, measurements and private progress photos.",
    points: ["Daily weigh-ins with a 7-day average line", "Body fat, measurements and private photos"],
    preview: <BodyVignette />,
  },
  {
    id: "coach",
    kicker: "Coach",
    icon: <MessageSquare className={ICON} strokeWidth={1.75} />,
    title: "An AI coach that proposes changes and waits for your approval.",
    body: "Open Coach from any screen to review your logs or adjust targets. Proposed changes appear as suggestions, and nothing is saved until you accept.",
    points: ["Accept or Dismiss on every proposal", "Works with your own Gemini key if you prefer"],
    preview: <CoachVignette />,
  },
];

export const TRUST_POINTS = [
  {
    icon: <Signal className={ICON} strokeWidth={1.75} />,
    title: "Offline logging",
    body: "Log workouts without a signal; changes sync when you are back online.",
  },
  {
    icon: <Download className={ICON} strokeWidth={1.75} />,
    title: "Full data export",
    body: "Export your workouts, meals, habits and body check-ins whenever you want.",
  },
  {
    icon: <Lock className={ICON} strokeWidth={1.75} />,
    title: "Private progress photos",
    body: "Check-in photos stay private to your account and are never shared publicly.",
  },
  {
    icon: <KeyRound className={ICON} strokeWidth={1.75} />,
    title: "Bring your own AI key",
    body: "Add your own Gemini key in Settings for meal scans, Coach and the day planner.",
  },
] as const;

export const FAQ = [
  {
    question: "Is FitTracker free?",
    answer:
      "Yes, FitTracker is free to use. AI features (meal-photo scans, Coach, the AI day plan and body-fat estimates) run on a shared, limited quota. Add your own Gemini key in Settings to lift the limit.",
  },
  {
    question: "Does FitTracker keep working when the gym has no signal?",
    answer: "Yes. A workout in progress keeps logging offline and syncs once your connection returns.",
  },
  {
    question: "What does the Android app add to the web app?",
    answer:
      "The web app can be installed on your phone as an app (PWA). The Android app adds a step counter, home-screen widgets and planner reminders.",
  },
  {
    question: "Can the AI change my meals or routines on its own?",
    answer:
      "No. Meal-photo scans and Coach proposals always appear as suggestions; nothing is saved until you choose Accept.",
  },
  {
    question: "Can I export my data?",
    answer: "Yes. You can export all of your data from Settings at any time, and your progress photos stay private.",
  },
] as const;
