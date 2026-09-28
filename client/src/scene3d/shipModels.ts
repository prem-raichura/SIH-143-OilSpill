// Procedural low-poly ships (no external assets). Bow points to -Z (north), up is +Y, 1 unit = 1 metre.
import * as THREE from "three";
import type { HullKind } from "../lib/vessels";
import { HULL_LENGTH_M } from "../lib/vessels";

interface Spec {
  L: number;
  B: number;
  freeboard: number;
  draft: number;
  hull: string;
  bottom: string;
  deck: string;
}

const SPECS: Record<HullKind, Spec> = {
  tanker: { L: HULL_LENGTH_M.tanker, B: 42, freeboard: 12, draft: 6, hull: "#2f3338", bottom: "#7c2b24", deck: "#5b6168" },
  cargo: { L: HULL_LENGTH_M.cargo, B: 30, freeboard: 11, draft: 5, hull: "#23415f", bottom: "#7c2b24", deck: "#4f5a63" },
  passenger: { L: HULL_LENGTH_M.passenger, B: 26, freeboard: 9, draft: 4, hull: "#f2f4f5", bottom: "#23415f", deck: "#d9dde0" },
  fishing: { L: HULL_LENGTH_M.fishing, B: 8, freeboard: 3, draft: 1.5, hull: "#d9d2c3", bottom: "#b8412f", deck: "#8d7b62" },
  tug: { L: HULL_LENGTH_M.tug, B: 11, freeboard: 3.5, draft: 2, hull: "#b8412f", bottom: "#2f3338", deck: "#555b61" },
  other: { L: HULL_LENGTH_M.other, B: 16, freeboard: 6, draft: 3, hull: "#56606b", bottom: "#7c2b24", deck: "#6b7176" },
};

const WHITE = "#eef1f3";
const CONTAINER = ["#b8412f", "#2e6fa8", "#c98500", "#3d7d5a", "#8a8f96", "#d8d2c4"];

function hullGeometry(L: number, B: number, h: number, bowFrac: number, roundStern: boolean): THREE.BufferGeometry {
  const s = new THREE.Shape();
  const hb = B / 2;
  const yBowStart = L / 2 - L * bowFrac;
  s.moveTo(0, L / 2);
  s.quadraticCurveTo(hb, L / 2 - L * bowFrac * 0.25, hb, yBowStart);
  if (roundStern) {
    s.lineTo(hb, -L / 2 + hb * 0.6);
    s.quadraticCurveTo(hb, -L / 2, 0, -L / 2);
    s.quadraticCurveTo(-hb, -L / 2, -hb, -L / 2 + hb * 0.6);
  } else {
    s.lineTo(hb, -L / 2 + 1);
    s.lineTo(hb * 0.92, -L / 2);
    s.lineTo(-hb * 0.92, -L / 2);
    s.lineTo(-hb, -L / 2 + 1);
  }
  s.lineTo(-hb, yBowStart);
  s.quadraticCurveTo(-hb, L / 2 - L * bowFrac * 0.25, 0, L / 2);
  const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 6 });
  g.rotateX(-Math.PI / 2); // shape +y (bow) -> -z (north), extrusion -> +y (up)
  return g;
}

function box(w: number, h: number, d: number, color: string, x = 0, y = 0, z = 0, emissive?: string) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.1, emissive: emissive ?? "#000", emissiveIntensity: emissive ? 0.4 : 0 }),
  );
  m.position.set(x, y + h / 2, z);
  m.castShadow = false;
  return m;
}

function cyl(r: number, h: number, color: string, x: number, y: number, z: number) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 10), new THREE.MeshStandardMaterial({ color, roughness: 0.6 }));
  m.position.set(x, y + h / 2, z);
  return m;
}

export interface ShipModel {
  group: THREE.Group;
  length: number;
  beam: number;
  navLights: THREE.Object3D;
  materials: THREE.MeshStandardMaterial[];
}

/** Build one ship. The group's origin is the waterline centre. */
export function buildShip(kind: HullKind, seed = 1): ShipModel {
  const sp = SPECS[kind];
  const { L, B } = sp;
  const g = new THREE.Group();
  const bowFrac = kind === "tanker" || kind === "cargo" ? 0.12 : 0.22;
  const round = kind === "passenger" || kind === "fishing" || kind === "tug";

  // Hull: underwater part (antifouling colour) + topsides
  const under = new THREE.Mesh(hullGeometry(L * 0.98, B * 0.96, sp.draft, bowFrac, round), new THREE.MeshStandardMaterial({ color: sp.bottom, roughness: 0.8 }));
  under.position.y = -sp.draft;
  const top = new THREE.Mesh(hullGeometry(L, B, sp.freeboard, bowFrac, round), new THREE.MeshStandardMaterial({ color: sp.hull, roughness: 0.55, metalness: 0.15 }));
  g.add(under, top);
  const deck = box(B * 0.9, 0.4, L * 0.84, sp.deck, 0, sp.freeboard, L * 0.04);
  g.add(deck);

  const Y = sp.freeboard + 0.4;
  const sternZ = L * 0.5; // stern is +Z
  let rnd = seed;
  const rand = () => {
    rnd = (rnd * 16807) % 2147483647;
    return rnd / 2147483647;
  };

  if (kind === "tanker") {
    g.add(box(B * 0.12, 1.6, L * 0.7, "#8a8f96", 0, Y, -L * 0.05)); // pipe rack
    for (let i = 0; i < 5; i++) g.add(box(B * 0.5, 0.8, 2, "#8a8f96", 0, Y, -L * 0.35 + i * L * 0.14));
    g.add(box(B * 0.8, 18, L * 0.1, WHITE, 0, Y, sternZ - L * 0.1)); // accommodation
    g.add(box(B * 0.95, 1.2, L * 0.04, WHITE, 0, Y + 18, sternZ - L * 0.12)); // bridge wings
    g.add(cyl(3, 10, "#b8412f", 0, Y + 18, sternZ - L * 0.05)); // funnel
  } else if (kind === "cargo") {
    const rows = Math.floor((L * 0.62) / 13);
    for (let i = 0; i < rows; i++) {
      const tiers = 2 + Math.floor(rand() * 3);
      for (let t = 0; t < tiers; t++) {
        g.add(box(B * 0.86, 2.5, 12, CONTAINER[Math.floor(rand() * CONTAINER.length)], 0, Y + t * 2.6, -L * 0.32 + i * 13));
      }
    }
    g.add(box(B * 0.8, 20, L * 0.08, WHITE, 0, Y, sternZ - L * 0.12));
    g.add(cyl(2.5, 8, "#2f3338", 0, Y + 20, sternZ - L * 0.06));
  } else if (kind === "passenger") {
    for (let d = 0; d < 4; d++) g.add(box(B * (0.84 - d * 0.08), 3, L * (0.7 - d * 0.1), WHITE, 0, Y + d * 3, L * 0.02));
    g.add(cyl(3, 7, "#2e6fa8", 0, Y + 12, L * 0.18));
  } else if (kind === "fishing") {
    g.add(box(B * 0.7, 3.2, L * 0.22, WHITE, 0, Y, -L * 0.18));
    g.add(cyl(0.25, 9, "#8a8f96", 0, Y, L * 0.05));
    g.add(box(0.2, 0.2, L * 0.6, "#8a8f96", 0, Y + 8, L * 0.2));
  } else if (kind === "tug") {
    g.add(box(B * 0.7, 3.5, L * 0.35, WHITE, 0, Y, -L * 0.05));
    g.add(box(B * 0.55, 2.5, L * 0.18, WHITE, 0, Y + 3.5, -L * 0.1));
    g.add(cyl(0.8, 4, "#2f3338", 0, Y + 3.5, L * 0.08));
  } else {
    g.add(box(B * 0.7, 8, L * 0.14, WHITE, 0, Y, sternZ - L * 0.16));
  }

  // Navigation lights: red port (left, -X), green starboard (+X), white masthead.
  const nav = new THREE.Group();
  const lamp = (color: string, x: number, y: number, z: number) => {
    // Oversized on purpose (like the ships themselves) so the lights read at a distance.
    const m = new THREE.Mesh(new THREE.SphereGeometry(Math.max(1.5, B * 0.09), 10, 10), new THREE.MeshBasicMaterial({ color, toneMapped: false }));
    m.position.set(x, y, z);
    return m;
  };
  const hTop = kind === "fishing" || kind === "tug" ? Y + 6 : Y + 20;
  nav.add(lamp("#ff3b30", -B / 2, Y + 2, -L * 0.1), lamp("#34c759", B / 2, Y + 2, -L * 0.1), lamp("#ffffff", 0, hTop + 2, -L * 0.2));
  nav.visible = false;
  g.add(nav);

  const materials: THREE.MeshStandardMaterial[] = [];
  g.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
    if (m && (m as THREE.MeshStandardMaterial).isMeshStandardMaterial) materials.push(m);
  });
  return { group: g, length: L, beam: B, navLights: nav, materials };
}

/** V-shaped Kelvin wake with a turbulent centre strip, fading with distance. Length along +Z (behind a north-pointing ship). */
export function buildWake(): THREE.Mesh {
  const segs = 24;
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const half = Math.tan((19.47 * Math.PI) / 180);
  const push = (x: number, z: number, a: number) => {
    pos.push(x, 0.3, z);
    col.push(1, 1, 1, a);
  };
  // arms: for each distance step, an inner and outer vertex on both sides
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const z = t;
    const w = z * half;
    const a = 0.38 * (1 - t) ** 1.8;
    push(-w - 0.012, z, 0);
    push(-w, z, a);
    push(-w + 0.012, z, 0);
    push(w - 0.012, z, 0);
    push(w, z, a);
    push(w + 0.012, z, 0);
    push(-0.02 - t * 0.03, z, 0);
    push(0, z, a * 1.2);
    push(0.02 + t * 0.03, z, 0);
  }
  const stride = 9;
  for (let i = 0; i < segs; i++) {
    const a = i * stride;
    const b = (i + 1) * stride;
    for (const off of [0, 3, 6]) {
      idx.push(a + off, b + off, a + off + 1, a + off + 1, b + off, b + off + 1);
      idx.push(a + off + 1, b + off + 1, a + off + 2, a + off + 2, b + off + 1, b + off + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 4));
  geo.setIndex(idx);
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false });
  return new THREE.Mesh(geo, mat);
}
