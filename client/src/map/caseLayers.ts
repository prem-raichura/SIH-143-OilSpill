// All map layers of a case. Static geometry is prepared once (prepareStatic); time-dependent parts
// (ships at the clock time, particles, forcing frame) are cheap and rebuilt per frame.
import type { Layer } from "@deck.gl/core";
import { FillStyleExtension, PathStyleExtension } from "@deck.gl/extensions";
import { TripsLayer } from "@deck.gl/geo-layers";
import { SimpleMeshLayer } from "@deck.gl/mesh-layers";
import { shipMesh } from "./shipMesh";
import {
  BitmapLayer, GeoJsonLayer, IconLayer, PathLayer, PolygonLayer, ScatterplotLayer, SolidPolygonLayer, TextLayer,
} from "@deck.gl/layers";
import type { CaseDerived } from "../case/useCase";
import { dataUrl } from "../data/load";
import type { Feature, FeatureCollection, LonLat, PolygonGeometry } from "../data/types";
import type { Palette, RGBA } from "../design/palette";
import { mix, rgba } from "../design/palette";
import type { DriftedPoint } from "../lib/drift";
import { destination, distanceKm, geometryRings, makeEnu, reachEllipse } from "../lib/geo";
import { nearestFrame } from "../lib/forcing";
import { particlesAt } from "../lib/oilroutes";
import { chevronsAlong, splitGaps, stateAt, type Gap } from "../lib/tracks";
import { HULL_LENGTH_M, hullKind, type HullKind, type Role, type Vessel } from "../lib/vessels";
import { fmtSignedH } from "../lib/time";
import type { LayerId } from "../store/workspace";
import { FONT_SANS } from "./layers/basemap";
import { barbIcon, hatchAtlas, hullIcon, iconAtlas } from "./icons";

const dashExt = new PathStyleExtension({ dash: true });
const fillExt = new FillStyleExtension({ pattern: true });
/** Dash props for PathStyleExtension, typed as {} so the surrounding layer props stay type-checked. */
function dashed<D>(getDashArray: [number, number] | ((d: D) => [number, number])): {} {
  return { getDashArray, dashJustified: true, extensions: [dashExt] };
}

export const ROLE_WIDTH: Record<Role, number> = { leading: 3, shortlist: 2.2, screened: 1.5, eliminated: 1.25, background: 0.8 };

export function roleColor(P: Palette, role: Role, alpha = 1): RGBA {
  const hex = { leading: P.shipLead, shortlist: P.shipShort, screened: P.shipScreen, eliminated: P.shipElim, background: P.shipBg }[role];
  return rgba(hex, alpha);
}

interface TripPart {
  mmsi: number;
  role: Role;
  path: LonLat[];
  timestamps: number[];
  sog: (number | null)[];
}
interface GapSeg {
  mmsi: number;
  role: Role;
  path: LonLat[];
  gap: Gap;
  mid: LonLat;
}
interface Ellipse {
  mmsi: number;
  role: Role;
  ring: LonLat[];
  hours: number;
}
interface ElimLine {
  mmsi: number;
  path: [LonLat, LonLat];
  text: string;
  mid: LonLat;
}

export interface StaticData {
  parts: TripPart[];
  ghosts: TripPart[];
  gapSegs: GapSeg[];
  ellipses: Ellipse[];
  elimLines: ElimLine[];
  chevrons: Map<number, { pos: LonLat; bearing: number; mmsi: number; role: Role }[]>;
  isoLabels: { pos: LonLat; text: string }[];
  coneLabels: { pos: LonLat; text: string }[];
  measure: { axis: LonLat[]; width: LonLat[]; fresh: { pos: LonLat; bearing: number } | null; centroid: LonLat; axisLabel: string };
  releasePoints: { mmsi: number; pos: LonLat; text: string; role: Role }[];
  targets: { pos: LonLat; platform: boolean; props: Record<string, unknown> }[];
}

function topVertex(rings: LonLat[][]): LonLat {
  let best: LonLat = rings[0]?.[0] ?? [0, 0];
  for (const r of rings) for (const p of r) if (p[1] > best[1]) best = p;
  return best;
}

function nearestOnRings(p: LonLat, rings: LonLat[][]): LonLat {
  const enu = makeEnu(p);
  let best: LonLat = rings[0]?.[0] ?? p;
  let bd = Infinity;
  for (const ring of rings) {
    for (let i = 0; i < ring.length - 1; i++) {
      const [ax, ay] = enu.toKm(ring[i]);
      const [bx, by] = enu.toKm(ring[i + 1]);
      const dx = bx - ax, dy = by - ay;
      const L = dx * dx + dy * dy;
      const t = L > 0 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / L)) : 0;
      const x = ax + t * dx, y = ay + t * dy;
      const d = Math.hypot(x, y);
      if (d < bd) {
        bd = d;
        best = enu.toLonLat(x, y);
      }
    }
  }
  return best;
}

export function prepareStatic(c: CaseDerived): StaticData {
  const parts: TripPart[] = [];
  const ghosts: TripPart[] = [];
  const gapSegs: GapSeg[] = [];
  const ellipses: Ellipse[] = [];
  const chevrons = new Map<number, { pos: LonLat; bearing: number; mmsi: number; role: Role }[]>();
  for (const v of c.vessels) {
    const ti = c.trackIdx.get(v.mmsi);
    if (!ti) continue;
    const { parts: ps, gapSegments } = splitGaps(ti);
    let cursor = 0;
    for (const p of ps) {
      const start = ti.coords.indexOf(p[0], cursor);
      const i0 = start >= 0 ? start : cursor;
      const ts = ti.tH.slice(i0, i0 + p.length);
      parts.push({ mmsi: v.mmsi, role: v.role, path: p, timestamps: ts, sog: ti.sog.slice(i0, i0 + p.length) });
      cursor = i0 + p.length - 1;
    }
    ghosts.push({ mmsi: v.mmsi, role: v.role, path: ti.coords, timestamps: ti.tH, sog: ti.sog });
    for (const g of gapSegments) {
      const a = g.path[0], b = g.path[1];
      gapSegs.push({ mmsi: v.mmsi, role: v.role, path: g.path, gap: g.gap, mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] });
      if (v.role !== "background" && g.gap.h0 < 1 && g.gap.hours >= 1) {
        const ring = reachEllipse(a, b, g.gap.hours, 25);
        if (ring) ellipses.push({ mmsi: v.mmsi, role: v.role, ring, hours: g.gap.hours });
      }
    }
    if (v.role !== "background") {
      const len = ti.coords.length;
      const out: { pos: LonLat; bearing: number; mmsi: number; role: Role }[] = [];
      for (const ch of chevronsAlong(ti.coords.slice(0, len), 8)) out.push({ ...ch, mmsi: v.mmsi, role: v.role });
      chevrons.set(v.mmsi, out);
    }
  }

  // Eliminated ships: closest approach to the expanded corridor (the veto geometry).
  const elimLines: ElimLine[] = [];
  const expRings = c.expanded ? geometryRings(c.expanded.geometry) : [];
  for (const v of c.vessels) {
    const e = v.eliminated;
    const ti = c.trackIdx.get(v.mmsi);
    if (!e || !ti || !expRings.length) continue;
    const s = stateAt(ti, -e.closest_age_h);
    const q = nearestOnRings(s.pos, expRings);
    elimLines.push({
      mmsi: v.mmsi,
      path: [s.pos, q],
      text: `Short by ${Math.round(e.closest_margin_km)} km at ${fmtSignedH(-e.closest_age_h)}`,
      mid: [(s.pos[0] + q[0]) / 2, (s.pos[1] + q[1]) / 2],
    });
  }

  const isoLabels = c.ages
    .filter((f) => [3, 6, 12, 24, 36, 48, 72].includes((f.properties as { age_h: number }).age_h))
    .map((f) => ({ pos: topVertex(geometryRings(f.geometry)), text: fmtSignedH(-(f.properties as { age_h: number }).age_h) }));

  const coneLabels = (c.bundle.forecast.features as Feature<PolygonGeometry, { kind: string; hours?: number }>[])
    .filter((f) => f.properties.kind === "forecast_envelope")
    .map((f) => ({ pos: topVertex(geometryRings(f.geometry)), text: `+${f.properties.hours} h` }));

  const m = c.bundle.meta.slick.measures;
  const half = m.length_km / 2;
  const axis = [destination(m.centroid, m.orientation_deg, half), destination(m.centroid, m.orientation_deg + 180, half)];
  const wHalf = Math.max(m.mean_width_km, 0.4) / 2 + 1.5;
  const width = [destination(m.centroid, m.orientation_deg + 90, wHalf), destination(m.centroid, m.orientation_deg - 90, wHalf)];
  const fresh = m.fresh_end_bearing_deg != null && m.taper === "clear"
    ? { pos: destination(m.centroid, m.fresh_end_bearing_deg, half), bearing: m.fresh_end_bearing_deg }
    : null;

  const releasePoints = c.vessels
    .filter((v) => v.candidate && (v.role === "leading" || v.role === "shortlist"))
    .map((v) => ({
      mmsi: v.mmsi,
      pos: v.candidate!.best_fit_position,
      role: v.role,
      text: `Best-fit release ${fmtSignedH(-v.candidate!.best_fit_age_h)}`,
    }));

  const targets = ((c.bundle.targets as FeatureCollection | null)?.features ?? []).map((f) => ({
    pos: (f.geometry as { coordinates: LonLat }).coordinates,
    platform: Boolean((f.properties as { platform?: boolean }).platform),
    props: f.properties,
  }));

  return {
    parts, ghosts, gapSegs, ellipses, elimLines, chevrons, isoLabels, coneLabels,
    measure: { axis, width, fresh, centroid: m.centroid, axisLabel: `${m.length_km.toFixed(1)} km` },
    releasePoints, targets,
  };
}

export interface LayerArgs {
  c: CaseDerived;
  s: StaticData;
  on: Record<LayerId, boolean>;
  h: number;
  P: Palette;
  theme: string;
  zoom: number;
  sarOpacity: number;
  hover: number | null;
  selected: number | null;
  onlyShortlist: boolean;
  colorBySpeed: boolean;
  drifted: DriftedPoint[] | null;
  platforms?: FeatureCollection;
  ports?: FeatureCollection;
  showMeasureLabels: boolean;
  sceneMode?: boolean;
  /** Tilted map: draw 3D ship meshes instead of flat icons. */
  tilt?: boolean;
  /** Forecast verification observations for this case. */
  observations?: { lonlat: LonLat; oilSeen: boolean; searchedRadiusKm: number }[];
}

const SPEED_RAMP = ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95"];
function speedColor(sog: number | null): RGBA {
  if (sog == null) return rgba("#6f818c");
  const i = Math.max(0, Math.min(SPEED_RAMP.length - 1, Math.floor(sog / 4)));
  return rgba(SPEED_RAMP[i]);
}

function textLayer<D>(id: string, data: D[], P: Palette, theme: string, props: Record<string, unknown>) {
  return new TextLayer<D>({
    id,
    data,
    getSize: 12,
    getColor: rgba(P.ink),
    fontFamily: FONT_SANS,
    fontWeight: 560,
    outlineWidth: 4,
    outlineColor: rgba(P.sea, 0.95),
    fontSettings: { sdf: true, fontSize: 64, buffer: 6 },
    characterSet: "auto",
    getTextAnchor: "start",
    getAlignmentBaseline: "center",
    updateTriggers: { getColor: theme, outlineColor: theme },
    ...props,
  } as never);
}

export function buildCaseLayers(a: LayerArgs): Layer[] {
  const { c, s, on, h, P, theme, zoom, hover, selected } = a;
  const L: (Layer | false | null | undefined)[] = [];
  const locked = !c.shipsUnlocked;
  const sat = c.bundle.meta.satellite;
  const atlas = iconAtlas();
  const ships = (v: Vessel) => !a.onlyShortlist || v.role === "leading" || v.role === "shortlist" || v.mmsi === selected;
  const visibleRole = (r: Role) =>
    (r === "background" ? on.tracksBg : r === "eliminated" ? on.tracksElim : on.tracks) && !locked;

  // Image
  if (on.sar && sat) {
    L.push(
      new BitmapLayer({
        id: "sar",
        image: dataUrl(`${c.bundle.entry.path}${sat.quicklook}`),
        bounds: sat.bounds,
        opacity: a.sarOpacity,
        desaturate: 1,
      }),
    );
  }

  // Forcing
  const fi = nearestFrame(c.forcing, h);
  if (on.currents) {
    const grid = c.bundle.forcing.grid;
    const fr = c.bundle.forcing.frames[fi];
    L.push(
      new IconLayer({
        id: "currents",
        data: grid.map((p, k) => ({ p, v: fr.cur[k] })).filter((d) => d.v && Math.hypot(d.v[0], d.v[1]) > 0.02),
        iconAtlas: atlas.url,
        iconMapping: atlas.mapping,
        getIcon: () => "arrow",
        getPosition: (d) => d.p,
        getSize: (d) => 12 + Math.min(1.2, Math.hypot(d.v[0], d.v[1])) * 34,
        getAngle: (d) => -((Math.atan2(d.v[0], d.v[1]) * 180) / Math.PI),
        getColor: rgba(P.ink, 0.5),
        sizeUnits: "pixels",
        pickable: true,
        updateTriggers: { getColor: theme },
      }),
    );
  }
  if (on.wind) {
    const grid = c.bundle.forcing.grid;
    const fr = c.bundle.forcing.frames[fi];
    L.push(
      new IconLayer({
        id: "wind",
        data: grid.map((p, k) => ({ p, v: fr.wind[k] })).filter((_, k) => k % 2 === 0),
        iconAtlas: atlas.url,
        iconMapping: atlas.mapping,
        getIcon: (d) => barbIcon(Math.hypot(d.v[0], d.v[1]) * 1.94384),
        getPosition: (d) => d.p,
        getSize: 30,
        // Staff points to where the wind comes from: opposite of the (u, v) vector.
        getAngle: (d) => -((Math.atan2(-d.v[0], -d.v[1]) * 180) / Math.PI),
        getColor: rgba(P.ink2, 0.85),
        sizeUnits: "pixels",
        pickable: true,
        updateTriggers: { getColor: theme },
      }),
    );
  }

  // Forecast cone (72 h first so 24 h sits on top)
  if (on.cone) {
    const env = (c.bundle.forecast.features as Feature<PolygonGeometry, { kind: string; hours?: number }>[])
      .filter((f) => f.properties.kind === "forecast_envelope")
      .sort((x, y) => (y.properties.hours ?? 0) - (x.properties.hours ?? 0));
    const alphaFill: Record<number, number> = { 24: 0.18, 48: 0.11, 72: 0.06 };
    L.push(
      new GeoJsonLayer({
        id: "cone",
        data: env as never,
        filled: true,
        stroked: false,
        getFillColor: ((f: Feature<PolygonGeometry, { hours?: number }>) => rgba(P.future, alphaFill[f.properties.hours ?? 72] ?? 0.08)) as never,
        pickable: true,
        updateTriggers: { getFillColor: theme },
      }),
      new PathLayer({
        id: "cone-outline",
        data: env.flatMap((f) => geometryRings(f.geometry).map((r) => ({ r, hours: f.properties.hours ?? 72 }))),
        getPath: (d) => d.r,
        getColor: rgba(P.future, 0.95),
        getWidth: (d) => (d.hours === 24 ? 1.5 : d.hours === 48 ? 1.25 : 1),
        widthUnits: "pixels",
        ...dashed((d: { hours: number }) => (d.hours === 72 ? [5, 4] : [0, 0])),
        updateTriggers: { getColor: theme },
      }),
      textLayer("cone-labels", s.coneLabels, P, theme, { getPosition: (d: { pos: LonLat }) => d.pos, getText: (d: { text: string }) => d.text, getPixelOffset: [4, -8] }),
    );
    const stranded = c.bundle.forecast.features.filter((f) => f.geometry.type === "Point");
    if (stranded.length) {
      L.push(
        new IconLayer({
          id: "stranded",
          data: stranded,
          iconAtlas: atlas.url,
          iconMapping: atlas.mapping,
          getIcon: () => "cross",
          getPosition: (f) => (f.geometry as { coordinates: LonLat }).coordinates,
          getSize: 12,
          getColor: rgba(P.future),
          sizeUnits: "pixels",
          updateTriggers: { getColor: theme },
        }),
      );
    }
  }

  // Where it came from: isochrones + corridor
  if (on.isochrones) {
    L.push(
      new PathLayer({
        id: "isochrones",
        data: c.ages.flatMap((f) => geometryRings(f.geometry).map((r) => ({ r, age: (f.properties as { age_h: number }).age_h, inPrior: (f.properties as { in_age_prior?: boolean }).in_age_prior }))),
        getPath: (d) => d.r,
        getColor: (d) => rgba(P.past, d.inPrior ? 0.6 : 0.3),
        getWidth: 1,
        widthUnits: "pixels",
        pickable: true,
        updateTriggers: { getColor: theme },
      }),
    );
  }
  if (on.corridor && c.release) {
    const hat = hatchAtlas();
    L.push(
      new PolygonLayer({
        id: "corridor",
        data: [c.release],
        getPolygon: (f: Feature<PolygonGeometry>) => (f.geometry.type === "Polygon" ? f.geometry.coordinates : f.geometry.coordinates[0]),
        filled: true,
        stroked: true,
        getFillColor: rgba(P.past, 0.4),
        getLineColor: rgba(P.past),
        getLineWidth: 1.5,
        lineWidthUnits: "pixels",
        fillPatternAtlas: hat.url,
        fillPatternMapping: hat.mapping,
        getFillPattern: () => "hatch",
        getFillPatternScale: 1,
        getFillPatternOffset: [0, 0],
        fillPatternMask: true,
        extensions: [fillExt],
        pickable: true,
        updateTriggers: { getFillColor: theme, getLineColor: theme },
      }),
      new SolidPolygonLayer({
        id: "corridor-tint",
        data: [c.release],
        getPolygon: (f: Feature<PolygonGeometry>) => (f.geometry.type === "Polygon" ? f.geometry.coordinates : f.geometry.coordinates[0]),
        getFillColor: rgba(P.past, 0.1),
        updateTriggers: { getFillColor: theme },
      }),
    );
  }
  if (on.expanded && c.expanded) {
    L.push(
      new PathLayer({
        id: "expanded",
        data: geometryRings(c.expanded.geometry),
        getPath: (r) => r,
        getColor: rgba(P.past, 0.55),
        getWidth: 1,
        widthUnits: "pixels",
        ...dashed([6, 4]),
        pickable: true,
        updateTriggers: { getColor: theme },
      }),
    );
  }

  // Ships: routes
  const vis = (d: { mmsi: number; role: Role }) => visibleRole(d.role) && ships(c.byMmsi.get(d.mmsi)!);
  if (!locked) {
    const ghosts = s.ghosts.filter(vis);
    const parts = s.parts.filter(vis);
    const hl = new Set([hover, selected].filter(Boolean) as number[]);
    L.push(
      new PathLayer<TripPart>({
        id: "tracks-ghost",
        data: ghosts,
        getPath: (d) => d.path,
        getColor: (d) => roleColor(P, d.role, d.role === "background" ? 0.35 : 0.45),
        getWidth: (d) => Math.max(0.75, ROLE_WIDTH[d.role] - 0.5),
        widthUnits: "pixels",
        ...dashed([3, 3]),
        pickable: true,
        updateTriggers: { getColor: theme },
      }),
      hl.size > 0 &&
        new PathLayer<TripPart>({
          id: "tracks-highlight",
          data: s.ghosts.filter((d) => hl.has(d.mmsi)),
          getPath: (d) => d.path,
          getColor: rgba(P.focus, 0.9),
          getWidth: (d) => ROLE_WIDTH[d.role] + 4,
          widthUnits: "pixels",
          updateTriggers: { getColor: theme },
        }),
      new TripsLayer<TripPart>({
        id: "tracks",
        data: parts,
        getPath: (d) => d.path,
        getTimestamps: (d) => d.timestamps,
        getColor: (a.colorBySpeed ? (d: TripPart) => d.sog.map(speedColor) : (d: TripPart) => roleColor(P, d.role)) as never,
        getWidth: (d) => ROLE_WIDTH[d.role] + (hl.has(d.mmsi) ? 1 : 0),
        widthUnits: "pixels",
        currentTime: h,
        trailLength: 10_000,
        fadeTrail: false,
        capRounded: true,
        jointRounded: true,
        pickable: true,
        updateTriggers: { getColor: [theme, a.colorBySpeed], getWidth: [hover, selected] },
      }),
    );
    if (on.gaps) {
      const gaps = s.gapSegs.filter(vis);
      L.push(
        new PathLayer<GapSeg>({
          id: "gaps",
          data: gaps,
          getPath: (d) => d.path,
          getColor: (d) => roleColor(P, d.role, 0.9),
          getWidth: (d) => Math.max(1, ROLE_WIDTH[d.role] - 0.5),
          widthUnits: "pixels",
          capRounded: true,
          ...dashed([1, 4]),
          pickable: true,
          updateTriggers: { getColor: theme },
        }),
        textLayer("gap-labels", gaps.filter((g) => g.gap.hours >= 1 && (g.role === "leading" || g.role === "shortlist" || g.mmsi === selected || g.mmsi === hover || zoom >= 8.5)), P, theme, {
          getPosition: (d: GapSeg) => d.mid,
          getText: (d: GapSeg) => `AIS gap ${d.gap.hours.toFixed(1)} h`,
          getSize: 11,
          getColor: rgba(P.ink2),
          getPixelOffset: [6, 0],
        }),
      );
    }
    if (on.reach) {
      const ell = s.ellipses.filter((e) => vis(e) && (e.role === "leading" || e.role === "shortlist" || e.mmsi === selected || e.mmsi === hover));
      L.push(
        new SolidPolygonLayer<Ellipse>({
          id: "reach-fill",
          data: ell,
          getPolygon: (d) => d.ring,
          getFillColor: rgba(P.ink2, 0.06),
          pickable: true,
          updateTriggers: { getFillColor: theme },
        }),
        new PathLayer<Ellipse>({
          id: "reach-outline",
          data: ell,
          getPath: (d) => d.ring,
          getColor: rgba(P.ink2, 0.7),
          getWidth: 1,
          widthUnits: "pixels",
          ...dashed([4, 3]),
          updateTriggers: { getColor: theme },
        }),
      );
    }
    if (on.tracksElim) {
      L.push(
        new PathLayer<ElimLine>({
          id: "elim-lines",
          data: s.elimLines,
          getPath: (d) => d.path,
          getColor: rgba(P.ink2, 0.8),
          getWidth: 1,
          widthUnits: "pixels",
          ...dashed([2, 3]),
          updateTriggers: { getColor: theme },
        }),
        textLayer("elim-labels", s.elimLines.filter((e) => zoom >= 8 || e.mmsi === selected || e.mmsi === hover), P, theme, {
          getPosition: (d: ElimLine) => d.mid,
          getText: (d: ElimLine) => d.text,
          getSize: 11,
          getColor: rgba(P.ink2),
          getPixelOffset: [6, 0],
        }),
      );
    }
    // Direction chevrons (skip when zoomed far out)
    if (zoom >= 6.5) {
      const step = zoom >= 9 ? 1 : zoom >= 8 ? 2 : zoom >= 7 ? 3 : 5;
      const chev = [...s.chevrons.values()].flatMap((arr) => arr.filter((_, i) => i % step === 0)).filter(vis);
      L.push(
        new IconLayer({
          id: "chevrons",
          data: chev,
          iconAtlas: atlas.url,
          iconMapping: atlas.mapping,
          getIcon: () => "chevron",
          getPosition: (d) => d.pos,
          getAngle: (d) => -d.bearing,
          getSize: (d) => (d.role === "leading" ? 13 : 10),
          getColor: (d) => roleColor(P, d.role, 0.95),
          sizeUnits: "pixels",
          updateTriggers: { getColor: theme },
        }),
      );
    }
  }

  // Oil: particles and routes
  if (c.drift) {
    if (on.backRoute && c.back) {
      const members = c.back.members.map((m) => ({ m }));
      L.push(
        new PathLayer({
          id: "back-members",
          data: members,
          getPath: (d) => d.m,
          getColor: rgba(P.past, 0.32),
          getWidth: 0.9,
          widthUnits: "pixels",
          updateTriggers: { getColor: theme },
        }),
        new PathLayer({
          id: "back-route",
          data: [{ p: c.back.mean }],
          getPath: (d) => d.p,
          getColor: rgba(P.past),
          getWidth: 2.2,
          widthUnits: "pixels",
          capRounded: true,
          jointRounded: true,
          pickable: true,
          updateTriggers: { getColor: theme },
        }),
        new ScatterplotLayer({
          id: "back-ticks",
          data: c.back.mean.map((p, i) => ({ p, h: c.back!.hours[i] })).filter((d) => d.h !== 0),
          getPosition: (d) => d.p,
          getRadius: (d) => (d.h % 6 === 0 ? 3.2 : 1.6),
          radiusUnits: "pixels",
          getFillColor: rgba(P.past),
          updateTriggers: { getFillColor: theme },
        }),
        textLayer(
          "back-labels",
          c.back.mean.map((p, i) => ({ p, h: c.back!.hours[i] })).filter((d) => d.h !== 0 && d.h % (zoom >= 9 ? 6 : 12) === 0),
          P,
          theme,
          { getPosition: (d: { p: LonLat }) => d.p, getText: (d: { h: number }) => fmtSignedH(d.h), getSize: 11, getPixelOffset: [-8, 0], getTextAnchor: "end" },
        ),
      );
    }
    if (on.fwdRoute && c.fwd) {
      L.push(
        new PathLayer({
          id: "fwd-route",
          data: [{ p: c.fwd.mean }],
          getPath: (d) => d.p,
          getColor: rgba(P.future),
          getWidth: 2.2,
          widthUnits: "pixels",
          capRounded: true,
          jointRounded: true,
          pickable: true,
          updateTriggers: { getColor: theme },
        }),
        new ScatterplotLayer({
          id: "fwd-ticks",
          data: c.fwd.mean.map((p, i) => ({ p, h: c.fwd!.hours[i] })).filter((d) => d.h !== 0 && d.h % 6 === 0),
          getPosition: (d) => d.p,
          getRadius: 3,
          radiusUnits: "pixels",
          getFillColor: rgba(P.future),
          updateTriggers: { getFillColor: theme },
        }),
      );
    }
    if (on.backParticles && h <= 0) {
      L.push(
        new ScatterplotLayer({
          id: "back-particles",
          data: particlesAt(c.drift.backward.frames, -h),
          getPosition: (d: LonLat) => d,
          getRadius: 2.1,
          radiusUnits: "pixels",
          getFillColor: rgba(mix(P.past, P.ink, 0.15), 0.75),
          updateTriggers: { getFillColor: theme },
        }),
      );
    }
    if (on.fwdParticles && h >= 0) {
      L.push(
        new ScatterplotLayer({
          id: "fwd-particles",
          data: particlesAt(c.drift.forward.frames, h),
          getPosition: (d: LonLat) => d,
          getRadius: 2.1,
          radiusUnits: "pixels",
          getFillColor: rgba(mix(P.future, P.ink, 0.1), 0.8),
          updateTriggers: { getFillColor: theme },
        }),
      );
    }
  }

  // Slick (always the reference)
  if (on.slick) {
    L.push(
      new GeoJsonLayer({
        id: "slick-halo",
        data: c.bundle.slick as never,
        filled: true,
        stroked: true,
        getFillColor: rgba("#000000", sat && on.sar ? 0.12 : 0.4),
        getLineColor: rgba(P.sea, 0.9),
        lineWidthUnits: "pixels",
        getLineWidth: 4,
        updateTriggers: { getLineColor: theme, getFillColor: [on.sar] },
      }),
      new GeoJsonLayer({
        id: "slick",
        data: c.bundle.slick as never,
        filled: false,
        stroked: true,
        getLineColor: rgba(P.ink),
        lineWidthUnits: "pixels",
        getLineWidth: 1.75,
        pickable: true,
        updateTriggers: { getLineColor: theme },
      }),
    );
  }
  if (on.measures) {
    const m = s.measure;
    L.push(
      new PathLayer({
        id: "measure-lines",
        data: [{ p: m.axis, dash: true }, { p: m.width, dash: false }],
        getPath: (d) => d.p,
        getColor: rgba(P.ink, 0.9),
        getWidth: 1.25,
        widthUnits: "pixels",
        ...dashed((d: { dash: boolean }) => (d.dash ? [6, 3] : [0, 0])),
        updateTriggers: { getColor: theme },
      }),
      new IconLayer({
        id: "measure-icons",
        data: [
          { pos: m.centroid, icon: "plus", angle: 0, size: 14 },
          ...(m.fresh ? [{ pos: m.fresh.pos, icon: "fresh-end", angle: -m.fresh.bearing, size: 16 }] : []),
        ],
        iconAtlas: atlas.url,
        iconMapping: atlas.mapping,
        getIcon: (d) => d.icon,
        getPosition: (d) => d.pos,
        getAngle: (d) => d.angle,
        getSize: (d) => d.size,
        getColor: rgba(P.ink),
        sizeUnits: "pixels",
        updateTriggers: { getColor: theme },
      }),
      a.showMeasureLabels &&
        textLayer("measure-labels", [
          { pos: m.axis[0], text: `Length ${m.axisLabel}` },
          ...(m.fresh ? [{ pos: m.fresh.pos, text: "Fresh end" }] : []),
        ], P, theme, { getPosition: (d: { pos: LonLat }) => d.pos, getText: (d: { text: string }) => d.text, getPixelOffset: [10, -10] }),
    );
  }

  // Forecast verification observations: filled = oil seen, ring = searched and none found
  if (a.observations?.length && on.cone) {
    L.push(
      new ScatterplotLayer({
        id: "observations-area",
        data: a.observations,
        getPosition: (d) => d.lonlat,
        getRadius: (d) => d.searchedRadiusKm * 1000,
        radiusUnits: "meters",
        filled: false,
        stroked: true,
        getLineColor: rgba(P.ink2, 0.7),
        lineWidthUnits: "pixels",
        getLineWidth: 1,
        updateTriggers: { getLineColor: theme },
      }),
      new ScatterplotLayer({
        id: "observations",
        data: a.observations,
        getPosition: (d) => d.lonlat,
        getRadius: 6,
        radiusUnits: "pixels",
        stroked: true,
        filled: true,
        getFillColor: (d) => (d.oilSeen ? rgba(P.ink) : rgba(P.sea)),
        getLineColor: rgba(P.ink),
        lineWidthUnits: "pixels",
        getLineWidth: 2,
        pickable: true,
        updateTriggers: { getFillColor: theme, getLineColor: theme },
      }),
    );
  }

  // SAR targets and reference points
  if (on.targets && s.targets.length) {
    L.push(
      new IconLayer({
        id: "targets",
        data: s.targets,
        iconAtlas: atlas.url,
        iconMapping: atlas.mapping,
        getIcon: (d) => (d.platform ? "platform" : "diamond"),
        getPosition: (d) => d.pos,
        getSize: 10,
        getColor: (d) => (d.platform ? rgba(P.ink2) : rgba(P.ink, 0.8)),
        sizeUnits: "pixels",
        pickable: true,
        updateTriggers: { getColor: theme },
      }),
    );
  }
  const bb = c.bounds.all;
  const inBox = (p: LonLat) => p[0] >= bb[0] - 1 && p[0] <= bb[2] + 1 && p[1] >= bb[1] - 1 && p[1] <= bb[3] + 1;
  if (on.platforms && a.platforms) {
    L.push(
      new IconLayer({
        id: "platforms",
        data: a.platforms.features.filter((f) => inBox((f.geometry as { coordinates: LonLat }).coordinates)),
        iconAtlas: atlas.url,
        iconMapping: atlas.mapping,
        getIcon: () => "platform",
        getPosition: (f) => (f.geometry as { coordinates: LonLat }).coordinates,
        getSize: zoom >= 8 ? 11 : 7,
        getColor: rgba(P.ink2, 0.75),
        sizeUnits: "pixels",
        pickable: true,
        updateTriggers: { getColor: theme, getSize: zoom >= 8 },
      }),
    );
  }
  if (on.ports && a.ports && zoom >= 6) {
    L.push(
      new IconLayer({
        id: "ports",
        data: a.ports.features.filter((f) => inBox((f.geometry as { coordinates: LonLat }).coordinates)),
        iconAtlas: atlas.url,
        iconMapping: atlas.mapping,
        getIcon: () => "anchor",
        getPosition: (f) => (f.geometry as { coordinates: LonLat }).coordinates,
        getSize: 13,
        getColor: rgba(P.ink2, 0.9),
        sizeUnits: "pixels",
        pickable: true,
        updateTriggers: { getColor: theme },
      }),
    );
  }

  // Drift-corrected track of the selected ship
  if (on.driftCorrected && a.drifted && a.drifted.length && !locked) {
    const pts = a.drifted;
    L.push(
      new ScatterplotLayer({
        id: "drift-sigma",
        data: pts.filter((_, i) => i % 2 === 0),
        getPosition: (d: DriftedPoint) => d.to,
        getRadius: (d: DriftedPoint) => d.sigmaKm * 1000,
        radiusUnits: "meters",
        getFillColor: rgba(P.shipShort, 0.05),
        stroked: false,
        updateTriggers: { getFillColor: theme },
      }),
      new PathLayer({
        id: "drift-links",
        data: pts.filter((_, i) => i % 6 === 0),
        getPath: (d: DriftedPoint) => [d.from, d.to],
        getColor: rgba(P.shipShort, 0.35),
        getWidth: 0.75,
        widthUnits: "pixels",
        updateTriggers: { getColor: theme },
      }),
      new PathLayer({
        id: "drift-track",
        data: [{ p: pts.map((d) => d.to) }],
        getPath: (d) => d.p,
        getColor: rgba(P.shipLead),
        getWidth: 2,
        widthUnits: "pixels",
        ...dashed([6, 3]),
        updateTriggers: { getColor: theme },
      }),
    );
  }

  // Ships at the clock time
  if (on.heads && !locked) {
    const heads = c.vessels
      .filter((v) => c.trackIdx.has(v.mmsi) && visibleRole(v.role) && ships(v))
      .map((v) => ({ v, st: stateAt(c.trackIdx.get(v.mmsi)!, h) }))
      .filter((d) => d.st.status !== "before" || d.st.sinceFixH < 3);
    const order: Record<Role, number> = { background: 0, eliminated: 1, screened: 2, shortlist: 3, leading: 4 };
    heads.sort((x, y) => order[x.v.role] - order[y.v.role]);
    L.push(
      new IconLayer({
        id: "heads-halo",
        data: heads.filter((d) => d.v.role === "leading" || d.v.mmsi === selected || d.v.mmsi === hover),
        iconAtlas: atlas.url,
        iconMapping: atlas.mapping,
        getIcon: () => "ring",
        getPosition: (d) => d.st.pos,
        getSize: 34,
        getColor: (d) => (d.v.mmsi === selected || d.v.mmsi === hover ? rgba(P.focus, 0.95) : roleColor(P, "leading", 0.6)),
        sizeUnits: "pixels",
        updateTriggers: { getColor: [theme, selected, hover] },
      }),
      ...(a.tilt
        ? (["tanker", "cargo", "passenger", "fishing", "tug", "other"] as HullKind[]).map((k) => {
            // Exaggerate with zoom so ships stay visible, true size when zoomed right in.
            // Keep ships about 26 px long on screen; true size once zoomed in that far.
            const mPerPx = (156543.03 * Math.cos((c.centroid[1] * Math.PI) / 180)) / Math.pow(2, zoom);
            const ex = Math.max(1, (26 * mPerPx) / HULL_LENGTH_M[k]);
            return new SimpleMeshLayer<(typeof heads)[number]>({
              id: `heads-mesh-${k}`,
              data: heads.filter((d) => hullKind(d.v.vesselType) === k),
              mesh: shipMesh(k) as never,
              getPosition: (d) => d.st.pos,
              getOrientation: (d) => [0, -d.st.bearing, 0],
              getScale: [ex, ex, ex],
              getColor: (d) => roleColor(P, d.v.role, d.st.status === "moving" ? 1 : 0.6),
              material: false,
              pickable: true,
              updateTriggers: { getColor: theme, getScale: zoom },
            });
          })
        : []),
      !a.tilt && new IconLayer({
        id: "heads",
        data: heads,
        iconAtlas: atlas.url,
        iconMapping: atlas.mapping,
        getIcon: (d) => (d.st.status === "moving" ? hullIcon(hullKind(d.v.vesselType)) : "hull-outline"),
        getPosition: (d) => d.st.pos,
        getAngle: (d) => -d.st.bearing,
        getSize: (d) => (d.v.role === "background" ? 14 : d.v.role === "leading" ? 26 : d.v.role === "shortlist" ? 22 : 18),
        getColor: (d) => roleColor(P, d.v.role, d.st.status === "moving" ? 1 : 0.8),
        sizeUnits: "pixels",
        pickable: true,
        updateTriggers: { getColor: theme },
      }),
      textLayer(
        "head-labels",
        heads.filter((d) => d.v.role === "leading" || d.v.role === "shortlist" || d.v.mmsi === selected || d.v.mmsi === hover),
        P,
        theme,
        {
          getPosition: (d: { st: { pos: LonLat } }) => d.st.pos,
          getText: (d: { v: Vessel; st: { status: string; sinceFixH: number } }) =>
            d.st.status === "gap" ? `${d.v.name} (AIS gap ${d.st.sinceFixH.toFixed(1)} h)` : d.st.status === "after" ? `${d.v.name} (last fix)` : d.v.name,
          getPixelOffset: [16, 0],
          fontWeight: 620,
        },
      ),
    );
  }

  // Best-fit release points
  if (on.release && !locked) {
    const pts = s.releasePoints.filter((r) => r.role === "leading" || r.role === "shortlist" || r.mmsi === selected);
    const sel = selected ? c.byMmsi.get(selected) : undefined;
    if (sel?.candidate && !pts.some((p) => p.mmsi === sel.mmsi)) {
      pts.push({ mmsi: sel.mmsi, pos: sel.candidate.best_fit_position, role: sel.role, text: `Best-fit release ${fmtSignedH(-sel.candidate.best_fit_age_h)}` });
    }
    L.push(
      new IconLayer({
        id: "release",
        data: pts,
        iconAtlas: atlas.url,
        iconMapping: atlas.mapping,
        getIcon: () => "ring",
        getPosition: (d) => d.pos,
        getSize: 18,
        getColor: rgba(P.past),
        sizeUnits: "pixels",
        pickable: true,
        updateTriggers: { getColor: theme },
      }),
      new ScatterplotLayer({
        id: "release-dot",
        data: pts,
        getPosition: (d) => d.pos,
        getRadius: 3,
        radiusUnits: "pixels",
        getFillColor: (d) => roleColor(P, d.role),
        updateTriggers: { getFillColor: theme },
      }),
      textLayer("release-labels", pts, P, theme, { getPosition: (d: { pos: LonLat }) => d.pos, getText: (d: { text: string }) => d.text, getPixelOffset: [12, 12], getSize: 11 }),
    );
  }

  return L.filter(Boolean) as Layer[];
}

const DECK_TO_LAYER: [RegExp, LayerId][] = [
  [/^sar$/, "sar"], [/^targets$/, "targets"], [/^slick/, "slick"], [/^measure-/, "measures"],
  [/^back-particles$/, "backParticles"], [/^back-/, "backRoute"], [/^isochrones$/, "isochrones"],
  [/^corridor/, "corridor"], [/^expanded$/, "expanded"], [/^fwd-particles$/, "fwdParticles"], [/^fwd-/, "fwdRoute"],
  [/^(cone|stranded|observations)/, "cone"], [/^(tracks|chevrons)/, "tracks"], [/^gap/, "gaps"], [/^reach-/, "reach"],
  [/^elim-/, "tracksElim"], [/^head/, "heads"], [/^release/, "release"], [/^drift-/, "driftCorrected"],
  [/^currents$/, "currents"], [/^wind$/, "wind"], [/^eez/, "eez"], [/^graticule$/, "graticule"], [/^ports$/, "ports"], [/^platforms$/, "platforms"], [/^online/, "online"],
];

/** Apply the per-layer opacity chosen in the layers panel. */
export function withOpacity(layers: Layer[], opacity: Partial<Record<LayerId, number>>): Layer[] {
  if (!Object.keys(opacity).length) return layers;
  return layers.map((l) => {
    const hit = DECK_TO_LAYER.find(([re]) => re.test(l.id));
    const o = hit ? opacity[hit[1]] : undefined;
    return o != null && o < 1 ? l.clone({ opacity: ((l.props.opacity as number) ?? 1) * o }) : l;
  });
}

/** Distance in km from a point to the slick outline (0 inside). */
export function kmToSlick(c: CaseDerived, p: LonLat): number {
  let best = Infinity;
  for (const r of c.slickRings) for (const q of r) best = Math.min(best, distanceKm(p, q));
  return best;
}
