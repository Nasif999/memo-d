import { cn } from "@/lib/utils";

// A circular image, or a fallback letter/short-code when there's no image.
// Never interactive itself — callers wrap only the adjacent name in a link.
export function Avatar({
  src,
  fallback,
  size = 32,
  className,
}: {
  src?: string | null;
  fallback: string;
  size?: number;
  className?: string;
}) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={src}
        alt=""
        className={cn("shrink-0 rounded-full object-cover", className)}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full border border-border bg-muted font-semibold text-muted-foreground",
        className
      )}
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.4) }}
    >
      {fallback}
    </div>
  );
}
