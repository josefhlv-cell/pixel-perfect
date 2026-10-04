/** Tiny SVG sparkline for listing price history. */
export function PriceSparkline({
  points,
  width = 80,
  height = 24,
}: {
  points: { price: number | null }[];
  width?: number;
  height?: number;
}) {
  const vals = points.map((p) => p.price).filter((p): p is number => p != null && Number.isFinite(p));
  if (vals.length < 2) return null;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const coords = vals.map((v, i) => {
    const x = (i / (vals.length - 1)) * width;
    const y = height - ((v - min) / span) * (height - 2) - 1;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const down = vals[vals.length - 1]! < vals[0]!;
  const stroke = down ? "var(--positive, #22c55e)" : "var(--muted-foreground, #888)";
  return (
    <svg width={width} height={height} className="inline-block" aria-hidden>
      <polyline fill="none" stroke={stroke} strokeWidth="1.5" points={coords.join(" ")} />
    </svg>
  );
}
