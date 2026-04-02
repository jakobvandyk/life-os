"use client";

// 7x7 pixel art icons for the sidebar and page headers.
// Each icon is a flat array of 49 values: 1 = filled, 0 = empty.
// Rendered as an inline SVG grid.

const ICONS: Record<string, number[]> = {
  dashboard: [
    1,1,1,0,1,1,1,
    1,1,1,0,1,1,1,
    1,1,1,0,1,1,1,
    0,0,0,0,0,0,0,
    1,1,1,0,1,1,1,
    1,1,1,0,1,1,1,
    1,1,1,0,1,1,1,
  ],
  tasks: [
    1,1,1,1,1,1,0,
    1,0,0,0,0,1,0,
    1,0,1,0,1,1,0,
    1,0,0,1,0,1,0,
    1,0,0,0,1,1,0,
    1,0,0,0,0,1,0,
    1,1,1,1,1,1,0,
  ],
  habits: [
    0,0,1,1,1,0,0,
    0,1,0,0,0,0,0,
    1,0,0,0,0,0,1,
    1,0,0,0,0,0,1,
    1,0,0,0,0,0,1,
    0,0,0,0,0,1,0,
    0,0,1,1,1,0,0,
  ],
  workouts: [
    0,0,0,1,0,0,0,
    0,0,1,1,1,0,0,
    0,1,0,1,0,1,0,
    1,0,0,1,0,0,1,
    0,0,0,1,0,0,0,
    0,0,0,1,0,0,0,
    0,0,1,1,1,0,0,
  ],
  journal: [
    0,1,1,1,1,1,0,
    0,1,0,0,0,1,0,
    0,1,0,1,0,1,0,
    0,1,0,1,0,1,0,
    0,1,0,0,0,1,0,
    0,1,0,1,0,1,0,
    0,1,1,1,1,1,0,
  ],
  goals: [
    0,0,1,1,1,0,0,
    0,1,0,0,0,1,0,
    1,0,0,1,0,0,1,
    1,0,1,1,1,0,1,
    1,0,0,1,0,0,1,
    0,1,0,0,0,1,0,
    0,0,1,1,1,0,0,
  ],
  finances: [
    0,0,1,1,1,0,0,
    0,1,0,1,0,0,0,
    1,0,0,1,0,0,0,
    0,1,0,1,0,1,0,
    0,0,0,1,0,0,1,
    0,0,0,1,0,1,0,
    0,0,1,1,1,0,0,
  ],
  calendar: [
    1,1,1,1,1,1,1,
    1,0,0,0,0,0,1,
    1,1,1,1,1,1,1,
    1,0,1,0,1,0,1,
    1,0,0,0,0,0,1,
    1,0,1,0,0,0,1,
    1,1,1,1,1,1,1,
  ],
  knowledge: [
    0,1,1,0,1,1,0,
    0,1,1,0,1,1,0,
    0,1,1,0,1,1,0,
    0,1,1,0,1,1,0,
    0,1,1,0,1,1,0,
    0,1,1,0,1,1,0,
    1,1,1,1,1,1,1,
  ],
  review: [
    0,1,1,1,1,0,0,
    1,0,0,0,0,0,0,
    1,0,0,0,1,1,0,
    1,0,0,0,0,1,0,
    1,0,0,0,1,1,0,
    1,0,0,0,0,0,0,
    0,1,1,1,1,0,0,
  ],
  chat: [
    0,1,1,1,1,1,0,
    1,0,0,0,0,0,1,
    1,0,1,0,1,0,1,
    1,0,0,0,0,0,1,
    0,1,1,1,1,1,0,
    0,0,0,1,0,0,0,
    0,0,1,0,0,0,0,
  ],
  settings: [
    0,0,1,0,1,0,0,
    0,1,1,1,1,1,0,
    1,1,0,0,0,1,1,
    0,1,0,0,0,1,0,
    1,1,0,0,0,1,1,
    0,1,1,1,1,1,0,
    0,0,1,0,1,0,0,
  ],
};

interface PixelIconProps {
  name: string;
  size?: number;
  className?: string;
}

export default function PixelIcon({ name, size = 14, className = "" }: PixelIconProps) {
  const grid = ICONS[name];
  if (!grid) return <span className={className}>?</span>;

  const cellSize = size / 7;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 7 7`}
      className={className}
      aria-hidden="true"
    >
      {grid.map((val, i) => {
        if (!val) return null;
        const x = i % 7;
        const y = Math.floor(i / 7);
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={1}
            height={1}
            fill="currentColor"
            shapeRendering="crispEdges"
          />
        );
      })}
    </svg>
  );
}

// Export icon names for use in nav items
export const ICON_NAMES: Record<string, string> = {
  "/": "dashboard",
  "/tasks": "tasks",
  "/habits": "habits",
  "/workouts": "workouts",
  "/journal": "journal",
  "/goals": "goals",
  "/finances": "finances",
  "/calendar": "calendar",
  "/knowledge": "knowledge",
  "/review": "review",
  "/chat": "chat",
  "/settings": "settings",
};
