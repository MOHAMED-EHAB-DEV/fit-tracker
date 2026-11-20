export default function RootLoading() {
  return (
    <div role="status" aria-label="Loading" className="flex min-h-dvh items-center justify-center bg-app">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-zinc-700 border-t-emerald-500 motion-reduce:animate-none" />
    </div>
  );
}
