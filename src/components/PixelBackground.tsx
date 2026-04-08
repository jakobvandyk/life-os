"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";

// Grid dimensions
const W = 120;
const H = 40;

// Colour keys → CSS variable names
const COLOR_MAP: Record<number, string> = {
  1: "var(--color-desert-border)",
  2: "var(--color-desert-border-strong)",
  3: "var(--color-desert-accent)",
  4: "var(--color-desert-text-3)",
  5: "var(--color-desert-forest)",
  6: "var(--color-desert-celestial)",
  7: "var(--color-desert-mystic)",
};

// --- Drawing helpers ---

function createGrid(): number[] {
  return new Array(W * H).fill(0);
}

function set(g: number[], x: number, y: number, c: number) {
  if (x >= 0 && x < W && y >= 0 && y < H) g[y * W + x] = c;
}

function hLine(g: number[], x1: number, x2: number, y: number, c: number) {
  for (let x = x1; x <= x2; x++) set(g, x, y, c);
}

function vLine(g: number[], x: number, y1: number, y2: number, c: number) {
  for (let y = y1; y <= y2; y++) set(g, x, y, c);
}

function rect(g: number[], x1: number, y1: number, x2: number, y2: number, c: number) {
  for (let y = y1; y <= y2; y++) hLine(g, x1, x2, y, c);
}

function triangle(g: number[], cx: number, top: number, base: number, h: number, c: number) {
  for (let row = 0; row < h; row++) {
    const width = Math.round((row / h) * base);
    const half = Math.floor(width / 2);
    hLine(g, cx - half, cx + half, top + row, c);
  }
}

function cactus(g: number[], x: number, bottom: number, height: number, c: number) {
  // Trunk
  vLine(g, x, bottom - height, bottom, c);
  // Left arm
  if (height >= 5) {
    const armY = bottom - Math.floor(height * 0.6);
    set(g, x - 1, armY, c);
    set(g, x - 1, armY + 1, c);
    set(g, x - 1, armY + 2, c);
    set(g, x - 2, armY, c);
  }
  // Right arm
  if (height >= 6) {
    const armY = bottom - Math.floor(height * 0.4);
    set(g, x + 1, armY, c);
    set(g, x + 1, armY + 1, c);
    set(g, x + 1, armY + 2, c);
    set(g, x + 2, armY, c);
  }
}

function mountain(g: number[], cx: number, peak: number, baseY: number, width: number, c: number, highlight?: number) {
  const h = baseY - peak;
  for (let row = 0; row <= h; row++) {
    const w = Math.round((row / h) * (width / 2));
    hLine(g, cx - w, cx + w, peak + row, c);
  }
  // Snow cap / highlight
  if (highlight) {
    set(g, cx, peak, highlight);
    set(g, cx - 1, peak + 1, highlight);
    set(g, cx + 1, peak + 1, highlight);
  }
}

function mesa(g: number[], x1: number, topY: number, x2: number, baseY: number, c: number) {
  // Flat top
  hLine(g, x1, x2, topY, c);
  // Sloped sides + fill
  for (let row = 1; row <= baseY - topY; row++) {
    const shrink = Math.min(row, 2);
    hLine(g, x1 - shrink, x2 + shrink, topY + row, c);
  }
}

function star(g: number[], x: number, y: number, c: number) {
  set(g, x, y, c);
}

function dots(g: number[], positions: [number, number][], c: number) {
  for (const [x, y] of positions) set(g, x, y, c);
}

// --- Scene builders ---

function buildDashboard(): number[] {
  const g = createGrid();
  // Ground line
  hLine(g, 0, W - 1, 37, 1);
  hLine(g, 0, W - 1, 38, 1);
  hLine(g, 0, W - 1, 39, 4);
  // Mesas
  mesa(g, 8, 30, 18, 37, 1);
  mesa(g, 85, 28, 100, 37, 1);
  mesa(g, 50, 32, 60, 37, 4);
  // Saguaro cacti
  cactus(g, 25, 36, 8, 5);
  cactus(g, 35, 36, 6, 5);
  cactus(g, 75, 36, 7, 5);
  cactus(g, 110, 36, 9, 5);
  // Setting sun
  set(g, 60, 22, 3);
  set(g, 59, 22, 3);
  set(g, 61, 22, 3);
  set(g, 60, 21, 3);
  // Stars
  dots(g, [[15, 8], [30, 5], [45, 10], [70, 3], [90, 7], [105, 12], [5, 14]], 2);
  return g;
}

function buildTasks(): number[] {
  const g = createGrid();
  // Ground
  hLine(g, 0, W - 1, 38, 1);
  hLine(g, 0, W - 1, 39, 4);
  // Winding path
  for (let x = 10; x < 110; x++) {
    const y = 37 - Math.round(Math.sin(x * 0.08) * 1.5);
    set(g, x, y, 2);
    set(g, x, y + 1, 2);
  }
  // Signposts
  vLine(g, 30, 31, 37, 2);
  rect(g, 28, 29, 33, 31, 1);
  vLine(g, 70, 30, 37, 2);
  rect(g, 68, 28, 73, 30, 1);
  // Cacti along trail
  cactus(g, 20, 37, 6, 5);
  cactus(g, 50, 37, 7, 5);
  cactus(g, 90, 37, 5, 5);
  cactus(g, 105, 37, 8, 5);
  // Small rocks
  dots(g, [[40, 37], [41, 37], [60, 38], [80, 37], [81, 37]], 4);
  // Stars
  dots(g, [[10, 5], [25, 8], [55, 3], [85, 6], [100, 10]], 2);
  return g;
}

function buildHabits(): number[] {
  const g = createGrid();
  // Canyon strata layers
  for (let layer = 0; layer < 6; layer++) {
    const y = 34 + layer;
    const c = layer % 2 === 0 ? 1 : 4;
    hLine(g, 0, W - 1, y, c);
  }
  // Canyon walls
  for (let y = 20; y <= 39; y++) {
    const leftW = 8 + Math.round(Math.sin(y * 0.4) * 2);
    hLine(g, 0, leftW, y, 1);
    const rightW = 8 + Math.round(Math.cos(y * 0.3) * 2);
    hLine(g, W - 1 - rightW, W - 1, y, 1);
  }
  // Waterfall
  vLine(g, 10, 20, 33, 6);
  vLine(g, 11, 21, 33, 6);
  // Splash
  dots(g, [[9, 34], [10, 34], [11, 34], [12, 34]], 6);
  // Rock details on walls
  dots(g, [[3, 25], [5, 28], [4, 31], [115, 24], [113, 27], [116, 30]], 2);
  // Plants on ledges
  set(g, 12, 23, 5);
  set(g, 13, 23, 5);
  set(g, 108, 26, 5);
  return g;
}

function buildWorkouts(): number[] {
  const g = createGrid();
  // Ground
  hLine(g, 0, W - 1, 38, 1);
  hLine(g, 0, W - 1, 39, 4);
  // Mountain range
  mountain(g, 15, 18, 38, 28, 1, 2);
  mountain(g, 40, 22, 38, 20, 4);
  mountain(g, 60, 15, 38, 30, 1, 2);
  mountain(g, 85, 20, 38, 24, 4);
  mountain(g, 105, 24, 38, 18, 1);
  // Boulders
  rect(g, 30, 36, 33, 37, 2);
  rect(g, 72, 36, 74, 37, 2);
  // Climbing rope on tallest peak
  vLine(g, 61, 15, 25, 3);
  // Stars
  dots(g, [[5, 5], [25, 3], [50, 8], [75, 4], [95, 9], [115, 6]], 2);
  return g;
}

function buildJournal(): number[] {
  const g = createGrid();
  // Ground
  hLine(g, 0, W - 1, 38, 1);
  hLine(g, 0, W - 1, 39, 4);
  // Campfire (center)
  const fx = 60;
  // Fire base (logs)
  hLine(g, fx - 3, fx + 3, 37, 2);
  set(g, fx - 4, 37, 4);
  set(g, fx + 4, 37, 4);
  // Flames
  set(g, fx, 34, 3);
  set(g, fx - 1, 35, 3);
  set(g, fx + 1, 35, 3);
  set(g, fx, 35, 3);
  set(g, fx, 36, 3);
  set(g, fx - 1, 36, 3);
  set(g, fx + 1, 36, 3);
  // Smoke wisps
  set(g, fx, 32, 4);
  set(g, fx - 1, 30, 4);
  set(g, fx + 1, 28, 4);
  set(g, fx, 26, 4);
  // Bedroll
  rect(g, 70, 37, 76, 37, 2);
  rect(g, 70, 36, 71, 36, 1);
  // Sitting log
  rect(g, 48, 36, 54, 37, 2);
  // Cacti in background
  cactus(g, 15, 37, 7, 5);
  cactus(g, 100, 37, 6, 5);
  // Stars (more prominent for journal/reflection)
  dots(g, [
    [8, 3], [20, 6], [32, 2], [45, 8], [55, 4],
    [68, 2], [78, 7], [88, 5], [95, 3], [108, 8], [115, 4],
    [12, 10], [38, 12], [82, 11], [100, 13],
  ], 2);
  // Bright stars
  dots(g, [[32, 2], [78, 7], [55, 4]], 6);
  return g;
}

function buildGoals(): number[] {
  const g = createGrid();
  // Ground / valley
  hLine(g, 0, W - 1, 38, 1);
  hLine(g, 0, W - 1, 39, 4);
  // Main peak with flag
  mountain(g, 55, 10, 38, 40, 1, 2);
  // Flag at summit
  vLine(g, 55, 7, 10, 2);
  rect(g, 56, 7, 59, 9, 3);
  // Valley mountains
  mountain(g, 20, 25, 38, 20, 4);
  mountain(g, 90, 28, 38, 22, 4);
  mountain(g, 110, 30, 38, 16, 1);
  // Eagle silhouette
  set(g, 35, 12, 1);
  set(g, 34, 11, 1);
  set(g, 36, 11, 1);
  set(g, 33, 12, 1);
  set(g, 37, 12, 1);
  // Stars
  dots(g, [[10, 5], [25, 3], [70, 6], [85, 4], [100, 8]], 2);
  return g;
}

function buildFinances(): number[] {
  const g = createGrid();
  // Ground (mine floor)
  hLine(g, 0, W - 1, 38, 1);
  hLine(g, 0, W - 1, 39, 4);
  // Mine entrance
  rect(g, 40, 28, 42, 37, 2); // left post
  rect(g, 58, 28, 60, 37, 2); // right post
  hLine(g, 40, 60, 28, 2); // top beam
  hLine(g, 40, 60, 27, 1);
  // Mine cart on rails
  hLine(g, 15, 35, 37, 2); // rails
  rect(g, 22, 34, 28, 36, 1); // cart body
  set(g, 23, 37, 2); // wheels
  set(g, 27, 37, 2);
  // Gold nuggets in cart
  set(g, 24, 34, 3);
  set(g, 26, 34, 3);
  set(g, 25, 33, 3);
  // Pickaxe
  vLine(g, 68, 32, 37, 2);
  set(g, 66, 31, 1);
  set(g, 67, 31, 1);
  set(g, 69, 32, 1);
  // Gold scattered
  dots(g, [[70, 38], [72, 39], [75, 38], [80, 39]], 3);
  // Rock wall backdrop
  for (let y = 25; y <= 39; y++) {
    hLine(g, 0, 5 + Math.round(Math.sin(y * 0.5) * 2), y, 1);
    hLine(g, W - 6 - Math.round(Math.cos(y * 0.4) * 2), W - 1, y, 1);
  }
  // Lantern
  set(g, 45, 30, 3);
  set(g, 45, 31, 2);
  return g;
}

function buildCalendar(): number[] {
  const g = createGrid();
  // Horizon line
  hLine(g, 0, W - 1, 35, 1);
  hLine(g, 0, W - 1, 36, 1);
  hLine(g, 0, W - 1, 37, 4);
  hLine(g, 0, W - 1, 38, 4);
  hLine(g, 0, W - 1, 39, 4);
  // Moon
  set(g, 90, 6, 2);
  set(g, 89, 6, 2);
  set(g, 91, 6, 2);
  set(g, 90, 5, 2);
  set(g, 90, 7, 2);
  set(g, 89, 5, 2);
  set(g, 91, 5, 2);
  set(g, 89, 7, 2);
  set(g, 91, 7, 2);
  // Moon shadow (crescent)
  set(g, 91, 6, 0);
  set(g, 91, 5, 0);
  // Constellation patterns
  // Orion-like
  dots(g, [[20, 8], [22, 10], [24, 8], [22, 12], [21, 14], [23, 14], [22, 16]], 2);
  // Lines between stars
  // Dipper-like
  dots(g, [[50, 5], [53, 6], [56, 5], [59, 7], [62, 7], [62, 10], [59, 10]], 2);
  // Scattered stars
  dots(g, [
    [5, 3], [10, 12], [15, 6], [30, 4], [35, 15], [40, 9],
    [45, 3], [65, 4], [70, 11], [75, 7], [80, 14], [85, 10],
    [100, 8], [105, 4], [110, 13], [115, 7],
  ], 6);
  // Bright stars
  dots(g, [[30, 4], [75, 7], [105, 4]], 3);
  // Subtle mesa on horizon
  mesa(g, 15, 33, 30, 35, 4);
  mesa(g, 80, 32, 95, 35, 4);
  return g;
}

function buildKnowledge(): number[] {
  const g = createGrid();
  // Floor
  hLine(g, 0, W - 1, 38, 1);
  hLine(g, 0, W - 1, 39, 4);
  // Stone archway
  vLine(g, 45, 20, 38, 1);
  vLine(g, 46, 20, 38, 1);
  vLine(g, 74, 20, 38, 1);
  vLine(g, 75, 20, 38, 1);
  // Arch top
  for (let x = 46; x <= 74; x++) {
    const y = 20 - Math.round(Math.sqrt(Math.max(0, 196 - (x - 60) * (x - 60))) * 0.3);
    set(g, x, y, 1);
    set(g, x, y + 1, 1);
  }
  // Scroll shelves (left)
  for (let shelf = 0; shelf < 3; shelf++) {
    const sy = 26 + shelf * 4;
    hLine(g, 10, 25, sy, 2);
    // Books/scrolls on shelf
    for (let bx = 11; bx < 25; bx += 3) {
      vLine(g, bx, sy - 2, sy - 1, 1);
      vLine(g, bx + 1, sy - 3, sy - 1, 4);
    }
  }
  // Scroll shelves (right)
  for (let shelf = 0; shelf < 3; shelf++) {
    const sy = 26 + shelf * 4;
    hLine(g, 95, 110, sy, 2);
    for (let bx = 96; bx < 110; bx += 3) {
      vLine(g, bx, sy - 2, sy - 1, 4);
      vLine(g, bx + 1, sy - 3, sy - 1, 1);
    }
  }
  // Lantern (hanging in arch)
  set(g, 60, 22, 3);
  set(g, 60, 23, 2);
  set(g, 59, 23, 2);
  set(g, 61, 23, 2);
  // Glow
  dots(g, [[59, 22], [61, 22], [60, 24]], 3);
  return g;
}

function buildReview(): number[] {
  const g = createGrid();
  // Ground
  hLine(g, 0, W - 1, 38, 1);
  hLine(g, 0, W - 1, 39, 4);
  // Compass rose (center)
  const cx = 60, cy = 25;
  // Circle outline
  for (let a = 0; a < 360; a += 15) {
    const rad = (a * Math.PI) / 180;
    const px = Math.round(cx + Math.cos(rad) * 8);
    const py = Math.round(cy + Math.sin(rad) * 6);
    set(g, px, py, 1);
  }
  // Cardinal points
  vLine(g, cx, cy - 8, cy - 1, 2);  // N
  vLine(g, cx, cy + 1, cy + 8, 2);  // S
  hLine(g, cx - 10, cx - 1, cy, 2); // W
  hLine(g, cx + 1, cx + 10, cy, 2); // E
  // North arrow accent
  set(g, cx, cy - 8, 3);
  set(g, cx - 1, cy - 7, 3);
  set(g, cx + 1, cy - 7, 3);
  // Center dot
  set(g, cx, cy, 3);
  // Map edges (decorative corners)
  hLine(g, 5, 15, 15, 4);
  vLine(g, 5, 15, 25, 4);
  hLine(g, 105, 115, 15, 4);
  vLine(g, 115, 15, 25, 4);
  // Trail markers
  dots(g, [[20, 37], [35, 36], [45, 37], [80, 37], [95, 36], [110, 37]], 2);
  // Stars
  dots(g, [[10, 5], [30, 8], [90, 6], [110, 3]], 2);
  return g;
}

function buildChat(): number[] {
  const g = createGrid();
  // Ground
  hLine(g, 0, W - 1, 38, 1);
  hLine(g, 0, W - 1, 39, 4);
  // Tent
  triangle(g, 30, 28, 16, 10, 1);
  set(g, 30, 28, 2); // tent peak
  // Tent opening
  set(g, 29, 37, 0);
  set(g, 30, 37, 0);
  set(g, 31, 37, 0);
  set(g, 30, 36, 0);
  // Cactus
  cactus(g, 80, 37, 8, 5);
  cactus(g, 95, 37, 6, 5);
  // Smoke signals (speech bubble shape)
  set(g, 50, 35, 4);
  set(g, 51, 33, 4);
  set(g, 49, 31, 4);
  // Smoke "bubbles"
  for (let a = 0; a < 360; a += 30) {
    const rad = (a * Math.PI) / 180;
    set(g, 50 + Math.round(Math.cos(rad) * 3), 24 + Math.round(Math.sin(rad) * 2), 4);
  }
  rect(g, 48, 23, 52, 25, 0); // clear inside
  dots(g, [[49, 24], [50, 24], [51, 24]], 4); // dots inside bubble
  // Small fire
  set(g, 50, 36, 3);
  set(g, 50, 37, 3);
  // Stars
  dots(g, [[5, 4], [15, 8], [40, 3], [65, 6], [85, 4], [105, 9], [115, 5]], 2);
  return g;
}

function buildSettings(): number[] {
  const g = createGrid();
  // Floor
  hLine(g, 0, W - 1, 38, 1);
  hLine(g, 0, W - 1, 39, 4);
  // Large gear (left)
  const gx = 30, gy = 28;
  for (let a = 0; a < 360; a += 10) {
    const rad = (a * Math.PI) / 180;
    const r = a % 40 < 20 ? 7 : 6; // teeth
    set(g, gx + Math.round(Math.cos(rad) * r), gy + Math.round(Math.sin(rad) * r * 0.7), 1);
  }
  set(g, gx, gy, 2); // axle
  // Small gear (right)
  const g2x = 42, g2y = 30;
  for (let a = 0; a < 360; a += 15) {
    const rad = (a * Math.PI) / 180;
    const r = a % 45 < 22 ? 4 : 3;
    set(g, g2x + Math.round(Math.cos(rad) * r), g2y + Math.round(Math.sin(rad) * r * 0.7), 1);
  }
  set(g, g2x, g2y, 2);
  // Workbench
  rect(g, 60, 33, 90, 33, 2); // table top
  vLine(g, 62, 34, 37, 1); // legs
  vLine(g, 88, 34, 37, 1);
  // Tools on bench
  vLine(g, 70, 29, 33, 4); // wrench handle
  set(g, 69, 29, 4);
  set(g, 71, 29, 4);
  // Hammer
  vLine(g, 78, 30, 33, 4);
  rect(g, 76, 29, 80, 30, 2);
  // Bolt/screw
  set(g, 85, 32, 3);
  set(g, 86, 32, 3);
  // Scattered parts
  dots(g, [[65, 32], [72, 32], [82, 32]], 2);
  dots(g, [[100, 37], [102, 38], [105, 37]], 4);
  return g;
}

// --- Scene registry ---

const SCENE_BUILDERS: Record<string, () => number[]> = {
  dashboard: buildDashboard,
  tasks: buildTasks,
  habits: buildHabits,
  workouts: buildWorkouts,
  journal: buildJournal,
  goals: buildGoals,
  finances: buildFinances,
  calendar: buildCalendar,
  knowledge: buildKnowledge,
  review: buildReview,
  chat: buildChat,
  settings: buildSettings,
};

const ROUTE_TO_SCENE: Record<string, string> = {
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

// Cache built scenes
const sceneCache = new Map<string, number[]>();

function getScene(name: string): number[] {
  if (!sceneCache.has(name)) {
    const builder = SCENE_BUILDERS[name];
    if (builder) sceneCache.set(name, builder());
  }
  return sceneCache.get(name) || createGrid();
}

export default function PixelBackground() {
  const pathname = usePathname();
  const sceneName = ROUTE_TO_SCENE[pathname] || "dashboard";

  const pixels = useMemo(() => {
    const grid = getScene(sceneName);
    const result: { x: number; y: number; color: string }[] = [];
    for (let i = 0; i < grid.length; i++) {
      if (grid[i] !== 0) {
        const color = COLOR_MAP[grid[i]];
        if (color) {
          result.push({ x: i % W, y: Math.floor(i / W), color });
        }
      }
    }
    return result;
  }, [sceneName]);

  if (pixels.length === 0) return null;

  return (
    <div
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden"
      aria-hidden="true"
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="absolute bottom-0 left-0 w-full"
        style={{ opacity: 0.07, height: "60vh" }}
        preserveAspectRatio="xMidYMax meet"
        shapeRendering="crispEdges"
      >
        {pixels.map((p, i) => (
          <rect
            key={i}
            x={p.x}
            y={p.y}
            width={1}
            height={1}
            fill={p.color}
          />
        ))}
      </svg>
    </div>
  );
}
