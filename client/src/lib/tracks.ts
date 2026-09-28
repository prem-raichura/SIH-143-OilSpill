import type { LonLat, TrackFeature } from "../data/types";
import { bearingDeg, distanceKm } from "./geo";

export interface Gap {
  i0: number;
  i1: number;
  h0: number;
  h1: number;
  hours: number;
}

export interface TrackIndex {
  mmsi: number;
  coords: LonLat[];
  tH: number[]; // hours relative to the image time
  sog: (number | null)[];
  gaps: Gap[];
  gapThresholdH: number;
}

export function indexTrack(f: TrackFeature): TrackIndex {
  const coords = f.geometry.coordinates;
  const tH = f.properties.t_offset_s.map((s) => s / 3600);
  const dts: number[] = [];
  for (let i = 1; i < tH.length; i++) dts.push(tH[i] - tH[i - 1]);
  const sorted = [...dts].sort((a, b) => a - b);
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0.1;
  const gapThresholdH = Math.max(0.5, 3 * median);
  const gaps: Gap[] = [];
  for (let i = 1; i < tH.length; i++) {
    const d = tH[i] - tH[i - 1];
    if (d > gapThresholdH) gaps.push({ i0: i - 1, i1: i, h0: tH[i - 1], h1: tH[i], hours: d });
  }
  return { mmsi: f.properties.mmsi, coords, tH, sog: f.properties.sog, gaps, gapThresholdH };
}

export type TrackStatus = "before" | "moving" | "gap" | "after";

export interface TrackState {
  pos: LonLat;
  bearing: number;
  sog: number | null;
  status: TrackStatus;
  /** Hours since the last fix (gap/after) or until the first fix (before). */
  sinceFixH: number;
  segment: number;
}

/** Last index i with tH[i] <= h (or -1). */
function segmentAt(tH: number[], h: number): number {
  let lo = 0, hi = tH.length - 1;
  if (h < tH[0]) return -1;
  if (h >= tH[hi]) return hi;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (tH[mid] <= h) lo = mid;
    else hi = mid;
  }
  return lo;
}

function segBearing(ti: TrackIndex, i: number): number {
  const n = ti.coords.length;
  const a = Math.max(0, Math.min(n - 2, i));
  // Skip zero-length segments so a stopped ship keeps its last heading.
  for (let k = a; k >= 0; k--) {
    if (distanceKm(ti.coords[k], ti.coords[k + 1]) > 0.005) return bearingDeg(ti.coords[k], ti.coords[k + 1]);
  }
  for (let k = a + 1; k < n - 1; k++) {
    if (distanceKm(ti.coords[k], ti.coords[k + 1]) > 0.005) return bearingDeg(ti.coords[k], ti.coords[k + 1]);
  }
  return 0;
}

export function stateAt(ti: TrackIndex, h: number): TrackState {
  const { tH, coords } = ti;
  const i = segmentAt(tH, h);
  if (i < 0) return { pos: coords[0], bearing: segBearing(ti, 0), sog: ti.sog[0], status: "before", sinceFixH: tH[0] - h, segment: 0 };
  if (i >= tH.length - 1) {
    const last = tH.length - 1;
    return {
      pos: coords[last],
      bearing: segBearing(ti, last - 1),
      sog: ti.sog[last],
      status: h - tH[last] > 0.25 ? "after" : "moving",
      sinceFixH: h - tH[last],
      segment: last,
    };
  }
  const d = tH[i + 1] - tH[i];
  if (d > ti.gapThresholdH) {
    return { pos: coords[i], bearing: segBearing(ti, i), sog: ti.sog[i], status: "gap", sinceFixH: h - tH[i], segment: i };
  }
  const f = d > 0 ? (h - tH[i]) / d : 0;
  const a = coords[i];
  const b = coords[i + 1];
  return {
    pos: [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f],
    bearing: segBearing(ti, i),
    sog: ti.sog[i] ?? ti.sog[i + 1],
    status: "moving",
    sinceFixH: 0,
    segment: i,
  };
}

/** Split the track at hour h: travelled part (up to the interpolated position) and remaining part. */
export function splitAt(ti: TrackIndex, h: number): { travelled: LonLat[]; remaining: LonLat[] } {
  const { tH, coords } = ti;
  if (h <= tH[0]) return { travelled: [], remaining: coords };
  if (h >= tH[tH.length - 1]) return { travelled: coords, remaining: [] };
  const s = stateAt(ti, h);
  const i = s.segment;
  const travelled = coords.slice(0, i + 1);
  if (s.status === "moving") travelled.push(s.pos);
  const remaining = [s.status === "moving" ? s.pos : coords[i], ...coords.slice(i + 1)];
  return { travelled, remaining };
}

/** Paths for continuous parts, and short segments for AIS gaps (to draw dotted). */
export function splitGaps(ti: TrackIndex): { parts: LonLat[][]; gapSegments: { path: LonLat[]; gap: Gap }[] } {
  const parts: LonLat[][] = [];
  const gapSegments: { path: LonLat[]; gap: Gap }[] = [];
  let start = 0;
  for (const g of ti.gaps) {
    if (g.i0 > start) parts.push(ti.coords.slice(start, g.i0 + 1));
    gapSegments.push({ path: [ti.coords[g.i0], ti.coords[g.i1]], gap: g });
    start = g.i1;
  }
  if (start < ti.coords.length - 1) parts.push(ti.coords.slice(start));
  return { parts, gapSegments };
}

/** Evenly spaced points along a path with local bearing, for direction chevrons. */
export function chevronsAlong(coords: LonLat[], everyKm: number): { pos: LonLat; bearing: number }[] {
  const out: { pos: LonLat; bearing: number }[] = [];
  let acc = everyKm / 2;
  for (let i = 0; i < coords.length - 1; i++) {
    const a = coords[i];
    const b = coords[i + 1];
    const seg = distanceKm(a, b);
    if (seg <= 0) continue;
    const brg = bearingDeg(a, b);
    while (acc <= seg) {
      const f = acc / seg;
      out.push({ pos: [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f], bearing: brg });
      acc += everyKm;
    }
    acc -= seg;
  }
  return out;
}

export function trackLengthKm(coords: LonLat[]): number {
  let s = 0;
  for (let i = 1; i < coords.length; i++) s += distanceKm(coords[i - 1], coords[i]);
  return s;
}
