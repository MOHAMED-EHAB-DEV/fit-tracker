export default function RootLoading() {
  return (
    <div role="status" aria-label="Loading" className="flex min-h-dvh items-center justify-center bg-canvas">
      <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-line border-t-ink motion-reduce:animate-none" />
    </div>
  );
}
