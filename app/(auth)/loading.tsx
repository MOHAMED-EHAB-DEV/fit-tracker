export default function AuthLoading() {
  return (
    <div role="status" aria-label="Loading" className="w-full max-w-[400px] space-y-4">
      <div className="skeleton mx-auto h-12 w-12 rounded-[12px]" />
      <div className="skeleton mx-auto h-7 w-40" />
      <div className="skeleton h-72 rounded-card" />
    </div>
  );
}
