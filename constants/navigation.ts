import {
  Home,
  CheckSquare,
  Dumbbell,
  UtensilsCrossed,
  Scale,
  Sparkles,
  Settings,
  Users,
  CalendarClock,
  LayoutGrid,
  LayoutDashboard,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Shown only inside the Android app. */
  nativeOnly?: boolean;
}

/** The three destinations that live in the phone tab bar. */
export const PRIMARY_NAV_ITEMS: NavItem[] = [
  { label: "Today", href: "/", icon: Home },
  { label: "Train", href: "/workouts", icon: Dumbbell },
  { label: "Eat", href: "/nutrition", icon: UtensilsCrossed },
];

/** Everything else: in the "More" sheet on phones, below the primary items on desktop. */
export const SECONDARY_NAV_ITEMS: NavItem[] = [
  { label: "Planner", href: "/planner", icon: CalendarClock },
  { label: "Habits", href: "/habits", icon: CheckSquare },
  { label: "Body", href: "/body-comp", icon: Scale },
  { label: "Coach", href: "/coach", icon: Sparkles },
  { label: "Widgets", href: "/widgets", icon: LayoutGrid, nativeOnly: true },
  { label: "Settings", href: "/settings", icon: Settings },
];

export const MAIN_NAV_ITEMS: NavItem[] = [...PRIMARY_NAV_ITEMS, ...SECONDARY_NAV_ITEMS];

export const ADMIN_NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  { label: "Users", href: "/admin/users", icon: Users },
  { label: "Exercises", href: "/admin/exercises", icon: Dumbbell },
  { label: "Nutrition", href: "/admin/nutrition", icon: UtensilsCrossed },
];

export function isNavItemActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
