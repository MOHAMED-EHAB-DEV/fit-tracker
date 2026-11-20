export default function NutritionAnalyzeLoading() {
  return (
    <div role="status" aria-label="Loading the meal estimator" className="max-w-2xl mx-auto space-y-4 animate-pulse">
      <div className="p-6 rounded-3xl bg-zinc-900/60 border border-zinc-800/60 space-y-5">
        <div className="h-6 w-48 bg-zinc-800 rounded-lg" />
        <div className="h-44 rounded-2xl bg-zinc-800/60" />
        <div className="h-11 rounded-xl bg-zinc-800/70" />
        <div className="h-24 rounded-xl bg-zinc-800/50" />
        <div className="h-12 rounded-xl bg-zinc-800" />
      </div>
    </div>
  );
}
