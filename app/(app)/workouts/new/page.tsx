import React from "react";
import { Metadata } from "next";
import { NewWorkoutClient } from "@/components/workout/NewWorkoutClient";

export const metadata: Metadata = {
  title: "Create Workout Sheet — AI Fit Tracker",
  description: "Assign a workout to a day of the week and start tracking your lifts and progression.",
};

export default function NewWorkoutPage() {
  return <NewWorkoutClient />;
}
