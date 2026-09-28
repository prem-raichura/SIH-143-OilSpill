// Small procedural ship meshes for deck.gl SimpleMeshLayer (tilted 3D map).
// Metres, x = starboard (east when heading north), y = bow (north), z = up. Flat-shaded triangles.
import type { HullKind } from "../lib/vessels";
import { HULL_LENGTH_M } from "../lib/vessels";

export interface Mesh {
  positions: { value: Float32Array; size: 3 };
  normals: { value: Float32Array; size: 3 };
  /** Baked light (the layer tints it with the ship's role colour); deck's lighting uniforms are unreliable here. */
  colors: { value: Float32Array; size: 3 };
}

const LIGHT = (() => {
  const l = [0.45, -0.35, 0.82];
  const n = Math.hypot(l[0], l[1], l[2]);
  return l.map((x) => x / n);
})();

type V3 = [number, number, number];

function build(): { tri: (a: V3, b: V3, c: V3) => void; quad: (a: V3, b: V3, c: V3, d: V3) => void; done: () => Mesh } {
  const pos: number[] = [];
  const nor: number[] = [];
  const tri = (a: V3, b: V3, c: V3) => {
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const l = Math.hypot(n[0], n[1], n[2]) || 1;
    for (const p of [a, b, c]) {
      pos.push(...p);
      nor.push(n[0] / l, n[1] / l, n[2] / l);
    }
  };
  return {
    tri,
    quad: (a, b, c, d) => {
      tri(a, b, c);
      tri(a, c, d);
    },
    done: () => {
      const col = new Float32Array(nor.length);
      for (let i = 0; i < nor.length; i += 3) {
        const d = Math.max(0, nor[i] * LIGHT[0] + nor[i + 1] * LIGHT[1] + nor[i + 2] * LIGHT[2]);
        const shade = 0.55 + 0.45 * d;
        col[i] = col[i + 1] = col[i + 2] = shade;
      }
      return { positions: { value: new Float32Array(pos), size: 3 }, normals: { value: new Float32Array(nor), size: 3 }, colors: { value: col, size: 3 } };
    },
  };
}

/** Hull outline (counter-clockwise seen from above), bow at +y. */
function outline(L: number, B: number, bowFrac: number, round: boolean): [number, number][] {
  const hb = B / 2;
  const pts: [number, number][] = [];
  const bowStart = L / 2 - L * bowFrac;
  // starboard side from stern to bow
  pts.push(round ? [hb * 0.7, -L / 2] : [hb * 0.95, -L / 2]);
  pts.push([hb, -L / 2 + (round ? hb * 0.6 : 1)]);
  pts.push([hb, bowStart]);
  for (let i = 1; i <= 5; i++) {
    const t = i / 6;
    pts.push([hb * Math.cos((t * Math.PI) / 2), bowStart + (L / 2 - bowStart) * Math.sin((t * Math.PI) / 2)]);
  }
  pts.push([0, L / 2]);
  // mirror to port side
  const port = pts.slice(0, -1).map(([x, y]) => [-x, y] as [number, number]).reverse();
  return [...pts, ...port];
}

function prism(m: ReturnType<typeof build>, ring: [number, number][], z0: number, z1: number) {
  const n = ring.length;
  // sides
  for (let i = 0; i < n; i++) {
    const [x0, y0] = ring[i];
    const [x1, y1] = ring[(i + 1) % n];
    m.quad([x0, y0, z0], [x1, y1, z0], [x1, y1, z1], [x0, y0, z1]);
  }
  // top cap (fan around centroid; outline is star-shaped from the centre)
  let cx = 0, cy = 0;
  for (const [x, y] of ring) { cx += x; cy += y; }
  cx /= n; cy /= n;
  for (let i = 0; i < n; i++) {
    const [x0, y0] = ring[i];
    const [x1, y1] = ring[(i + 1) % n];
    m.tri([cx, cy, z1], [x0, y0, z1], [x1, y1, z1]);
  }
}

function box(m: ReturnType<typeof build>, cx: number, cy: number, w: number, d: number, z0: number, h: number) {
  const r: [number, number][] = [[cx - w / 2, cy - d / 2], [cx + w / 2, cy - d / 2], [cx + w / 2, cy + d / 2], [cx - w / 2, cy + d / 2]];
  prism(m, r, z0, z0 + h);
}

const cache = new Map<HullKind, Mesh>();

export function shipMesh(kind: HullKind): Mesh {
  const hit = cache.get(kind);
  if (hit) return hit;
  const L = HULL_LENGTH_M[kind];
  const B = { tanker: 42, cargo: 30, passenger: 26, fishing: 8, tug: 11, other: 16 }[kind];
  const F = { tanker: 12, cargo: 11, passenger: 9, fishing: 3, tug: 3.5, other: 6 }[kind];
  const m = build();
  prism(m, outline(L, B, kind === "tanker" || kind === "cargo" ? 0.12 : 0.22, kind === "passenger" || kind === "fishing" || kind === "tug"), 0, F);
  if (kind === "cargo") {
    for (let i = 0; i < 6; i++) box(m, 0, -L * 0.1 + i * L * 0.09, B * 0.85, L * 0.07, F, 7);
    box(m, 0, -L * 0.36, B * 0.8, L * 0.08, F, 20);
  } else if (kind === "tanker") {
    box(m, 0, -L * 0.4, B * 0.8, L * 0.1, F, 18);
  } else if (kind === "passenger") {
    box(m, 0, 0, B * 0.82, L * 0.7, F, 12);
  } else {
    box(m, 0, L * 0.1, B * 0.7, L * 0.25, F, Math.max(3, F));
  }
  const mesh = m.done();
  cache.set(kind, mesh);
  return mesh;
}
