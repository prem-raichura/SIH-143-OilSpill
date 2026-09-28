// Runtime icon atlas for deck.gl IconLayer. Every glyph is drawn white on transparent and used with
// mask: true, so the layer tints it (color = role/meaning). Glyphs point north; rotate with getAngle = -bearing.
import type { HullKind } from "../lib/vessels";

export interface IconDef {
  x: number;
  y: number;
  width: number;
  height: number;
  anchorX?: number;
  anchorY?: number;
  mask: boolean;
}

const CELL = 64;
type Draw = (g: CanvasRenderingContext2D) => void;

function hull(len: number, beam: number, bow: number, stern: "square" | "round"): Draw {
  // Top-down hull silhouette centred in the cell, bow pointing up.
  return (g) => {
    const cx = 32;
    const top = 32 - len / 2;
    const bot = 32 + len / 2;
    g.beginPath();
    g.moveTo(cx, top);
    g.quadraticCurveTo(cx + beam / 2, top + bow * 0.35, cx + beam / 2, top + bow);
    g.lineTo(cx + beam / 2, bot - (stern === "round" ? beam / 2 : 2));
    if (stern === "round") g.quadraticCurveTo(cx + beam / 2, bot, cx, bot);
    else {
      g.lineTo(cx + beam / 2 - 1, bot);
      g.lineTo(cx - beam / 2 + 1, bot);
    }
    if (stern === "round") g.quadraticCurveTo(cx - beam / 2, bot, cx - beam / 2, bot - beam / 2);
    g.lineTo(cx - beam / 2, top + bow);
    g.quadraticCurveTo(cx - beam / 2, top + bow * 0.35, cx, top);
    g.closePath();
    g.fill();
  };
}

const DRAW: Record<string, Draw> = {
  "hull-tanker": hull(56, 16, 14, "square"),
  "hull-cargo": hull(54, 17, 11, "square"),
  "hull-passenger": hull(50, 16, 16, "round"),
  "hull-fishing": hull(38, 15, 12, "round"),
  "hull-tug": hull(34, 17, 10, "round"),
  "hull-other": (g) => {
    // AIS-style pointed pentagon
    g.beginPath();
    g.moveTo(32, 6);
    g.lineTo(46, 30);
    g.lineTo(44, 58);
    g.lineTo(20, 58);
    g.lineTo(18, 30);
    g.closePath();
    g.fill();
  },
  "hull-outline": (g) => {
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(32, 7);
    g.lineTo(45, 30);
    g.lineTo(43, 57);
    g.lineTo(21, 57);
    g.lineTo(19, 30);
    g.closePath();
    g.stroke();
  },
  chevron: (g) => {
    g.lineWidth = 7;
    g.lineCap = "round";
    g.lineJoin = "round";
    g.beginPath();
    g.moveTo(16, 40);
    g.lineTo(32, 24);
    g.lineTo(48, 40);
    g.stroke();
  },
  diamond: (g) => {
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(32, 10);
    g.lineTo(54, 32);
    g.lineTo(32, 54);
    g.lineTo(10, 32);
    g.closePath();
    g.stroke();
  },
  platform: (g) => {
    g.lineWidth = 6;
    g.strokeRect(14, 14, 36, 36);
    g.beginPath();
    g.arc(32, 32, 6, 0, Math.PI * 2);
    g.fill();
  },
  anchor: (g) => {
    g.lineWidth = 5;
    g.lineCap = "round";
    g.beginPath();
    g.arc(32, 13, 5, 0, Math.PI * 2);
    g.moveTo(32, 18);
    g.lineTo(32, 54);
    g.moveTo(20, 26);
    g.lineTo(44, 26);
    g.moveTo(12, 38);
    g.quadraticCurveTo(14, 54, 32, 54);
    g.quadraticCurveTo(50, 54, 52, 38);
    g.stroke();
  },
  ring: (g) => {
    g.lineWidth = 7;
    g.beginPath();
    g.arc(32, 32, 20, 0, Math.PI * 2);
    g.stroke();
  },
  cross: (g) => {
    g.lineWidth = 7;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(16, 16);
    g.lineTo(48, 48);
    g.moveTo(48, 16);
    g.lineTo(16, 48);
    g.stroke();
  },
  plus: (g) => {
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(32, 10);
    g.lineTo(32, 54);
    g.moveTo(10, 32);
    g.lineTo(54, 32);
    g.stroke();
  },
  arrow: (g) => {
    // Current arrow: shaft from the bottom to a head at the top.
    g.lineWidth = 4;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(32, 60);
    g.lineTo(32, 10);
    g.stroke();
    g.beginPath();
    g.moveTo(32, 2);
    g.lineTo(42, 18);
    g.lineTo(22, 18);
    g.closePath();
    g.fill();
  },
  "fresh-end": (g) => {
    g.beginPath();
    g.moveTo(32, 6);
    g.lineTo(50, 40);
    g.lineTo(32, 32);
    g.lineTo(14, 40);
    g.closePath();
    g.fill();
  },
};

// Wind barbs, staff pointing north (towards where the wind comes from), station at the bottom.
function barb(kn: number): Draw {
  return (g) => {
    g.lineWidth = 3.5;
    g.lineCap = "round";
    g.beginPath();
    g.arc(32, 58, 3.5, 0, Math.PI * 2);
    g.fill();
    if (kn < 3) {
      g.beginPath();
      g.arc(32, 58, 7, 0, Math.PI * 2);
      g.stroke();
      return;
    }
    g.beginPath();
    g.moveTo(32, 58);
    g.lineTo(32, 6);
    g.stroke();
    let rest = Math.round(kn / 5) * 5;
    let y = 6;
    while (rest >= 50) {
      g.beginPath();
      g.moveTo(32, y);
      g.lineTo(52, y + 4);
      g.lineTo(32, y + 9);
      g.closePath();
      g.fill();
      y += 11;
      rest -= 50;
    }
    while (rest >= 10) {
      g.beginPath();
      g.moveTo(32, y);
      g.lineTo(52, y - 5);
      g.stroke();
      y += 7;
      rest -= 10;
    }
    if (rest >= 5) {
      if (y === 6) y += 6;
      g.beginPath();
      g.moveTo(32, y);
      g.lineTo(42, y - 3);
      g.stroke();
    }
  };
}
export const BARB_STEPS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60];
for (const k of BARB_STEPS) DRAW[`barb-${k}`] = barb(k);

export function barbIcon(kn: number): string {
  const k = BARB_STEPS.reduce((best, s) => (Math.abs(s - kn) < Math.abs(best - kn) ? s : best), 0);
  return `barb-${k}`;
}

export function hullIcon(k: HullKind): string {
  return `hull-${k}`;
}

let atlas: { url: string; mapping: Record<string, IconDef> } | null = null;

export function iconAtlas() {
  if (atlas) return atlas;
  const names = Object.keys(DRAW);
  const cols = 8;
  const rows = Math.ceil(names.length / cols);
  const canvas = document.createElement("canvas");
  canvas.width = cols * CELL;
  canvas.height = rows * CELL;
  const g = canvas.getContext("2d")!;
  const mapping: Record<string, IconDef> = {};
  names.forEach((name, i) => {
    const x = (i % cols) * CELL;
    const y = Math.floor(i / cols) * CELL;
    g.save();
    g.translate(x, y);
    g.fillStyle = "#fff";
    g.strokeStyle = "#fff";
    DRAW[name](g);
    g.restore();
    const anchorY = name.startsWith("barb") ? 58 : name === "arrow" ? 60 : 32;
    mapping[name] = { x, y, width: CELL, height: CELL, anchorX: 32, anchorY, mask: true };
  });
  atlas = { url: canvas.toDataURL("image/png"), mapping };
  return atlas;
}

/** Diagonal hatch pattern (45 degrees) for the release corridor fill. */
let hatch: { url: string; mapping: Record<string, IconDef> } | null = null;
export function hatchAtlas() {
  if (hatch) return hatch;
  const S = 16;
  const c = document.createElement("canvas");
  c.width = S;
  c.height = S;
  const g = c.getContext("2d")!;
  g.strokeStyle = "#fff";
  g.lineWidth = 2;
  g.beginPath();
  for (let k = -S; k <= S; k += 8) {
    g.moveTo(k, S);
    g.lineTo(k + S, 0);
  }
  g.stroke();
  hatch = { url: c.toDataURL("image/png"), mapping: { hatch: { x: 0, y: 0, width: S, height: S, mask: true } } };
  return hatch;
}
