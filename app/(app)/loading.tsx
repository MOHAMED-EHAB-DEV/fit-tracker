import { ScreenSkeleton } from "@/components/ui/Skeleton";

/** Placeholder while a screen's data loads (the header and tab bar stay in place). */
export default function AppLoading() {
  return <ScreenSkeleton cards={4} />;
}
