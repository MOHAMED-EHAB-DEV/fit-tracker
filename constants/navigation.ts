import {
  CalendarDays,
  ChartLine,
  Dumbbell,
  LayoutDashboard,
  LayoutGrid,
  ListChecks,
  MessageSquare,
  Settings,
  ShieldCheck,
  Users,
  Utensils,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Path prefixes that also mark this item as current (Plan covers /planner and /habits). */
  match?: readonly string[];
  /** Shown only inside the Android app. */
  nativeOnly?: boolean;
  /** Shown only to admins. */
  adminOnly?: boolean;
}

/** The signed-in home (Today). `/` is the public landing page. */
export const HOME_PATH = "/dashboard";

const TODAY: NavItem = { label: "Today", href: HOME_PATH, icon: LayoutDashboard };
const TRAIN: NavItem = { label: "Train", href: "/workouts", icon: Dumbbell };
const EAT: NavItem = { label: "Eat", href: "/nutrition", icon: Utensils };
const BODY: NavItem = { label: "Body", href: "/body-comp", icon: ChartLine };

/** Phone tab bar: Today · Train · Eat · Plan · Body. */
export const TAB_ITEMS: readonly NavItem[] = [
  TODAY,
  TRAIN,
  EAT,
  { label: "Plan", href: "/planner", icon: CalendarDays, match: ["/planner", "/habits"] },
  BODY,
];

/** Desktop rail (768px+): the same places, with Planner and Habits apart. */
export const RAIL_ITEMS: readonly NavItem[] = [
  TODAY,
  TRAIN,
  EAT,
  { label: "Planner", href: "/planner", icon: CalendarDays },
  { label: "Habits", href: "/habits", icon: ListChecks },
  BODY,
];

/** Opened from the header on phones and from the rail on desktop. */
export const COACH_ITEM: NavItem = { label: "Coach", href: "/coach", icon: MessageSquare };

/** The Coach link from a screen: it remembers where it was opened (suggestions, Close). */
export function coachHref(pathname: string): string {
  return pathname && pathname !== COACH_ITEM.href && !pathname.startsWith(`${COACH_ITEM.href}/`)
    ? `${COACH_ITEM.href}?from=${encodeURIComponent(pathname)}`
    : COACH_ITEM.href;
}

/** The profile menu (avatar in the header, account button in the rail). Sign out is added by the menu. */
export const PROFILE_MENU_ITEMS: readonly NavItem[] = [
  { label: "Settings", href: "/settings", icon: Settings },
  { label: "Admin", href: "/admin/dashboard", icon: ShieldCheck, adminOnly: true },
  { label: "Widgets", href: "/widgets", icon: LayoutGrid, nativeOnly: true },
];

export const ADMIN_NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  { label: "Users", href: "/admin/users", icon: Users },
  { label: "Exercises", href: "/admin/exercises", icon: Dumbbell },
  { label: "Nutrition", href: "/admin/nutrition", icon: UtensilsCrossed },
];

function isUnder(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** Whether a nav item is the current place. Accepts an item or a bare href. */
export function isNavItemActive(pathname: string, item: NavItem | string): boolean {
  if (typeof item === "string") return isUnder(pathname, item);
  return (item.match ?? [item.href]).some((prefix) => isUnder(pathname, prefix));
}

/** Items the current user may see. */
export function visibleNavItems(
  items: readonly NavItem[],
  { isAdmin, isNative }: { isAdmin: boolean; isNative: boolean }
): NavItem[] {
  return items.filter((item) => (!item.adminOnly || isAdmin) && (!item.nativeOnly || isNative));
}

/** Focus mode (the live workout, the Coach chat): no tab bar, no page header, a narrow column. */
export function isFocusModePath(pathname: string): boolean {
  return pathname.startsWith("/workouts/session/") || pathname === "/coach" || pathname.startsWith("/coach/");
}

/** Screens with their own top bar (an editor, the full-height Coach chat): no shared page header. */
export function hasOwnHeader(pathname: string): boolean {
  return isUnder(pathname, "/coach") || pathname.startsWith("/workouts/routines/");
}

const PAGE_TITLES: ReadonlyArray<[prefix: string, title: string]> = [
  ["/workouts", "Train"],
  ["/nutrition", "Eat"],
  ["/planner", "Plan"],
  ["/habits", "Plan"],
  ["/body-comp", "Body"],
  ["/coach", "Coach"],
  ["/settings", "Settings"],
  ["/widgets", "Widgets"],
  ["/ui-kit", "UI kit"],
];

/**
 * The page header title: the tab label (Today shows the date instead, which
 * the header computes in the user's time zone). Null when unknown.
 */
export function pageTitleFor(pathname: string): string | null {
  return PAGE_TITLES.find(([prefix]) => isUnder(pathname, prefix))?.[1] ?? null;
}
