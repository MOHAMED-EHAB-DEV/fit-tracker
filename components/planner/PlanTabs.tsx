import React from "react";
import { SegmentedNav } from "@/components/ui/SegmentedControl";

/** Plan = Schedule | Habits: two pages, one tab (the Plan tab stays current on both). */
export function PlanTabs({ active, className }: { active: "schedule" | "habits"; className?: string }) {
  return (
    <SegmentedNav
      label="Plan sections"
      className={className}
      items={[
        { href: "/planner", label: "Schedule", active: active === "schedule" },
        { href: "/habits", label: "Habits", active: active === "habits" },
      ]}
    />
  );
}

export default PlanTabs;
