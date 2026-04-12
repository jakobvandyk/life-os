"use client";

interface SparklineProps {
  data: (number | null)[];
  width?: number;
  height?: number;
  color?: string;
  fillOpacity?: number;
}

export default function Sparkline({
  data,
  width = 120,
  height = 32,
  color = "var(--color-desert-accent)",
  fillOpacity = 0.15,
}: SparklineProps) {
  // Filter to only valid points with their indices
  const points = data
    .map((v, i) => (v != null ? { i, v } : null))
    .filter((p): p is { i: number; v: number } => p !== null);

  if (points.length < 2) {
    return (
      <svg width={width} height={height} className="shrink-0">
        <line
          x1={0}
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke="var(--color-desert-border)"
          strokeWidth={1}
          strokeDasharray="3 3"
        />
      </svg>
    );
  }

  const values = points.map((p) => p.v);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const pad = 2;
  const plotH = height - pad * 2;
  const plotW = width - pad * 2;

  const coords = points.map((p) => ({
    x: pad + (p.i / (data.length - 1)) * plotW,
    y: pad + plotH - ((p.v - min) / range) * plotH,
  }));

  const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x},${c.y}`).join(" ");
  const fillPath = `${linePath} L${coords[coords.length - 1].x},${height} L${coords[0].x},${height} Z`;

  // Last point for the dot
  const last = coords[coords.length - 1];

  return (
    <svg width={width} height={height} className="shrink-0">
      <path d={fillPath} fill={color} opacity={fillOpacity} />
      <path d={linePath} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last.x} cy={last.y} r={2} fill={color} />
    </svg>
  );
}
