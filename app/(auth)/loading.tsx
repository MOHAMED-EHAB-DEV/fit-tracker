export default function AuthLoading() {
  return (
    <div role="status" aria-label="Loading" className="w-full max-w-md space-y-4">
      <div className="skeleton mx-auto h-14 w-14 rounded-2xl" />
      <div className="skeleton mx-auto h-7 w-40" />
      <div className="skeleton h-72 rounded-3xl" />
    </div>
  );
}
