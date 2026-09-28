// Bilinear-in-space, linear-in-time lookup on the shipped 0.5 degree forcing grid.
import type { ForcingArrows, LonLat } from "../data/types";
import { hoursFrom } from "./time";

export interface ForcingField {
  lons: number[];
  lats: number[];
  hours: number[];
  /** [frame][lat][lon] -> [u, v] m/s */
  cur: [number, number][][][];
  wind: [number, number][][][];
}

export function buildForcing(fa: ForcingArrows, tImage: string): ForcingField {
  const lons = [...new Set(fa.grid.map((g) => g[0]))].sort((a, b) => a - b);
  const lats = [...new Set(fa.grid.map((g) => g[1]))].sort((a, b) => a - b);
  const idx = fa.grid.map((g) => [lats.indexOf(g[1]), lons.indexOf(g[0])]);
  const empty = () => lats.map(() => lons.map(() => [0, 0] as [number, number]));
  const cur: ForcingField["cur"] = [];
  const wind: ForcingField["wind"] = [];
  for (const fr of fa.frames) {
    const c = empty();
    const w = empty();
    idx.forEach(([j, i], k) => {
      c[j][i] = fr.cur[k] ?? [0, 0];
      w[j][i] = fr.wind[k] ?? [0, 0];
    });
    cur.push(c);
    wind.push(w);
  }
  return { lons, lats, hours: fa.frames.map((f) => hoursFrom(tImage, f.t)), cur, wind };
}

function locate(arr: number[], x: number): [number, number, number] {
  if (x <= arr[0]) return [0, 0, 0];
  const n = arr.length - 1;
  if (x >= arr[n]) return [n, n, 0];
  let i = 0;
  while (i < n - 1 && arr[i + 1] <= x) i++;
  return [i, i + 1, (x - arr[i]) / (arr[i + 1] - arr[i])];
}

function sample(field: [number, number][][][], F: ForcingField, p: LonLat, h: number): [number, number] {
  const [t0, t1, ft] = locate(F.hours, h);
  const [j0, j1, fy] = locate(F.lats, p[1]);
  const [i0, i1, fx] = locate(F.lons, p[0]);
  const at = (t: number): [number, number] => {
    const g = field[t];
    const a = g[j0][i0], b = g[j0][i1], c = g[j1][i0], d = g[j1][i1];
    const lerp = (k: 0 | 1) => (a[k] * (1 - fx) + b[k] * fx) * (1 - fy) + (c[k] * (1 - fx) + d[k] * fx) * fy;
    return [lerp(0), lerp(1)];
  };
  const A = at(t0);
  const B = at(t1);
  return [A[0] + (B[0] - A[0]) * ft, A[1] + (B[1] - A[1]) * ft];
}

export const currentAt = (F: ForcingField, p: LonLat, h: number) => sample(F.cur, F, p, h);
export const windAt = (F: ForcingField, p: LonLat, h: number) => sample(F.wind, F, p, h);

/** Frame index nearest to hour h (for drawing arrows). */
export function nearestFrame(F: ForcingField, h: number): number {
  let best = 0;
  let bd = Infinity;
  F.hours.forEach((x, i) => {
    const d = Math.abs(x - h);
    if (d < bd) {
      bd = d;
      best = i;
    }
  });
  return best;
}
