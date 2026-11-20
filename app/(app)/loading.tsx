/** Placeholder with the shape of the Today screen while its data loads. */
export default function AppLoading() {
  return (
    <div role="status" aria-label="Loading" className="space-y-5 sm:space-y-6">
      <div className="skeleton h-9 w-48" />
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <div className="skeleton h-32 rounded-3xl" />
        <div className="skeleton h-32 rounded-3xl" />
        <div className="skeleton h-32 rounded-3xl" />
        <div className="skeleton h-32 rounded-3xl" />
      </div>
      <div className="skeleton h-44 rounded-3xl" />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <div className="skeleton h-40 rounded-3xl" />
        <div className="skeleton h-40 rounded-3xl" />
      </div>
    </div>
  );
}
