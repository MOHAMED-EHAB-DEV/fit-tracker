export default function NutritionLoading() {
  return (
    <div role="status" aria-label="Loading nutrition" className="space-y-6 animate-pulse">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-8 w-40 bg-zinc-800 rounded-xl" />
          <div className="h-4 w-56 bg-zinc-800/70 rounded-lg" />
        </div>
        <div className="flex gap-2">
          <div className="h-11 w-32 bg-zinc-800/80 rounded-xl" />
          <div className="h-11 w-44 bg-zinc-800 rounded-xl" />
        </div>
      </div>
      <div className="h-20 rounded-2xl bg-zinc-900/70 border border-zinc-800/60" />
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className={`h-32 rounded-2xl bg-zinc-900/70 border border-zinc-800/60 ${index === 0 ? "col-span-2 lg:col-span-1" : ""}`} />
        ))}
      </div>
      <div className="h-64 rounded-[28px] bg-zinc-900/70 border border-zinc-800/60" />
    </div>
  );
}
