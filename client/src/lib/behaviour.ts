// Post-incident behaviour events from a shipped AIS track, using the same rules as
// Dataset/build/b5_attribution.py monitoring(). Context only: never used for scoring.
import type { LonLat, MonitoringEvent } from "../data/types";
import { distanceKm } from "./geo";
import { isoAt } from "./time";
import type { TrackIndex } from "./tracks";

export interface BehaviourInput {
  ti: TrackIndex;
  tImage: string;
  windowH: number;
  ports: LonLat[];
  slick: LonLat[];
}

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

function minDist(p: LonLat, pts: LonLat[]): number {
  let best = Infinity;
  for (const q of pts) {
    // cheap bounding test first (about 0.2 degrees)
    if (Math.abs(q[0] - p[0]) > 0.3 || Math.abs(q[1] - p[1]) > 0.3) continue;
    const d = distanceKm(p, q);
    if (d < best) best = d;
  }
  return best;
}

export function behaviourEvents({ ti, tImage, windowH, ports, slick }: BehaviourInput): MonitoringEvent[] {
  const idx: number[] = [];
  ti.tH.forEach((h, i) => {
    if (h >= 0 && h <= windowH) idx.push(i);
  });
  if (idx.length < 2) return [];
  const t = idx.map((i) => ti.tH[i]);
  const pos = idx.map((i) => ti.coords[i]);
  const sog = idx.map((i) => ti.sog[i] ?? NaN);
  const ev: MonitoringEvent[] = [];
  const at = (h: number) => isoAt(tImage, h);

  // Port entry: within 5 km of a World Port Index port
  const k = pos.findIndex((p) => minDist(p, ports) <= 5);
  if (k >= 0) ev.push({ t: at(t[k]), type: "port_entry", text: "within 5 km of a World Port Index port", derived: true });

  // AIS gaps of an hour or more
  const dt: number[] = [];
  for (let i = 1; i < t.length; i++) {
    dt.push(t[i] - t[i - 1]);
    if (t[i] - t[i - 1] >= 1) ev.push({ t: at(t[i - 1]), type: "ais_gap", text: `AIS silent for ${(t[i] - t[i - 1]).toFixed(1)} h`, derived: true });
  }

  // Loitering: below 2 kn for 30 minutes or more in total
  const slow = sog.map((s) => s < 2);
  const slowCount = slow.filter(Boolean).length;
  if (slowCount * median(dt) >= 0.5) {
    ev.push({ t: at(t[slow.indexOf(true)]), type: "loitering", text: "below 2 kn for 30+ min", derived: true });
  }

  // Back within 10 km of the slick more than 3 h after the image
  const back = pos.findIndex((p, i) => t[i] > 3 && minDist(p, slick) <= 10);
  if (back >= 0) ev.push({ t: at(t[back]), type: "corridor_reentry", text: "back within 10 km of the slick area", derived: true });

  // Typical speed change of more than 50 % between the first and last quarter
  const q = Math.max(3, Math.floor(sog.length / 4));
  const valid = (xs: number[]) => xs.filter((x) => isFinite(x));
  const m0 = median(valid(sog.slice(0, q)));
  const m1 = median(valid(sog.slice(-q)));
  if (m0 > 3 && Math.abs(m1 - m0) / m0 > 0.5) {
    ev.push({ t: at(t[t.length - 1]), type: "speed_change", text: `typical speed ${m0.toFixed(1)} -> ${m1.toFixed(1)} kn`, derived: true });
  }
  return ev.sort((a, b) => a.t.localeCompare(b.t));
}
