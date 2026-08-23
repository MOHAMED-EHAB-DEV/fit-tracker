export default function fitImageLoader({
  src,
  width,
  quality,
}: {
  src: string;
  width: number;
  quality?: number;
}) {
  if (!src) return "";
  if (
    src.startsWith("/fit-tracker/images/") ||
    src.startsWith("data:") ||
    src.startsWith("blob:")
  ) {
    return src;
  }
  const encoded = encodeURIComponent(src);
  return `/fit-tracker/images/${encoded}?w=${width}&q=${quality ?? 80}`;
}

