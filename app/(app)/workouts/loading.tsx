export default function TrainLoading() {
  return (
    <div className="mx-auto max-w-2xl space-y-6" aria-busy="true" aria-label="Loading">
      <div className="skeleton h-8 w-32" />
      <div className="skeleton h-40 rounded-3xl" />
      <div className="skeleton h-6 w-40" />
      <div className="skeleton h-32 rounded-3xl" />
      <div className="skeleton h-32 rounded-3xl" />
    </div>
  );
}
