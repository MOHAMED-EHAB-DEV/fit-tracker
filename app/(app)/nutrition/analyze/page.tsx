import { redirect } from "next/navigation";

interface AnalyzePageProps {
  searchParams: Promise<{ date?: string | string[] }>;
}

/**
 * Old deep link (home-screen shortcuts, bookmarks): scanning a meal now
 * happens in the meal sheet on Eat, opened in Scan mode.
 */
export default async function AnalyzeMealPage({ searchParams }: AnalyzePageProps) {
  const { date } = await searchParams;
  const day = typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) ? `&date=${date}` : "";
  redirect(`/nutrition?add=scan${day}`);
}
