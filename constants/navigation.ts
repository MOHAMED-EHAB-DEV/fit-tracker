import {
  LayoutDashboard,
  Dumbbell,
  UtensilsCrossed,
  Scale,
  Sparkles,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  mobileLabel?: string;
}

export const MAIN_NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard, mobileLabel: "Home" },
  { label: "Workouts", href: "/workouts", icon: Dumbbell, mobileLabel: "Workout" },
  { label: "Nutrition", href: "/nutrition", icon: UtensilsCrossed, mobileLabel: "Nutrition" },
  { label: "Body Comp", href: "/body-comp", icon: Scale, mobileLabel: "Body" },
  { label: "AI Coach", href: "/coach", icon: Sparkles, mobileLabel: "Coach" },
  { label: "Settings", href: "/settings", icon: Settings },
];

export const MOBILE_NAV_ITEMS: NavItem[] = MAIN_NAV_ITEMS.filter((i) => i.mobileLabel).map((i) => ({
  ...i,
  label: i.mobileLabel || i.label,
}));

export const ADMIN_NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  { label: "Users", href: "/admin/users", icon: Users },
  { label: "Exercises", href: "/admin/exercises", icon: Dumbbell },
  { label: "Nutrition", href: "/admin/nutrition", icon: UtensilsCrossed },
];
