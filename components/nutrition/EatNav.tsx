import React from "react";
import { SegmentedNav } from "@/components/ui/SegmentedControl";

/** Eat's two views: Day | Week (separate pages). */
export function EatNav({ current }: { current: "day" | "week" }) {
  return (
    <SegmentedNav
      label="Eat views"
      className="w-full md:max-w-[300px]"
      items={[
        { href: "/nutrition", label: "Day", active: current === "day" },
        { href: "/nutrition/week", label: "Week", active: current === "week" },
      ]}
    />
  );
}

export default EatNav;
