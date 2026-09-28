// Ensemble-mean "routes" of the oil from the particle frames.
import type { DriftFrames, LonLat } from "../data/types";
import { makeEnu } from "./geo";

export interface OilRoute {
  hours: number[]; // signed hours relative to the image (backward: 0, -1, ..., forward: 0, 1, ...)
  mean: LonLat[];
  spreadKm: number[];
  members: LonLat[][]; // per-member mean paths (backward only)
}

function meanOf(points: (LonLat | null)[]): LonLat | null {
  let x = 0, y = 0, n = 0;
  for (const p of points) {
    if (!p) continue;
    x += p[0];
    y += p[1];
    n++;
  }
  return n ? [x / n, y / n] : null;
}

function spreadOf(points: (LonLat | null)[], m: LonLat): number {
  const enu = makeEnu(m);
  let s = 0, n = 0;
  for (const p of points) {
    if (!p) continue;
    const [x, y] = enu.toKm(p);
    s += x * x + y * y;
    n++;
  }
  return n ? Math.sqrt(s / n) : 0;
}

export function backwardRoute(frames: DriftFrames["backward"]["frames"], members = 10): OilRoute {
  const hours: number[] = [];
  const mean: LonLat[] = [];
  const spreadKm: number[] = [];
  const perMember = frames[0] ? Math.floor(frames[0].length / members) : 0;
  const memberPaths: LonLat[][] = Array.from({ length: members }, () => []);
  frames.forEach((fr, h) => {
    const m = meanOf(fr);
    if (!m) return;
    hours.push(h === 0 ? 0 : -h);
    mean.push(m);
    spreadKm.push(spreadOf(fr, m));
    for (let k = 0; k < members && perMember > 0; k++) {
      const mm = meanOf(fr.slice(k * perMember, (k + 1) * perMember));
      if (mm) memberPaths[k].push(mm);
    }
  });
  return { hours, mean, spreadKm, members: memberPaths };
}

export function forwardRoute(frames: DriftFrames["forward"]["frames"]): OilRoute {
  const hours: number[] = [];
  const mean: LonLat[] = [];
  const spreadKm: number[] = [];
  frames.forEach((fr, h) => {
    const m = meanOf(fr);
    if (!m) return;
    hours.push(h);
    mean.push(m);
    spreadKm.push(spreadOf(fr, m));
  });
  return { hours, mean, spreadKm, members: [] };
}

/**
 * Particle positions at a fractional hour, linearly interpolated between frames.
 * Backward frames are indexed by hours before the image; forward by hours after.
 */
export function particlesAt(frames: (LonLat | null)[][], hAbs: number): LonLat[] {
  if (!frames.length) return [];
  const h = Math.max(0, Math.min(frames.length - 1, hAbs));
  const i = Math.floor(h);
  const j = Math.min(frames.length - 1, i + 1);
  const f = h - i;
  const A = frames[i];
  const B = frames[j];
  const out: LonLat[] = [];
  for (let k = 0; k < A.length; k++) {
    const a = A[k];
    const b = B[k] ?? a;
    if (!a) continue;
    out.push(b ? [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f] : a);
  }
  return out;
}
